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

sql_script = f"""
CREATE DATABASE IF NOT EXISTS {MYSQL_DB};
USE {MYSQL_DB};

-- ============================================================================
-- 1. ORGANIZATION & USERS
-- ============================================================================

CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    department_head_id INT NULL,
    parent_department_id INT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    department_id INT NULL,
    role VARCHAR(50) DEFAULT 'Employee',
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Set department head foreign key safely
ALTER TABLE departments ADD FOREIGN KEY (department_head_id) REFERENCES employees(id) ON DELETE SET NULL;


-- ============================================================================
-- 2. ASSETS & CATEGORIES
-- ============================================================================

CREATE TABLE asset_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    fields_schema TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category_id INT NOT NULL,
    asset_tag VARCHAR(50) NOT NULL UNIQUE,
    serial_number VARCHAR(100) NOT NULL,
    acquisition_date DATE NOT NULL,
    acquisition_cost FLOAT DEFAULT 0.0,
    `condition` VARCHAR(100) DEFAULT 'New',
    location VARCHAR(150) NOT NULL,
    photo_url VARCHAR(255) NULL,
    documents TEXT NULL,
    custom_values TEXT NULL,
    is_shared_bookable BOOLEAN DEFAULT FALSE,
    status VARCHAR(100) DEFAULT 'Available',
    current_holder_id INT NULL,
    current_department_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES asset_categories(id),
    FOREIGN KEY (current_holder_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (current_department_id) REFERENCES departments(id) ON DELETE SET NULL
);


-- ============================================================================
-- 3. ALLOCATIONS & TRANSFERS
-- ============================================================================

CREATE TABLE asset_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    employee_id INT NULL,
    department_id INT NULL,
    allocated_by_id INT NULL,
    allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_return_date TIMESTAMP NULL,
    returned_date TIMESTAMP NULL,
    return_condition VARCHAR(100) NULL,
    return_notes TEXT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (allocated_by_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE transfer_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    requested_by_id INT NOT NULL,
    target_employee_id INT NULL,
    target_department_id INT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    approved_by_id INT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (target_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (target_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_id) REFERENCES employees(id) ON DELETE SET NULL
);


-- ============================================================================
-- 4. SHARED RESOURCE BOOKINGS
-- ============================================================================

CREATE TABLE resource_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    booked_by_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status VARCHAR(50) DEFAULT 'Upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (booked_by_id) REFERENCES employees(id) ON DELETE CASCADE
);


-- ============================================================================
-- 5. MAINTENANCE & AUDITS
-- ============================================================================

CREATE TABLE maintenance_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    raised_by_id INT NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'Medium',
    photo_url VARCHAR(255) NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    assigned_technician VARCHAR(100) NULL,
    resolved_notes TEXT NULL,
    approved_by_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE audit_cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    scope_type VARCHAR(50) NOT NULL,
    scope_value VARCHAR(150) NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    audit_cycle_id INT NOT NULL,
    auditor_id INT NOT NULL,
    FOREIGN KEY (audit_cycle_id) REFERENCES audit_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (auditor_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE audit_asset_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    audit_cycle_id INT NOT NULL,
    asset_id INT NOT NULL,
    audited_by_id INT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT NULL,
    audited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_cycle_id) REFERENCES audit_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (audited_by_id) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE KEY unique_asset_audit (audit_cycle_id, asset_id)
);


-- ============================================================================
-- 6. SYSTEM LOGS & NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE SET NULL
);
"""

def create_database():
    print(f"Connecting to MySQL server at {MYSQL_HOST}:{MYSQL_PORT}...")
    try:
        # Establish connection without database context
        conn = mysql.connector.connect(
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            host=MYSQL_HOST,
            port=MYSQL_PORT
        )
        cursor = conn.cursor()
        
        print("Executing database schema queries...")
        cursor.execute(sql_script)        
        
        # Consume all statement results
        if cursor.with_rows:
            cursor.fetchall()
        while cursor.nextset() is not None:
            if cursor.with_rows:
                cursor.fetchall()
        
        conn.commit()
        print(f"Database '{MYSQL_DB}' and all required tables have been successfully created/updated!")
        
    except mysql.connector.Error as err:
        print(f"MySQL Error: {err}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
            print("MySQL connection closed.")

if __name__ == "__main__":
    create_database()
