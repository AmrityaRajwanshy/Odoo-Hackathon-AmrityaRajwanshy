from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user, require_dept_head_or_manager
from routes.logs import log_activity, create_notification

router = APIRouter(prefix="/api/allocations", tags=["Asset Allocation & Transfer"])

# --- OVERDUE AUTO-FLAG HELPER ---

def sync_overdue_allocations(db):
    """Scan database for active allocations that have passed their expected return date
    and update their status to Overdue, triggering notifications.
    """
    now = datetime.utcnow()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT a.*, ast.name as asset_name, ast.asset_tag 
           FROM asset_allocations a 
           JOIN assets ast ON a.asset_id = ast.id
           WHERE a.status = 'Active' 
             AND a.expected_return_date IS NOT NULL 
             AND a.expected_return_date < %s""",
        (now,)
    )
    overdue_allocs = cursor.fetchall()

    for alloc in overdue_allocs:
        cursor.execute("UPDATE asset_allocations SET status = 'Overdue' WHERE id = %s", (alloc["id"],))
        
        # Notify the employee
        if alloc["employee_id"]:
            create_notification(
                db=db,
                user_id=alloc["employee_id"],
                message=f"Overdue return alert: Asset '{alloc['asset_name']}' ({alloc['asset_tag']}) was due on {alloc['expected_return_date'].strftime('%Y-%m-%d %H:%M')}."
            )
        
        # Notify Admin/Asset Managers
        cursor.execute("SELECT id FROM employees WHERE role IN ('Admin', 'Asset Manager')")
        managers = cursor.fetchall()
        
        # Determine holder info
        holder = "Unknown"
        if alloc["employee_id"]:
            cursor.execute("SELECT name FROM employees WHERE id = %s", (alloc["employee_id"],))
            emp = cursor.fetchone()
            if emp:
                holder = emp["name"]
        elif alloc["department_id"]:
            cursor.execute("SELECT name FROM departments WHERE id = %s", (alloc["department_id"],))
            dept = cursor.fetchone()
            if dept:
                holder = f"Department '{dept['name']}'"
                
        for m in managers:
            create_notification(
                db=db,
                user_id=m["id"],
                message=f"Overdue Alert: Asset {alloc['asset_tag']} (held by {holder}) is past its return date ({alloc['expected_return_date'].strftime('%Y-%m-%d')})."
            )
            
    if overdue_allocs:
        db.commit()
    cursor.close()


# --- ALLOCATION ENDPOINTS ---

@router.post("", response_model=schemas.AllocationResponse)
def allocate_asset(
    req: schemas.AllocationCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    # Perform overdue sync first
    sync_overdue_allocations(db)

    cursor = db.cursor(dictionary=True)

    # 1. Fetch Asset
    cursor.execute("SELECT * FROM assets WHERE id = %s", (req.asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    # 2. Check Conflict Rule: You can't allocate an asset that's already taken (non-Available)
    if asset["status"] != "Available":
        # Find active allocation
        cursor.execute(
            """SELECT a.*, e.name as emp_name, d.name as dept_name 
               FROM asset_allocations a
               LEFT JOIN employees e ON a.employee_id = e.id
               LEFT JOIN departments d ON a.department_id = d.id
               WHERE a.asset_id = %s AND a.status IN ('Active', 'Overdue')
               LIMIT 1""",
            (req.asset_id,)
        )
        active_alloc = cursor.fetchone()
        
        holder_name = "System"
        holder_id = None
        if active_alloc:
            if active_alloc["employee_id"]:
                holder_name = active_alloc["emp_name"]
                holder_id = active_alloc["employee_id"]
            elif active_alloc["department_id"]:
                holder_name = f"Department '{active_alloc['dept_name']}'"
                holder_id = active_alloc["department_id"]

        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Asset conflict",
                "message": f"Asset is currently held by {holder_name}.",
                "holder_name": holder_name,
                "holder_id": holder_id,
                "can_transfer": True
            }
        )

    # 3. Check targets
    if not req.employee_id and not req.department_id:
        cursor.close()
        raise HTTPException(status_code=400, detail="Must assign asset to an employee OR a department")

    emp = None
    if req.employee_id:
        cursor.execute("SELECT * FROM employees WHERE id = %s", (req.employee_id,))
        emp = cursor.fetchone()
        if not emp:
            cursor.close()
            raise HTTPException(status_code=404, detail="Target employee not found")
        if emp["status"] != "Active":
            cursor.close()
            raise HTTPException(status_code=400, detail="Cannot allocate to an inactive employee")

    dept = None
    if req.department_id:
        cursor.execute("SELECT * FROM departments WHERE id = %s", (req.department_id,))
        dept = cursor.fetchone()
        if not dept:
            cursor.close()
            raise HTTPException(status_code=404, detail="Target department not found")
        if dept["status"] != "Active":
            cursor.close()
            raise HTTPException(status_code=400, detail="Cannot allocate to an inactive department")

    # 4. Create Allocation record
    cursor.execute(
        """INSERT INTO asset_allocations (asset_id, employee_id, department_id, allocated_by_id, expected_return_date, status)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (req.asset_id, req.employee_id, req.department_id, current_user.id, req.expected_return_date, "Active")
    )
    new_id = cursor.lastrowid
    
    # Update Asset state
    cursor.execute(
        "UPDATE assets SET status = 'Allocated', current_holder_id = %s, current_department_id = %s WHERE id = %s",
        (req.employee_id, req.department_id, req.asset_id)
    )
    db.commit()

    # Retrieve inserted allocation
    cursor.execute("SELECT * FROM asset_allocations WHERE id = %s", (new_id,))
    new_alloc = cursor.fetchone()
    cursor.close()

    # Create Notifications
    recipient_name = emp["name"] if emp else f"Department {dept['name']}"
    log_activity(
        db=db,
        user_id=current_user.id,
        action="Allocate Asset",
        entity_type="Asset",
        entity_id=asset["id"],
        details=f"Allocated asset {asset['asset_tag']} to {recipient_name}. Expected Return: {req.expected_return_date}"
    )

    if req.employee_id:
        create_notification(
            db=db,
            user_id=req.employee_id,
            message=f"Asset assigned: The asset '{asset['name']}' ({asset['asset_tag']}) has been allocated to you by {current_user.name}."
        )

    return {
        **new_alloc,
        "asset_name": asset["name"],
        "asset_tag": asset["asset_tag"],
        "employee_name": emp["name"] if emp else None,
        "department_name": dept["name"] if dept else None,
        "allocated_by_name": current_user.name
    }


