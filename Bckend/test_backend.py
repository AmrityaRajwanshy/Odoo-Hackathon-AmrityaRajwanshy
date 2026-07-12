import os
# Force testing environment before database loading
os.environ["ENV_MODE"] = "testing"

import unittest
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient
import mysql.connector

from main import app
from database import get_db_connection
from create_database import sql_script

class TestAssetManagementSystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        from create_database import sql_script, MYSQL_DB
        cleaned_script = sql_script.replace(f"USE {MYSQL_DB}", "USE test_assetflow_db")
        cleaned_script = cleaned_script.replace(f"CREATE DATABASE IF NOT EXISTS {MYSQL_DB}", "CREATE DATABASE IF NOT EXISTS test_assetflow_db")
        
        conn = mysql.connector.connect(
            user=os.getenv("MYSQL_USER", ""),
            password=os.getenv("MYSQL_PASSWORD", ""),
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", "3306"))
        )
        cursor = conn.cursor()
        cursor.execute("DROP DATABASE IF EXISTS test_assetflow_db")
        cursor.execute(cleaned_script)
        # Consume any statement results
        if cursor.with_rows:
            cursor.fetchall()
        while cursor.nextset() is not None:
            if cursor.with_rows:
                cursor.fetchall()
        conn.commit()
        cursor.close()
        conn.close()

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Drop test database
        conn = mysql.connector.connect(
            user=os.getenv("MYSQL_USER", ""),
            password=os.getenv("MYSQL_PASSWORD", ""),
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", "3306"))
        )
        cursor = conn.cursor()
        cursor.execute("DROP DATABASE IF EXISTS test_assetflow_db")
        conn.commit()
        cursor.close()
        conn.close()

    def setUp(self):
        # Truncate tables before each test
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        tables = [
            "activity_logs", "notifications", "audit_asset_results", 
            "audit_assignments", "audit_cycles", "maintenance_requests", 
            "resource_bookings", "transfer_requests", "asset_allocations", 
            "assets", "asset_categories", "departments", "employees"
        ]
        for table in tables:
            cursor.execute(f"TRUNCATE TABLE `{table}`")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        db.commit()
        cursor.close()
        db.close()
        self.tokens = {}

    def signup_and_login(self, name, email, password):
        """Helper to sign up and log in a user, returning their headers."""
        signup_payload = {
            "name": name,
            "email": email,
            "password": password
        }
        self.client.post("/api/auth/signup", json=signup_payload)
        
        login_payload = {
            "email": email,
            "password": password
        }
        resp = self.client.post("/api/auth/login", json=login_payload)
        self.assertEqual(resp.status_code, 200)
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_01_auth_flow_and_bootstrap(self):
        # First signup is automatically Admin
        signup_admin = {
            "name": "Admin Alice",
            "email": "alice@test.com",
            "password": "pwd"
        }
        res = self.client.post("/api/auth/signup", json=signup_admin)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["role"], "Admin")

        # Second signup is default Employee
        signup_emp = {
            "name": "Employee Priya",
            "email": "priya@test.com",
            "password": "pwd"
        }
        res2 = self.client.post("/api/auth/signup", json=signup_emp)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["role"], "Employee")

        # Forgot password flow simulation
        fgt_res = self.client.post("/api/auth/forgot-password", json={"email": "priya@test.com"})
        self.assertEqual(fgt_res.status_code, 200)
        token = fgt_res.json()["reset_token"]

        # Reset password
        rst_res = self.client.post("/api/auth/reset-password", json={
            "email": "priya@test.com",
            "token": token,
            "new_password": "newpwd"
        })
        self.assertEqual(rst_res.status_code, 200)

        # Login with new password
        login_res = self.client.post("/api/auth/login", json={
            "email": "priya@test.com",
            "password": "newpwd"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("access_token", login_res.json())

    def test_02_org_setup_and_promotion(self):
        admin_headers = self.signup_and_login("Admin User", "admin@org.com", "pwd123")
        emp_headers = self.signup_and_login("Staff Raj", "raj@org.com", "pwd123")

        # Create Category (Admin only)
        cat_payload = {
            "name": "Electronics",
            "description": "Laptops",
            "fields_schema": {"warranty_months": "int"}
        }
        res = self.client.post("/api/org/categories", json=cat_payload, headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "Electronics")
        cat_id = res.json()["id"]

        # Employee cannot create category
        res_fail = self.client.post("/api/org/categories", json=cat_payload, headers=emp_headers)
        self.assertEqual(res_fail.status_code, 403)

        # Create Department
        dept_payload = {
            "name": "Engineering",
            "status": "Active"
        }
        res_dept = self.client.post("/api/org/departments", json=dept_payload, headers=admin_headers)
        self.assertEqual(res_dept.status_code, 200)
        dept_id = res_dept.json()["id"]

        # Admin promotes Employee Raj to Asset Manager
        # First retrieve Raj's employee ID
        users_resp = self.client.get("/api/org/employees", headers=admin_headers)
        raj_user = [u for u in users_resp.json() if u["email"] == "raj@org.com"][0]
        raj_id = raj_user["id"]

        promote_payload = {
            "role": "Asset Manager",
            "department_id": dept_id
        }
        res_promote = self.client.put(f"/api/org/employees/{raj_id}", json=promote_payload, headers=admin_headers)
        self.assertEqual(res_promote.status_code, 200)
        self.assertEqual(res_promote.json()["role"], "Asset Manager")
        self.assertEqual(res_promote.json()["department_id"], dept_id)

    def test_03_asset_registration_and_lookup(self):
        admin_headers = self.signup_and_login("Admin User", "admin@org.com", "pwd123")
        
        # Create Category
        res_cat = self.client.post("/api/org/categories", json={"name": "Electronics", "fields_schema": {"warranty": "int"}}, headers=admin_headers)
        cat_id = res_cat.json()["id"]

        # Register Asset
        asset_payload = {
            "name": "Macbook Pro 16",
            "category_id": cat_id,
            "serial_number": "MBP2026XYZ",
            "acquisition_date": str(date.today()),
            "acquisition_cost": 2400.0,
            "condition": "New",
            "location": "HQ Tower A",
            "is_shared_bookable": True,
            "custom_values": {"warranty": 24}
        }
        res_asset = self.client.post("/api/assets", json=asset_payload, headers=admin_headers)
        self.assertEqual(res_asset.status_code, 200)
        self.assertEqual(res_asset.json()["asset_tag"], "EL-0001")  # Prefix check
        self.assertEqual(res_asset.json()["custom_values"]["warranty"], 24)

        # Register a duplicate to check numbering sequence
        res_asset2 = self.client.post("/api/assets", json=asset_payload, headers=admin_headers)
        self.assertEqual(res_asset2.json()["asset_tag"], "EL-0002")

        # Directory Search check
        search_res = self.client.get("/api/assets?q=EL-0001", headers=admin_headers)
        self.assertEqual(len(search_res.json()), 1)
        self.assertEqual(search_res.json()[0]["name"], "Macbook Pro 16")

    def test_04_allocation_and_conflicts(self):
        admin_headers = self.signup_and_login("Admin", "admin@org.com", "pwd")
        emp1_headers = self.signup_and_login("Priya", "priya@org.com", "pwd")
        emp2_headers = self.signup_and_login("Raj", "raj@org.com", "pwd")

        # Fetch employee IDs
        users_resp = self.client.get("/api/org/employees", headers=admin_headers)
        priya_id = [u for u in users_resp.json() if u["email"] == "priya@org.com"][0]["id"]
        raj_id = [u for u in users_resp.json() if u["email"] == "raj@org.com"][0]["id"]

        # Category and Asset Setup
        res_cat = self.client.post("/api/org/categories", json={"name": "Electronics"}, headers=admin_headers)
        cat_id = res_cat.json()["id"]

        asset_payload = {
            "name": "Laptop Dell",
            "category_id": cat_id,
            "serial_number": "DELL5566",
            "acquisition_date": str(date.today()),
            "location": "HQ",
        }
        res_asset = self.client.post("/api/assets", json=asset_payload, headers=admin_headers)
        asset_id = res_asset.json()["id"]

        # Allocate to Priya
        alloc_payload = {
            "asset_id": asset_id,
            "employee_id": priya_id,
            "expected_return_date": str(datetime.utcnow() + timedelta(days=5))
        }
        res_alloc = self.client.post("/api/allocations", json=alloc_payload, headers=admin_headers)
        self.assertEqual(res_alloc.status_code, 200)
        self.assertEqual(res_alloc.json()["status"], "Active")

        # Conflict check: Try to allocate Dell Laptop to Raj
        alloc_raj_payload = {
            "asset_id": asset_id,
            "employee_id": raj_id
        }
        res_conflict = self.client.post("/api/allocations", json=alloc_raj_payload, headers=admin_headers)
        self.assertEqual(res_conflict.status_code, 409)
        self.assertIn("Priya", res_conflict.json()["detail"]["message"])

        # Transfer Request
        transfer_payload = {
            "asset_id": asset_id,
            "target_employee_id": raj_id,
            "notes": "Priya left for training, Raj needs the laptop."
        }
        res_trsf = self.client.post("/api/allocations/transfers", json=transfer_payload, headers=emp2_headers)
        self.assertEqual(res_trsf.status_code, 200)
        self.assertEqual(res_trsf.json()["status"], "Pending")
        transfer_id = res_trsf.json()["id"]

        # Approve Transfer (Admin approves)
        res_approve = self.client.post(f"/api/allocations/transfers/{transfer_id}/action?approve=true", headers=admin_headers)
        self.assertEqual(res_approve.status_code, 200)

        # Asset current holder should now be Raj
        res_check_asset = self.client.get(f"/api/assets/{asset_id}", headers=admin_headers)
        self.assertEqual(res_check_asset.json()["current_holder_id"], raj_id)
        self.assertEqual(res_check_asset.json()["status"], "Allocated")

        # Return Flow
        # Retrieve active allocation ID for Raj
        allocations = self.client.get("/api/allocations", headers=admin_headers)
        active_alloc = [a for a in allocations.json() if a["asset_id"] == asset_id and a["status"] == "Active"][0]
        
        return_payload = {
            "return_condition": "Good",
            "return_notes": "Returned intact."
        }
        res_ret = self.client.post(f"/api/allocations/{active_alloc['id']}/return", json=return_payload, headers=admin_headers)
        self.assertEqual(res_ret.status_code, 200)
        self.assertEqual(res_ret.json()["status"], "Returned")

        # Asset status should revert to Available
        res_check_asset2 = self.client.get(f"/api/assets/{asset_id}", headers=admin_headers)
        self.assertEqual(res_check_asset2.json()["status"], "Available")
        self.assertEqual(res_check_asset2.json()["current_holder_id"], None)

    def test_05_resource_bookings(self):
        admin_headers = self.signup_and_login("Admin", "admin@org.com", "pwd")
        emp_headers = self.signup_and_login("User", "user@org.com", "pwd")

        # Setup Category & Bookable Asset
        res_cat = self.client.post("/api/org/categories", json={"name": "Facilities"}, headers=admin_headers)
        cat_id = res_cat.json()["id"]

        asset_payload = {
            "name": "Room 404",
            "category_id": cat_id,
            "serial_number": "R404",
            "acquisition_date": str(date.today()),
            "location": "Floor 4",
            "is_shared_bookable": True
        }
        res_asset = self.client.post("/api/assets", json=asset_payload, headers=admin_headers)
        asset_id = res_asset.json()["id"]

        # Book room tomorrow 09:00 - 10:00
        tomorrow_date = datetime.utcnow().date() + timedelta(days=1)
        t_start = datetime.combine(tomorrow_date, datetime.min.time()).replace(hour=9, minute=0)
        t_end = datetime.combine(tomorrow_date, datetime.min.time()).replace(hour=10, minute=0)

        book_payload = {
            "asset_id": asset_id,
            "start_time": str(t_start),
            "end_time": str(t_end)
        }
        res_book = self.client.post("/api/bookings", json=book_payload, headers=emp_headers)
        self.assertEqual(res_book.status_code, 200)
        self.assertEqual(res_book.json()["status"], "Upcoming")

        # Overlapping Booking check: book 09:30 - 10:30 -> Should fail
        overlap_payload = {
            "asset_id": asset_id,
            "start_time": str(t_start + timedelta(minutes=30)),
            "end_time": str(t_end + timedelta(minutes=30))
        }
        res_fail = self.client.post("/api/bookings", json=overlap_payload, headers=emp_headers)
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn("overlaps with booking", res_fail.json()["detail"])

        # Adjacent Booking check: book 10:00 - 11:00 -> Should pass
        adjacent_payload = {
            "asset_id": asset_id,
            "start_time": str(t_end),
            "end_time": str(t_end + timedelta(hours=1))
        }
        res_pass = self.client.post("/api/bookings", json=adjacent_payload, headers=emp_headers)
        self.assertEqual(res_pass.status_code, 200)

    def test_06_maintenance_requests(self):
        admin_headers = self.signup_and_login("Admin", "admin@org.com", "pwd")
        emp_headers = self.signup_and_login("Staff", "staff@org.com", "pwd")

        # Setup Category & Asset
        res_cat = self.client.post("/api/org/categories", json={"name": "Furniture"}, headers=admin_headers)
        cat_id = res_cat.json()["id"]

        res_asset = self.client.post("/api/assets", json={
            "name": "Desk Desk",
            "category_id": cat_id,
            "serial_number": "DSK123",
            "acquisition_date": str(date.today()),
            "location": "HQ",
        }, headers=admin_headers)
        asset_id = res_asset.json()["id"]

        # Raise Maintenance Request
        maint_payload = {
            "asset_id": asset_id,
            "description": "Leg is broken",
            "priority": "High"
        }
        res_mreq = self.client.post("/api/maintenance", json=maint_payload, headers=emp_headers)
        self.assertEqual(res_mreq.status_code, 200)
        self.assertEqual(res_mreq.json()["status"], "Pending")
        mreq_id = res_mreq.json()["id"]

        # Approved by Asset Manager/Admin
        res_appr = self.client.put(f"/api/maintenance/{mreq_id}", json={
            "status": "Approved",
            "assigned_technician": "Bob the Builder"
        }, headers=admin_headers)
        self.assertEqual(res_appr.status_code, 200)
        self.assertEqual(res_appr.json()["status"], "Approved")

        # Asset status should now be Under Maintenance
        res_check_asset = self.client.get(f"/api/assets/{asset_id}", headers=admin_headers)
        self.assertEqual(res_check_asset.json()["status"], "Under Maintenance")

        # Resolve request
        res_resolve = self.client.put(f"/api/maintenance/{mreq_id}", json={
            "status": "Resolved",
            "resolved_notes": "Leg fixed and bolted."
        }, headers=admin_headers)
        self.assertEqual(res_resolve.status_code, 200)

        # Asset status should revert to Available
        res_check_asset2 = self.client.get(f"/api/assets/{asset_id}", headers=admin_headers)
        self.assertEqual(res_check_asset2.json()["status"], "Available")
        self.assertEqual(res_check_asset2.json()["condition"], "Good")

    def test_07_asset_audits(self):
        admin_headers = self.signup_and_login("Admin", "admin@org.com", "pwd")
        
        # Setup Category & Asset
        res_cat = self.client.post("/api/org/categories", json={"name": "Furniture"}, headers=admin_headers)
        cat_id = res_cat.json()["id"]

        # Create two assets
        asset1 = self.client.post("/api/assets", json={
            "name": "Auditable Desk A", "category_id": cat_id, "serial_number": "S1", "location": "HQ Room X",
            "acquisition_date": str(date.today())
        }, headers=admin_headers).json()
        
        asset2 = self.client.post("/api/assets", json={
            "name": "Auditable Desk B", "category_id": cat_id, "serial_number": "S2", "location": "HQ Room X",
            "acquisition_date": str(date.today())
        }, headers=admin_headers).json()

        # Retrieve Admin Employee ID
        users_resp = self.client.get("/api/org/employees", headers=admin_headers)
        admin_id = [u for u in users_resp.json() if u["email"] == "admin@org.com"][0]["id"]

        # Create Audit Cycle
        cycle_payload = {
            "name": "HQ Q4 Furniture Audit",
            "scope_type": "Location",
            "scope_value": "Room X",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=5)),
            "auditor_ids": [admin_id]
        }
        res_cycle = self.client.post("/api/audits/cycles", json=cycle_payload, headers=admin_headers)
        self.assertEqual(res_cycle.status_code, 200)
        cycle_id = res_cycle.json()["id"]

        # Log Result - asset1: Missing, asset2: Damaged
        res_log1 = self.client.post(f"/api/audits/cycles/{cycle_id}/results/{asset1['id']}", json={
            "status": "Missing", "notes": "No desk found at workstation."
        }, headers=admin_headers)
        self.assertEqual(res_log1.status_code, 200)

        res_log2 = self.client.post(f"/api/audits/cycles/{cycle_id}/results/{asset2['id']}", json={
            "status": "Damaged", "notes": "Surface scratches and loose screws."
        }, headers=admin_headers)
        self.assertEqual(res_log2.status_code, 200)

        # Discrepancy report check
        discrepancies = self.client.get(f"/api/audits/cycles/{cycle_id}/discrepancies", headers=admin_headers)
        self.assertEqual(len(discrepancies.json()), 2)

        # Close Audit Cycle
        res_close = self.client.post(f"/api/audits/cycles/{cycle_id}/close", headers=admin_headers)
        self.assertEqual(res_close.status_code, 200)
        self.assertEqual(res_close.json()["processed_missing"], 1)
        self.assertEqual(res_close.json()["processed_damaged"], 1)

        # Verify asset statuses post cycle closure
        # asset1 (Missing) -> Lost
        res_check1 = self.client.get(f"/api/assets/{asset1['id']}", headers=admin_headers)
        self.assertEqual(res_check1.json()["status"], "Lost")

        # asset2 (Damaged) -> Under Maintenance (with auto-maintenance request)
        res_check2 = self.client.get(f"/api/assets/{asset2['id']}", headers=admin_headers)
        self.assertEqual(res_check2.json()["status"], "Under Maintenance")
        self.assertEqual(res_check2.json()["condition"], "Poor")

        # Verify auto-maintenance ticket is created
        maint_list = self.client.get("/api/maintenance", headers=admin_headers).json()
        auto_ticket = [m for m in maint_list if m["asset_id"] == asset2["id"]]
        self.assertEqual(len(auto_ticket), 1)
        self.assertIn("Auto-generated repair ticket", auto_ticket[0]["description"])

    def test_08_reports_and_dashboard(self):
        admin_headers = self.signup_and_login("Admin", "admin@org.com", "pwd")

        # Verify Dashboard KPIs
        dash_res = self.client.get("/api/reports/dashboard", headers=admin_headers)
        self.assertEqual(dash_res.status_code, 200)
        self.assertIn("assets_available", dash_res.json())
        self.assertIn("assets_allocated", dash_res.json())

        # Verify Export Endpoints
        csv_assets = self.client.get("/api/reports/export/assets", headers=admin_headers)
        self.assertEqual(csv_assets.status_code, 200)
        self.assertIn("Asset Tag,Asset Name", csv_assets.text)

        csv_maint = self.client.get("/api/reports/export/maintenance", headers=admin_headers)
        self.assertEqual(csv_maint.status_code, 200)
        self.assertIn("ID,Asset Tag", csv_maint.text)


if __name__ == "__main__":
    unittest.main()
