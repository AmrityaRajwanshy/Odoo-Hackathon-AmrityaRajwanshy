import os
import mysql.connector
from dotenv import load_dotenv

# Load configuration from .env
load_dotenv()

MYSQL_USER = os.getenv("MYSQL_USER", "")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DB = os.getenv("MYSQL_DATABASE", "assetflow_db")

# NOTE: This seed data has been adapted to match the actual column names
# defined in the schema-creation script (e.g. `department_head_id` instead
# of `head_employee_id`, `status` instead of `lifecycle_status`,
# `allocated_by_id` instead of `allocated_by`, `start_time`/`end_time`
# instead of `booking_start`/`booking_end`, `audit_asset_results` instead
# of `audit_results`, etc). There is no standalone `asset_category_fields`
# table in the schema, so those dynamic-field definitions are stored as a
# JSON string in `asset_categories.fields_schema` instead.

sql_script = f"""
USE {MYSQL_DB};

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE notifications;
TRUNCATE TABLE audit_asset_results;
TRUNCATE TABLE audit_assignments;
TRUNCATE TABLE audit_cycles;
TRUNCATE TABLE maintenance_requests;
TRUNCATE TABLE resource_bookings;
TRUNCATE TABLE transfer_requests;
TRUNCATE TABLE asset_allocations;
TRUNCATE TABLE assets;
TRUNCATE TABLE asset_categories;
TRUNCATE TABLE departments;
TRUNCATE TABLE employees;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- DEPARTMENTS (includes a hierarchy + one Inactive department)
-- ============================================================
INSERT INTO departments (id, name, parent_department_id, status) VALUES
(1, 'Executive Office', NULL, 'Active'),
(2, 'Engineering', 1, 'Active'),
(3, 'QA', 2, 'Active'),
(4, 'Facilities', 1, 'Active'),
(5, 'Legacy Ops', NULL, 'Inactive');

-- ============================================================
-- EMPLOYEES (one of every role, plus edge cases)
-- ============================================================
INSERT INTO employees (id, name, email, password_hash, department_id, role, status) VALUES
(1, 'Amit Rawani',      'amit.admin@af.com',    '423308ccd7e9a7dc8f11de3dd7effda3:9424f1df090a05575592e2fb124dd2d7bbd0e7a4737c6c6b659648d4dd2aaeff', 1, 'Admin', 'Active'),
(2, 'Priya Ashwani',  'priya.mgr@af.com',     'c5477c3818ec0eb1ab31ae2c42b91144:932782a04687a70290c859c548137765ce298ae71e00e744b2eb31a3fd55ae65', 2, 'Asset Manager', 'Active'),
(3, 'Raj Shamani',    'raj.head@af.com',      '40629a0b644f73af18f9e346a1871115:19bb8fce26f2d34af6071eb896d77467b164b58d5ce71b3ecc0af1d4ccd7534f', 2, 'Employee', 'Active'),
(4, 'Sana Maity',   'sana.emp@af.com',      '40629a0b644f73af18f9e346a1871115:19bb8fce26f2d34af6071eb896d77467b164b58d5ce71b3ecc0af1d4ccd7534f', 3, 'Employee', 'Active'),
(5, 'Vikram Iyer', 'vikram.emp@af.com',    '40629a0b644f73af18f9e346a1871115:19bb8fce26f2d34af6071eb896d77467b164b58d5ce71b3ecc0af1d4ccd7534f', 4, 'Employee', 'Active'),
(6, 'Neha Chaturvedi',   'neha.inactive@af.com', '40629a0b644f73af18f9e346a1871115:19bb8fce26f2d34af6071eb896d77467b164b58d5ce71b3ecc0af1d4ccd7534f', 4, 'Employee', 'Inactive'),
(7, 'Karan Singhaniya',    'karan.nodept@af.com',  '40629a0b644f73af18f9e346a1871115:19bb8fce26f2d34af6071eb896d77467b164b58d5ce71b3ecc0af1d4ccd7534f', NULL, 'Employee', 'Active'),
(8, 'Deepa Sill',        'deepa.qa@af.com',      '40629a0b644f73af18f9e346a1871115:19bb8fce26f2d34af6071eb896d77467b164b58d5ce71b3ecc0af1d4ccd7534f', 3, 'Employee', 'Active');



-- ============================================================
-- ASSET CATEGORIES (dynamic fields stored as JSON in fields_schema)
-- ============================================================
INSERT INTO asset_categories (id, name, description, fields_schema) VALUES
(1, 'Electronics', 'Laptops, projectors, and other electronic equipment',
    '[{{"field_name": "Warranty Period (months)", "field_type": "Number"}}, {{"field_name": "Warranty Expiry", "field_type": "Date"}}]'),
(2, 'Furniture', 'Desks, chairs, and other office furniture', NULL),
(3, 'Vehicles', 'Company-owned vehicles',
    '[{{"field_name": "License Plate", "field_type": "String"}}, {{"field_name": "Insurance Expiry", "field_type": "Date"}}]'),
(4, 'Meeting Rooms', 'Bookable shared spaces', NULL);

-- ============================================================
-- ASSETS (covers every status at least once)
-- ============================================================
INSERT INTO assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, `condition`, location, is_shared_bookable, status) VALUES
(1,  'AF-0001', 'Dell Latitude Laptop', 1, 'SN-LAP-001', '2024-01-10', 85000.00,  'Good',    'HQ - Floor 2',      FALSE, 'Allocated'),
(2,  'AF-0002', 'Dell Latitude Laptop', 1, 'SN-LAP-002', '2024-01-10', 85000.00,  'Good',    'HQ - Floor 2',      FALSE, 'Available'),
(3,  'AF-0003', 'Conference Room B2',   4, 'SN-ROOM-B2', '2023-06-01', 0.00,      'Good',    'HQ - Floor 3',      TRUE,  'Available'),
(4,  'AF-0004', 'Office Chair',         2, 'SN-CHR-004', '2022-03-15', 6500.00,   'Worn',    'HQ - Floor 1',      FALSE, 'Under Maintenance'),
(5,  'AF-0005', 'Toyota Innova',        3, 'SN-VEH-005', '2021-11-20', 1450000.00,'Fair',    'Basement Parking',  TRUE,  'Reserved'),
(6,  'AF-0006', 'Projector Epson',      1, 'SN-PRJ-006', '2023-09-05', 42000.00,  'Good',    'HQ - Floor 3',      TRUE,  'Available'),
(7,  'AF-0007', 'MacBook Pro',          1, 'SN-LAP-007', '2020-02-01', 150000.00, 'Poor',    'HQ - Floor 2',      FALSE, 'Lost'),
(8,  'AF-0008', 'Standing Desk',        2, 'SN-DSK-008', '2019-05-10', 22000.00,  'Retired', 'Storage',           FALSE, 'Retired'),
(9,  'AF-0009', 'Old Server Rack',      1, 'SN-SRV-009', '2017-01-01', 300000.00, 'Disposed','Storage',           FALSE, 'Disposed'),
(10, 'AF-0010', 'Laptop - Not Bookable',1, 'SN-LAP-010', '2024-05-01', 90000.00,  'Good',    'HQ - Floor 2',      FALSE, 'Available');

-- ============================================================
-- ALLOCATIONS
-- ============================================================
-- AF-0001 currently held by Sana (Employee) -- used for double-allocation conflict test
INSERT INTO asset_allocations (id, asset_id, employee_id, department_id, allocated_by_id, allocation_date, expected_return_date, returned_date, status) VALUES
(1, 1, 4, NULL, 2, '2026-05-01', '2026-06-01', NULL, 'Active'); -- expected_return_date is in the PAST relative to 2026-07-12 -> overdue

-- A closed allocation (already returned) for history testing
INSERT INTO asset_allocations (id, asset_id, employee_id, department_id, allocated_by_id, allocation_date, expected_return_date, returned_date, status) VALUES
(2, 2, 7, NULL, 2, '2024-12-01', '2025-01-01', '2024-12-20', 'Returned');

-- Reflect current holders/departments on the assets table
UPDATE assets SET current_holder_id = 4 WHERE id = 1; -- Sana holds AF-0001
UPDATE assets SET current_department_id = 2 WHERE id = 5; -- Vehicle checked out under Engineering

-- ============================================================
-- TRANSFER REQUESTS
-- ============================================================
-- Raj wants AF-0001 which Sana already holds -> should be blocked at allocation, forcing this transfer path
INSERT INTO transfer_requests (id, asset_id, requested_by_id, target_employee_id, target_department_id, approved_by_id, status, notes) VALUES
(1, 1, 3, 3, NULL, NULL, 'Pending', 'Requesting transfer from Sana Employee to Raj Employee');

-- ============================================================
-- RESOURCE BOOKINGS (Room B2 = asset_id 3) -- crafted for overlap edge cases
-- ============================================================
-- Existing confirmed booking: 09:00-10:00 on 2026-07-20
INSERT INTO resource_bookings (id, asset_id, booked_by_id, start_time, end_time, status) VALUES
(1, 3, 4, '2026-07-20 09:00:00', '2026-07-20 10:00:00', 'Upcoming');

-- A cancelled booking that overlaps the same slot -- must NOT block new bookings
INSERT INTO resource_bookings (id, asset_id, booked_by_id, start_time, end_time, status) VALUES
(2, 3, 5, '2026-07-20 09:15:00', '2026-07-20 09:45:00', 'Cancelled');

-- A booking on the vehicle (asset 5) that is currently "Ongoing"
INSERT INTO resource_bookings (id, asset_id, booked_by_id, start_time, end_time, status) VALUES
(3, 5, 3, '2026-07-12 08:00:00', '2026-07-12 18:00:00', 'Ongoing');

-- ============================================================
-- MAINTENANCE REQUESTS (covers each workflow state)
-- ============================================================
INSERT INTO maintenance_requests (id, asset_id, raised_by_id, description, priority, status, assigned_technician, resolved_notes, approved_by_id) VALUES
(1, 4, 5, 'Chair armrest broken',        'Low',    'In Progress', 'Ramesh (Vendor)', NULL, 2),
(2, 1, 4, 'Laptop screen flickering',    'High',   'Pending',     NULL,               NULL, NULL),
(3, 6, 3, 'Projector bulb dead',         'Medium', 'Resolved',    'TechCorp Vendor',  'Bulb replaced under warranty', 2);

-- ============================================================
-- AUDIT CYCLES
-- ============================================================
INSERT INTO audit_cycles (id, name, scope_type, scope_value, start_date, end_date, status) VALUES
(1, 'Q2 2026 Engineering Audit', 'Department', 'Engineering', '2026-06-01', '2026-06-15', 'Active'),
(2, 'Q1 2026 Facilities Audit',  'Department', 'Facilities',  '2026-03-01', '2026-03-10', 'Closed');

INSERT INTO audit_assignments (id, audit_cycle_id, auditor_id) VALUES
(1, 1, 3),
(2, 1, 8);

-- One asset already verified in the active cycle -- used to test the UNIQUE(audit_cycle_id, asset_id) constraint
INSERT INTO audit_asset_results (id, audit_cycle_id, asset_id, audited_by_id, status, notes) VALUES
(1, 1, 1, 3, 'Verified', 'Present at desk, good condition');

-- Closed cycle with a Missing result -- used to confirm closing flips asset to Lost
INSERT INTO audit_asset_results (id, audit_cycle_id, asset_id, audited_by_id, status, notes) VALUES
(2, 2, 7, 8, 'Missing', 'Not found during physical count');

-- ============================================================
-- NOTIFICATIONS / LOGS (minimal seed)
-- ============================================================
INSERT INTO notifications (id, user_id, message, is_read) VALUES
(1, 4, 'Overdue Return Alert: Laptop AF-0001 was due back on 2026-06-01', FALSE);

INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details) VALUES
(1, 2, 'ALLOCATE', 'assets', 1, 'Allocated AF-0001 to Sana Employee');
"""


def populate_database():
    print(f"Connecting to MySQL server at {MYSQL_HOST}:{MYSQL_PORT}...")
    conn = None
    try:
        conn = mysql.connector.connect(
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            host=MYSQL_HOST,
            port=MYSQL_PORT
        )
        cursor = conn.cursor()

        print("Executing seed data queries...")
        cursor.execute(sql_script)
        if cursor.with_rows:
            cursor.fetchall()
        while cursor.nextset() is not None:
            if cursor.with_rows:
                cursor.fetchall()

        conn.commit()
        print(f"Database '{MYSQL_DB}' has been successfully populated with seed data!")

    except mysql.connector.Error as err:
        print(f"MySQL Error: {err}")
        if conn is not None:
            conn.rollback()
    finally:
        if conn is not None and conn.is_connected():
            cursor.close()
            conn.close()
            print("MySQL connection closed.")


if __name__ == "__main__":
    populate_database()