@router.get("", response_model=List[schemas.AllocationResponse])
def list_allocations(
    status_filter: Optional[str] = None,
    employee_id: Optional[int] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Retrieve history of allocations, syncing overdue allocations on the fly."""
    sync_overdue_allocations(db)
    
    cursor = db.cursor(dictionary=True)
    query = """SELECT a.*, ast.name as asset_name, ast.asset_tag, e.name as employee_name, d.name as department_name, ab.name as allocated_by_name
               FROM asset_allocations a
               JOIN assets ast ON a.asset_id = ast.id
               LEFT JOIN employees e ON a.employee_id = e.id
               LEFT JOIN departments d ON a.department_id = d.id
               LEFT JOIN employees ab ON a.allocated_by_id = ab.id
               WHERE 1=1"""
    params = []
    
    if status_filter:
        query += " AND a.status = %s"
        params.append(status_filter)
    if employee_id:
        query += " AND a.employee_id = %s"
        params.append(employee_id)

    query += " ORDER BY a.allocation_date DESC"
    
    cursor.execute(query, tuple(params))
    allocs = cursor.fetchall()
    cursor.close()
    return allocs


@router.post("/{allocation_id}/return", response_model=schemas.AllocationResponse)
def return_asset(
    allocation_id: int,
    req: schemas.AllocationReturn,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Process return of an asset, updating condition and reverting status to Available."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT a.*, ast.name as asset_name, ast.asset_tag, e.name as employee_name, d.name as department_name, ab.name as allocated_by_name
           FROM asset_allocations a
           JOIN assets ast ON a.asset_id = ast.id
           LEFT JOIN employees e ON a.employee_id = e.id
           LEFT JOIN departments d ON a.department_id = d.id
           LEFT JOIN employees ab ON a.allocated_by_id = ab.id
           WHERE a.id = %s""",
        (allocation_id,)
    )
    alloc = cursor.fetchone()
    if not alloc:
        cursor.close()
        raise HTTPException(status_code=404, detail="Allocation record not found")

    if alloc["status"] == "Returned":
        cursor.close()
        raise HTTPException(status_code=400, detail="Asset has already been returned")

    now = datetime.utcnow()
    # Update allocation record
    cursor.execute(
        """UPDATE asset_allocations 
           SET status = 'Returned', returned_date = %s, return_condition = %s, return_notes = %s 
           WHERE id = %s""",
        (now, req.return_condition, req.return_notes, allocation_id)
    )

    # Update Asset
    cursor.execute(
        """UPDATE assets 
           SET status = 'Available', `condition` = %s, current_holder_id = NULL, current_department_id = NULL 
           WHERE id = %s""",
        (req.return_condition, alloc["asset_id"])
    )
    db.commit()

    # Retrieve updated allocation
    cursor.execute("SELECT * FROM asset_allocations WHERE id = %s", (allocation_id,))
    updated_alloc = cursor.fetchone()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Return Asset",
        entity_type="Asset",
        entity_id=alloc["asset_id"],
        details=f"Asset returned: {alloc['asset_tag']}. Checked in condition: {req.return_condition}."
    )

    if alloc["employee_id"]:
        create_notification(
            db=db,
            user_id=alloc["employee_id"],
            message=f"Return confirmation: Your return for asset '{alloc['asset_name']}' ({alloc['asset_tag']}) has been confirmed."
        )

    return {
        **updated_alloc,
        "asset_name": alloc["asset_name"],
        "asset_tag": alloc["asset_tag"],
        "employee_name": alloc["employee_name"],
        "department_name": alloc["department_name"],
        "allocated_by_name": alloc["allocated_by_name"]
    }


