# AssetFlow - Backend Documentation

This repository contains the backend for the **AssetFlow** application, a robust asset management system designed to track physical tech, operational resources, and facility check-outs. 

The backend is built with **FastAPI** (Python 3+) and interfaces directly with a **MySQL** database.

## Architecture & Tech Stack
*   **Framework:** FastAPI
*   **Database:** MySQL (Structured using raw SQL queries for optimized complex joins)
*   **Authentication:** JWT (JSON Web Tokens) with PBKDF2 password hashing
*   **Server:** Uvicorn (ASGI)

## Core Philosophy
The backend operates as a heavily enforced state machine. It prevents invalid asset lifecycles (e.g., trying to check out an asset that is currently "Lost" or "Under Maintenance"). It leverages strict Role-Based Access Control (RBAC) to ensure only authorized personnel can manually override statuses.

## File Structure & Routing
All business logic is modularized inside the `routes/` directory.

*   `main.py` - The FastAPI application entry point, CORS configuration, and route inclusions.
*   `create_database.py` - A utility script containing the entire foundational MySQL schema creation logic.
*   `database.py` - Database connection pooling and session management.
*   `auth.py` - Core JWT encryption, token verification, and role dependency checks (`require_admin`, `require_asset_manager`, `require_dept_head_or_manager`).
*   `schemas.py` - Pydantic definitions for payload validation and strict serialization.

### Functional Modules (`/routes/`)
*   **`auth.py`**: Handles signup, login, and token generation.
*   **`org.py`**: Organization setup (Departments, Categories) and Employee RBAC management.
*   **`assets.py`**: Core inventory CRUD (Registering, updating, and querying assets).
*   **`allocations.py`**: Manages long-term asset check-outs to employees/departments. Includes conflict detection and automated overdue handling.
*   **`bookings.py`**: Time-slotted reservation system for shared resources. Includes overlapping schedule conflict guards.
*   **`maintenance.py`**: Ticketing system for damaged items. Automatically flips asset status to "Under Maintenance" upon approval.
*   **`audits.py`**: Periodic bulk physical verification processes. Closing an audit auto-generates Lost/Damaged reports.
*   **`reports.py`**: Financial and operational KPI aggregation (Heatmaps, utilization tracking, CSV exports).
*   **`logs.py`**: The global event bus. Logs every action mapped to standard entity streams, and pushes direct alerts via notifications.

## Role-Based Access Control (RBAC)
The API strictly enforces 4 roles:
1.  **Admin**: Full global system access, employee management, and structural configuration (Setup).
2.  **Asset Manager**: Can create assets, approve tickets, perform audits, and authorize transfers.
3.  **Department Head**: Can view department financials and handle intra-department workflows.
4.  **Employee**: The baseline role. Can search the directory, book resources, and raise repair requests, but cannot modify system state.

## Running Locally
Ensure MySQL is running and your `.env` contains the correct database credentials.

```bash
# 1. Install dependencies
pip install fastapi uvicorn mysql-connector-python pydantic python-jose passlib bcrypt python-multipart itsdangerous

# 2. Run the server (auto-reloading enabled)
uvicorn main:app --reload
```
The API documentation is accessible natively via Swagger UI at `http://127.0.0.1:8000/docs`.
