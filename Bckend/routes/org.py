import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user, require_admin
from routes.logs import log_activity, create_notification

router = APIRouter(prefix="/api/org", tags=["Organization Setup"])

# --- HELPERS ---

def get_department_by_id(db, dept_id: int):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT d.*, h.name as head_name, p.name as parent_name 
           FROM departments d 
           LEFT JOIN employees h ON d.department_head_id = h.id 
           LEFT JOIN departments p ON d.parent_department_id = p.id
           WHERE d.id = %s""",
        (dept_id,)
    )
    res = cursor.fetchone()
    cursor.close()
    return res

def make_category_response(cat_dict) -> schemas.AssetCategoryResponse:
    fields_dict = {}
    if cat_dict.get("fields_schema"):
        try:
            if isinstance(cat_dict["fields_schema"], str):
                fields_dict = json.loads(cat_dict["fields_schema"])
            else:
                fields_dict = cat_dict["fields_schema"]
        except Exception:
            pass
    return schemas.AssetCategoryResponse(
        id=cat_dict["id"],
        name=cat_dict["name"],
        description=cat_dict.get("description"),
        fields_schema=fields_dict,
        created_at=cat_dict["created_at"]
    )


# --- TAB A: DEPARTMENT MANAGEMENT ---

@router.post("/departments", response_model=schemas.DepartmentResponse)
def create_department(req: schemas.DepartmentCreate, db = Depends(get_db), current_user: SimpleNamespace = Depends(require_admin)):
    cursor = db.cursor(dictionary=True)
    
    # Check duplicate
    cursor.execute("SELECT id FROM departments WHERE name = %s", (req.name,))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with name '{req.name}' already exists"
        )

    # If head is specified, check if they exist
    if req.department_head_id:
        cursor.execute("SELECT id, role FROM employees WHERE id = %s", (req.department_head_id,))
        head = cursor.fetchone()
        if not head:
            cursor.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee ID {req.department_head_id} not found"
            )

    # If parent is specified, check if it exists
    if req.parent_department_id:
        cursor.execute("SELECT id FROM departments WHERE id = %s", (req.parent_department_id,))
        parent = cursor.fetchone()
        if not parent:
            cursor.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent Department ID {req.parent_department_id} not found"
            )

    cursor.execute(
        "INSERT INTO departments (name, department_head_id, parent_department_id, status) VALUES (%s, %s, %s, %s)",
        (req.name, req.department_head_id, req.parent_department_id, req.status or "Active")
    )
    db.commit()
    new_id = cursor.lastrowid
    cursor.close()

    # If head is assigned, update their role to Department Head
    if req.department_head_id:
        cursor2 = db.cursor(dictionary=True)
        cursor2.execute("SELECT id, role FROM employees WHERE id = %s", (req.department_head_id,))
        head_user = cursor2.fetchone()
        if head_user and head_user["role"] == "Employee":
            cursor2.execute("UPDATE employees SET role = 'Department Head' WHERE id = %s", (req.department_head_id,))
            db.commit()
        cursor2.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Create Department",
        entity_type="Department",
        entity_id=new_id,
        details=f"Created department: {req.name}"
    )

    return get_department_by_id(db, new_id)


@router.get("/departments", response_model=List[schemas.DepartmentResponse])
def list_departments(db = Depends(get_db), current_user: SimpleNamespace = Depends(get_current_active_user)):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT d.*, h.name as head_name, p.name as parent_name 
           FROM departments d 
           LEFT JOIN employees h ON d.department_head_id = h.id 
           LEFT JOIN departments p ON d.parent_department_id = p.id"""
    )
    depts = cursor.fetchall()
    cursor.close()
    return depts


@router.get("/departments/{dept_id}", response_model=schemas.DepartmentResponse)
def get_department(dept_id: int, db = Depends(get_db), current_user: SimpleNamespace = Depends(get_current_active_user)):
    dept = get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.put("/departments/{dept_id}", response_model=schemas.DepartmentResponse)