# --- TRANSFER WORKFLOW ENDPOINTS ---

@router.post("/transfers", response_model=schemas.TransferRequestResponse)
def request_transfer(
    req: schemas.TransferRequestCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """File a request to transfer an asset currently assigned to another employee/dept."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM assets WHERE id = %s", (req.asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    # Verify target employee
    t_emp = None
    if req.target_employee_id:
        cursor.execute("SELECT * FROM employees WHERE id = %s", (req.target_employee_id,))
        t_emp = cursor.fetchone()
        if not t_emp:
            cursor.close()
            raise HTTPException(status_code=404, detail="Target employee not found")
        if t_emp["status"] != "Active":
            cursor.close()
            raise HTTPException(status_code=400, detail="Target employee is inactive")

    # Verify target department
    t_dept = None
    if req.target_department_id:
        cursor.execute("SELECT * FROM departments WHERE id = %s", (req.target_department_id,))
        t_dept = cursor.fetchone()
        if not t_dept:
            cursor.close()
            raise HTTPException(status_code=404, detail="Target department not found")
        if t_dept["status"] != "Active":
            cursor.close()
            raise HTTPException(status_code=400, detail="Target department is inactive")

    if not req.target_employee_id and not req.target_department_id:
        cursor.close()
        raise HTTPException(status_code=400, detail="Must specify target employee or department")

    # Create transfer request
    cursor.execute(
        """INSERT INTO transfer_requests (asset_id, requested_by_id, target_employee_id, target_department_id, notes, status)
           VALUES (%s, %s, %s, %s, %s, 'Pending')""",
        (req.asset_id, current_user.id, req.target_employee_id, req.target_department_id, req.notes)
    )
    db.commit()
    new_id = cursor.lastrowid

    # Notify managers about pending transfer
    cursor.execute("SELECT id FROM employees WHERE role IN ('Admin', 'Asset Manager')")
    managers = cursor.fetchall()
    for m in managers:
        create_notification(
            db=db,
            user_id=m["id"],
            message=f"Transfer request: {current_user.name} requested transfer of '{asset['name']}' ({asset['asset_tag']}). Approval required."
        )

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Request Transfer",
        entity_type="Asset",
        entity_id=asset["id"],
        details=f"Transfer requested for asset {asset['asset_tag']} to employee ID {req.target_employee_id}"
    )

    cursor.execute("SELECT * FROM transfer_requests WHERE id = %s", (new_id,))
    new_trsf = cursor.fetchone()
    cursor.close()

    return {
        **new_trsf,
        "asset_name": asset["name"],
        "asset_tag": asset["asset_tag"],
        "requested_by_name": current_user.name,
        "target_employee_name": t_emp["name"] if t_emp else None,
        "target_department_name": t_dept["name"] if t_dept else None
    }


@router.get("/transfers", response_model=List[schemas.TransferRequestResponse])
def list_transfer_requests(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT t.*, ast.name as asset_name, ast.asset_tag, rb.name as requested_by_name, 
                  te.name as target_employee_name, td.name as target_department_name, ab.name as approved_by_name
           FROM transfer_requests t
           JOIN assets ast ON t.asset_id = ast.id
           JOIN employees rb ON t.requested_by_id = rb.id
           LEFT JOIN employees te ON t.target_employee_id = te.id
           LEFT JOIN departments td ON t.target_department_id = td.id
           LEFT JOIN employees ab ON t.approved_by_id = ab.id
           ORDER BY t.created_at DESC"""
    )
    trsf_reqs = cursor.fetchall()
    cursor.close()
    return trsf_reqs


