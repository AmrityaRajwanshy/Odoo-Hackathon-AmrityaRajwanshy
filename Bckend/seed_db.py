import json
from datetime import datetime, date, timedelta
from database import get_db_connection
from auth import hash_password

def seed_database():
    print("Resetting database...")
    db = get_db_connection()
    cursor = db.cursor()
    
    # Safely truncate/drop and recreate or just truncate/delete tables
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

    try:
        print("Seeding initial data...")
        
        # 1. Categories
        electronics_schema = {"warranty_months": "int", "ram_gb": "int"}
        furniture_schema = {"material": "str", "warranty_years": "int"}
        facilities_schema = {"capacity": "int", "projector": "bool"}
        
        categories = [
            ("Electronics", "Laptops, phones, monitors and accessories", json.dumps(electronics_schema)),
            ("Furniture", "Chairs, desks, conference tables", json.dumps(furniture_schema)),
            ("Facilities", "Conference rooms, training halls, parking slots", json.dumps(facilities_schema))
        ]
        
        cat_ids = {}
        for name, desc, schema in categories:
            cursor.execute("INSERT INTO asset_categories (name, description, fields_schema) VALUES (%s, %s, %s)", (name, desc, schema))
            cat_ids[name] = cursor.lastrowid
            
        # 2. Departments (temporary heads set to null)
        depts = [
            ("Engineering", None, None, "Active"),
            ("HR", None, None, "Active"),
            ("Finance", None, None, "Active")
        ]
        dept_ids = {}
        for name, head, parent, status in depts:
            cursor.execute("INSERT INTO departments (name, department_head_id, parent_department_id, status) VALUES (%s, %s, %s, %s)", (name, head, parent, status))
            dept_ids[name] = cursor.lastrowid
            
        # 3. Employees
        employees = [
            ("Alice Cooper", "admin@company.com", hash_password("admin123"), None, "Admin", "Active"),
            ("Bob Smith", "manager@company.com", hash_password("manager123"), None, "Asset Manager", "Active"),
            ("Charlie Brown", "depthead@company.com", hash_password("head123"), dept_ids["Engineering"], "Department Head", "Active"),
            ("Priya Patel", "employee@company.com", hash_password("emp123"), dept_ids["Engineering"], "Employee", "Active"),
            ("Raj Sharma", "raj@company.com", hash_password("raj123"), dept_ids["HR"], "Employee", "Active")
        ]
        
        emp_ids = {}
        for name, email, pwd_hash, dept_id, role, status in employees:
            cursor.execute("INSERT INTO employees (name, email, password_hash, department_id, role, status) VALUES (%s, %s, %s, %s, %s, %s)", (name, email, pwd_hash, dept_id, role, status))
            emp_ids[email] = cursor.lastrowid
            
        # Update Department Head for Engineering
        cursor.execute("UPDATE departments SET department_head_id = %s WHERE id = %s", (emp_ids["depthead@company.com"], dept_ids["Engineering"]))
        
        # 4. Assets
        today = date.today()
        assets = [
            ("Dell XPS Laptop", cat_ids["Electronics"], "EL-0001", "DELLXPS12345", today - timedelta(days=365), 1500.0, "Good", "HQ Floor 3", False, "Allocated", emp_ids["employee@company.com"], dept_ids["Engineering"], json.dumps({"warranty_months": 36, "ram_gb": 16})),
            ("LG 27 inch Monitor", cat_ids["Electronics"], "EL-0002", "LGMON8877", today - timedelta(days=200), 300.0, "New", "HQ Floor 3 - Room A", True, "Available", None, None, json.dumps({"warranty_months": 12})),
            ("Ergonomic Chair Desk Pro", cat_ids["Furniture"], "FU-0001", "CHAIR9900", today - timedelta(days=400), 250.0, "Fair", "HQ Floor 2", False, "Available", None, None, json.dumps({"material": "mesh", "warranty_years": 5})),
            ("Conference Room B2", cat_ids["Facilities"], "FA-0001", "ROOM-B2", today - timedelta(days=1000), 12000.0, "Good", "HQ Floor 2 - Wing B", True, "Available", None, None, json.dumps({"capacity": 12, "projector": True})),
            ("Old Macbook Pro 2018", cat_ids["Electronics"], "EL-0003", "APPLEMBP2018", today - timedelta(days=4*365), 2000.0, "Poor", "HQ Warehouse", False, "Available", None, None, json.dumps({"warranty_months": 12}))
        ]
        
        asset_ids = {}
        for name, cat_id, tag, sn, acq_date, cost, cond, loc, bookable, status, holder, dept, custom in assets:
            cursor.execute(
                """INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, `condition`, location, is_shared_bookable, status, current_holder_id, current_department_id, custom_values)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (name, cat_id, tag, sn, acq_date, cost, cond, loc, bookable, status, holder, dept, custom)
            )
            asset_ids[tag] = cursor.lastrowid
            
        # 5. Seed Asset Allocations
        now = datetime.utcnow()
        # Dell Laptop is allocated to Priya
        cursor.execute(
            """INSERT INTO asset_allocations (asset_id, employee_id, department_id, allocated_by_id, allocation_date, expected_return_date, status)
               VALUES (%s, %s, %s, %s, %s, %s, 'Active')""",
            (asset_ids["EL-0001"], emp_ids["employee@company.com"], dept_ids["Engineering"], emp_ids["manager@company.com"], now - timedelta(days=30), now + timedelta(days=60))
        )
        
        # Overdue allocation (Chair allocated to Raj)
        cursor.execute(
            """INSERT INTO asset_allocations (asset_id, employee_id, department_id, allocated_by_id, allocation_date, expected_return_date, status)
               VALUES (%s, %s, %s, %s, %s, %s, 'Active')""",
            (asset_ids["FU-0001"], emp_ids["raj@company.com"], dept_ids["HR"], emp_ids["manager@company.com"], now - timedelta(days=40), now - timedelta(days=5))
        )
        
        # 6. Bookings
        tomorrow = date.today() + timedelta(days=1)
        # Charlie Brown bookings
        start1 = datetime.combine(tomorrow, datetime.min.time()).replace(hour=9, minute=0)
        end1 = datetime.combine(tomorrow, datetime.min.time()).replace(hour=10, minute=0)
        cursor.execute(
            "INSERT INTO resource_bookings (asset_id, booked_by_id, start_time, end_time, status) VALUES (%s, %s, %s, %s, 'Upcoming')",
            (asset_ids["FA-0001"], emp_ids["depthead@company.com"], start1, end1)
        )
        
        # Priya Patel bookings
        start2 = datetime.combine(tomorrow, datetime.min.time()).replace(hour=10, minute=0)
        end2 = datetime.combine(tomorrow, datetime.min.time()).replace(hour=11, minute=0)
        cursor.execute(
            "INSERT INTO resource_bookings (asset_id, booked_by_id, start_time, end_time, status) VALUES (%s, %s, %s, %s, 'Upcoming')",
            (asset_ids["FA-0001"], emp_ids["employee@company.com"], start2, end2)
        )
        
        # 7. Maintenance
        cursor.execute(
            """INSERT INTO maintenance_requests (asset_id, raised_by_id, description, priority, status)
               VALUES (%s, %s, %s, 'High', 'Pending')""",
            (asset_ids["EL-0001"], emp_ids["employee@company.com"], "Laptop battery drains in 30 minutes, requires replacement.")
        )
        
        # 8. Audit cycle
        cursor.execute(
            """INSERT INTO audit_cycles (name, scope_type, scope_value, start_date, end_date, status)
               VALUES (%s, 'Department', %s, %s, %s, 'Active')""",
            ("Engineering Q3 Internal Asset Verification", str(dept_ids["Engineering"]), today - timedelta(days=2), today + timedelta(days=10))
        )
        cycle_id = cursor.lastrowid
        
        # Assign auditor
        cursor.execute(
            "INSERT INTO audit_assignments (audit_cycle_id, auditor_id) VALUES (%s, %s)",
            (cycle_id, emp_ids["manager@company.com"])
        )
        
        db.commit()
        print("Database seeding completed successfully.")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    seed_database()