def update_department(
    dept_id: int,
    req: schemas.DepartmentUpdate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_admin)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM departments WHERE id = %s", (dept_id,))
    dept = cursor.fetchone()
    if not dept:
        cursor.close()
        raise HTTPException(status_code=404, detail="Department not found")

    if req.name is not None:
        cursor.execute("SELECT id FROM departments WHERE name = %s AND id != %s", (req.name, dept_id))
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            raise HTTPException(status_code=400, detail="Department name already exists")
        cursor.execute("UPDATE departments SET name = %s WHERE id = %s", (req.name, dept_id))

    if req.department_head_id is not None:
        if req.department_head_id == 0:
            cursor.execute("UPDATE departments SET department_head_id = NULL WHERE id = %s", (dept_id,))
        else:
            cursor.execute("SELECT * FROM employees WHERE id = %s", (req.department_head_id,))
            head = cursor.fetchone()
            if not head:
                cursor.close()
                raise HTTPException(status_code=404, detail="Employee not found")
            
            cursor.execute("UPDATE departments SET department_head_id = %s WHERE id = %s", (req.department_head_id, dept_id))
            # Auto update employee role if they are regular employee
            if head["role"] == "Employee":
                cursor.execute("UPDATE employees SET role = 'Department Head' WHERE id = %s", (req.department_head_id,))
                create_notification(db, head["id"], f"You have been promoted to Department Head of {dept['name']}")

    if req.parent_department_id is not None:
        if req.parent_department_id == 0:
            cursor.execute("UPDATE departments SET parent_department_id = NULL WHERE id = %s", (dept_id,))
        else:
            if req.parent_department_id == dept_id:
                cursor.close()
                raise HTTPException(status_code=400, detail="A department cannot be its own parent")
            cursor.execute("SELECT id FROM departments WHERE id = %s", (req.parent_department_id,))
            parent = cursor.fetchone()
            if not parent:
                cursor.close()
                raise HTTPException(status_code=404, detail="Parent department not found")
            cursor.execute("UPDATE departments SET parent_department_id = %s WHERE id = %s", (req.parent_department_id, dept_id))

    if req.status is not None:
        cursor.execute("UPDATE departments SET status = %s WHERE id = %s", (req.status, dept_id))

    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Update Department",
        entity_type="Department",
        entity_id=dept_id,
        details=f"Updated department {dept['name']} parameters"
    )

    return get_department_by_id(db, dept_id)


# --- TAB B: ASSET CATEGORY MANAGEMENT ---

@router.post("/categories", response_model=schemas.AssetCategoryResponse)
def create_category(
    req: schemas.AssetCategoryCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_admin)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM asset_categories WHERE name = %s", (req.name,))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        raise HTTPException(status_code=400, detail="Category name already exists")

    schema_str = json.dumps(req.fields_schema) if req.fields_schema else None
    cursor.execute(
        "INSERT INTO asset_categories (name, description, fields_schema) VALUES (%s, %s, %s)",
        (req.name, req.description, schema_str)
    )
    db.commit()
    new_id = cursor.lastrowid

    cursor.execute("SELECT * FROM asset_categories WHERE id = %s", (new_id,))
    new_cat = cursor.fetchone()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Create Category",
        entity_type="AssetCategory",
        entity_id=new_cat["id"],
        details=f"Created asset category: {new_cat['name']}"
    )

    return make_category_response(new_cat)