@router.post("/transfers/{transfer_id}/action")
def process_transfer(
    transfer_id: int,
    approve: bool, # True to approve, False to reject
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Approve or Reject a transfer request. Performs the actual reallocation on approval."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT t.*, ast.name as asset_name, ast.asset_tag,
                  te.name as target_employee_name, td.name as target_department_name
           FROM transfer_requests t
           JOIN assets ast ON t.asset_id = ast.id
           LEFT JOIN employees te ON t.target_employee_id = te.id
           LEFT JOIN departments td ON t.target_department_id = td.id
           WHERE t.id = %s""",
        (transfer_id,)
    )
    trsf = cursor.fetchone()
    if not trsf:
        cursor.close()
        raise HTTPException(status_code=404, detail="Transfer request not found")

    if trsf["status"] != "Pending":
        cursor.close()
        raise HTTPException(status_code=400, detail="Transfer request has already been processed")

    if not approve:
        cursor.execute("UPDATE transfer_requests SET status = 'Rejected', approved_by_id = %s WHERE id = %s", (current_user.id, transfer_id))
        db.commit()
        cursor.close()

        # Notify requester
        create_notification(
            db=db,
            user_id=trsf["requested_by_id"],
            message=f"Transfer rejected: Transfer request for asset '{trsf['asset_name']}' ({trsf['asset_tag']}) was rejected by {current_user.name}."
        )

        log_activity(
            db=db,
            user_id=current_user.id,
            action="Reject Transfer",
            entity_type="Asset",
            entity_id=trsf["asset_id"],
            details=f"Rejected transfer request ID {transfer_id} for asset {trsf['asset_tag']}"
        )
        return {"message": "Transfer request rejected"}

    # --- APPROVED PATH: PERFORM REALLOCATION ---
    
    # 1. Terminate active allocation
    cursor.execute(
        """SELECT * FROM asset_allocations 
           WHERE asset_id = %s AND status IN ('Active', 'Overdue')
           LIMIT 1""",
        (trsf["asset_id"],)
    )
    active_alloc = cursor.fetchone()

    now = datetime.utcnow()
    if active_alloc:
        target_name = trsf["target_employee_name"] if trsf["target_employee_id"] else trsf["target_department_name"]
        cursor.execute(
            """UPDATE asset_allocations 
               SET status = 'Returned', returned_date = %s, return_condition = 'Good (Transfer)', 
                   return_notes = %s 
               WHERE id = %s""",
            (now, f"Asset transferred to {target_name}", active_alloc["id"])
        )
        
        # Notify the former holder that the asset was transferred away
        if active_alloc["employee_id"]:
            create_notification(
                db=db,
                user_id=active_alloc["employee_id"],
                message=f"Asset transferred: Asset '{trsf['asset_name']}' ({trsf['asset_tag']}) previously assigned to you has been transferred to {trsf['target_employee_name'] if trsf['target_employee_id'] else 'another department'}."
            )

    # 2. Update Asset fields
    cursor.execute(
        "UPDATE assets SET status = 'Allocated', current_holder_id = %s, current_department_id = %s WHERE id = %s",
        (trsf["target_employee_id"], trsf["target_department_id"], trsf["asset_id"])
    )

    # 3. Create a NEW AssetAllocation for the target
    cursor.execute(
        """INSERT INTO asset_allocations (asset_id, employee_id, department_id, allocated_by_id, allocation_date, status)
           VALUES (%s, %s, %s, %s, %s, 'Active')""",
        (trsf["asset_id"], trsf["target_employee_id"], trsf["target_department_id"], current_user.id, now)
    )

    # 4. Update transfer request state
    cursor.execute(
        "UPDATE transfer_requests SET status = 'Approved', approved_by_id = %s WHERE id = %s",
        (current_user.id, transfer_id)
    )

    db.commit()
    cursor.close()

    # Notifications
    create_notification(
        db=db,
        user_id=trsf["requested_by_id"],
        message=f"Transfer approved: Your transfer request for '{trsf['asset_name']}' ({trsf['asset_tag']}) has been APPROVED. The asset is now reallocated."
    )
    
    if trsf["target_employee_id"]:
        create_notification(
            db=db,
            user_id=trsf["target_employee_id"],
            message=f"Asset assigned: The asset '{trsf['asset_name']}' ({trsf['asset_tag']}) has been transferred and allocated to you."
        )

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Approve Transfer",
        entity_type="Asset",
        entity_id=trsf["asset_id"],
        details=f"Approved transfer request ID {transfer_id} for asset {trsf['asset_tag']}. Reallocated target: Employee {trsf['target_employee_id']} / Dept {trsf['target_department_id']}"
    )

    return {"message": "Transfer request approved and asset reallocated"}