@router.get("/categories", response_model=List[schemas.AssetCategoryResponse])
def list_categories(db = Depends(get_db), current_user: SimpleNamespace = Depends(get_current_active_user)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM asset_categories")
    cats = cursor.fetchall()
    cursor.close()
    return [make_category_response(c) for c in cats]


@router.get("/categories/{cat_id}", response_model=schemas.AssetCategoryResponse)
def get_category(cat_id: int, db = Depends(get_db), current_user: SimpleNamespace = Depends(get_current_active_user)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM asset_categories WHERE id = %s", (cat_id,))
    cat = cursor.fetchone()
    cursor.close()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return make_category_response(cat)


@router.put("/categories/{cat_id}", response_model=schemas.AssetCategoryResponse)
def update_category(
    cat_id: int,
    req: schemas.AssetCategoryUpdate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_admin)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM asset_categories WHERE id = %s", (cat_id,))
    cat = cursor.fetchone()
    if not cat:
        cursor.close()
        raise HTTPException(status_code=404, detail="Category not found")

    if req.name is not None:
        cursor.execute("SELECT id FROM asset_categories WHERE name = %s AND id != %s", (req.name, cat_id))
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            raise HTTPException(status_code=400, detail="Category name already exists")
        cursor.execute("UPDATE asset_categories SET name = %s WHERE id = %s", (req.name, cat_id))

    if req.description is not None:
        cursor.execute("UPDATE asset_categories SET description = %s WHERE id = %s", (req.description, cat_id))

    if req.fields_schema is not None:
        cursor.execute("UPDATE asset_categories SET fields_schema = %s WHERE id = %s", (json.dumps(req.fields_schema), cat_id))

    db.commit()
    cursor.execute("SELECT * FROM asset_categories WHERE id = %s", (cat_id,))
    updated_cat = cursor.fetchone()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Update Category",
        entity_type="AssetCategory",
        entity_id=cat_id,
        details=f"Updated asset category {cat['name']}"
    )

    return make_category_response(updated_cat)


# --- TAB C: EMPLOYEE DIRECTORY ---

@router.get("/employees", response_model=List[schemas.EmployeeResponse])
def list_employees(
    department_id: Optional[int] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM employees WHERE 1=1"
    params = []
    
    if department_id is not None:
        query += " AND department_id = %s"
        params.append(department_id)
    if role is not None:
        query += " AND role = %s"
        params.append(role)
    if status_filter is not None:
        query += " AND status = %s"
        params.append(status_filter)

    cursor.execute(query, tuple(params))
    employees = cursor.fetchall()
    cursor.close()
    return employees


@router.put("/employees/{emp_id}", response_model=schemas.EmployeeResponse)
def update_employee(
    emp_id: int,
    req: schemas.EmployeeUpdate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_admin)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM employees WHERE id = %s", (emp_id,))
    emp = cursor.fetchone()
    if not emp:
        cursor.close()
        raise HTTPException(status_code=404, detail="Employee not found")

    if req.name is not None:
        cursor.execute("UPDATE employees SET name = %s WHERE id = %s", (req.name, emp_id))
    if req.email is not None:
        cursor.execute("SELECT id FROM employees WHERE email = %s AND id != %s", (req.email, emp_id))
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            raise HTTPException(status_code=400, detail="Email is already used by another employee")
        cursor.execute("UPDATE employees SET email = %s WHERE id = %s", (req.email, emp_id))

    old_role = emp["role"]
    if req.role is not None:
        if req.role not in ["Admin", "Asset Manager", "Department Head", "Employee"]:
            cursor.close()
            raise HTTPException(status_code=400, detail="Invalid role specified")
        cursor.execute("UPDATE employees SET role = %s WHERE id = %s", (req.role, emp_id))

    if req.department_id is not None:
        if req.department_id == 0:
            cursor.execute("UPDATE employees SET department_id = NULL WHERE id = %s", (emp_id,))
        else:
            cursor.execute("SELECT id FROM departments WHERE id = %s", (req.department_id,))
            dept = cursor.fetchone()
            if not dept:
                cursor.close()
                raise HTTPException(status_code=404, detail="Department not found")
            cursor.execute("UPDATE employees SET department_id = %s WHERE id = %s", (req.department_id, emp_id))

    if req.status is not None:
        if req.status not in ["Active", "Inactive"]:
            cursor.close()
            raise HTTPException(status_code=400, detail="Invalid status specified")
        if emp_id == current_user.id and req.status == "Inactive":
            cursor.close()
            raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account")
        cursor.execute("UPDATE employees SET status = %s WHERE id = %s", (req.status, emp_id))

    db.commit()

    # Send notification if role changed
    if req.role and req.role != old_role:
        create_notification(db, emp_id, f"Your role has been updated from {old_role} to {req.role} by an Administrator.")

    cursor.execute("SELECT * FROM employees WHERE id = %s", (emp_id,))
    updated_emp = cursor.fetchone()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Update Employee Details",
        entity_type="Employee",
        entity_id=emp_id,
        details=f"Admin updated employee: {updated_emp['email']}. Role: {old_role} -> {updated_emp['role']}. Status: {updated_emp['status']}"
    )

    return updated_emp
