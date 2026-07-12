from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user, require_asset_manager
from routes.logs import log_activity, create_notification

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance Management"])

# --- HELPERS ---

def get_maint_by_id(db, req_id: int):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT m.*, a.name as asset_name, a.asset_tag, rb.name as raised_by_name, ab.name as approved_by_name
           FROM maintenance_requests m
           JOIN assets a ON m.asset_id = a.id
           LEFT JOIN employees rb ON m.raised_by_id = rb.id
           LEFT JOIN employees ab ON m.approved_by_id = ab.id
           WHERE m.id = %s""",
        (req_id,)
    )
    res = cursor.fetchone()
    cursor.close()
    return res


# --- ENDPOINTS ---

@router.post("", response_model=schemas.MaintenanceRequestResponse)
def raise_maintenance_request(
    req: schemas.MaintenanceRequestCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """File a request to fix a damaged or malfunctioning asset."""
    cursor = db.cursor(dictionary=True)

    # 1. Fetch Asset
    cursor.execute("SELECT * FROM assets WHERE id = %s", (req.asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    # 2. Check if asset status is Retired/Disposed
    if asset["status"] in ["Retired", "Disposed"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot raise maintenance for a {asset['status']} asset"
        )

    # 3. Create request
    cursor.execute(
        """INSERT INTO maintenance_requests (asset_id, raised_by_id, description, priority, photo_url, status)
           VALUES (%s, %s, %s, %s, %s, 'Pending')""",
        (req.asset_id, current_user.id, req.description, req.priority or "Medium", req.photo_url)
    )
    db.commit()
    new_id = cursor.lastrowid

    # Notify managers about new request
    cursor.execute("SELECT id FROM employees WHERE role IN ('Admin', 'Asset Manager')")
    managers = cursor.fetchall()
    for m in managers:
        create_notification(
            db=db,
            user_id=m["id"],
            message=f"New maintenance request: {current_user.name} reported '{req.description}' on asset {asset['asset_tag']}."
        )

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Raise Maintenance Request",
        entity_type="Asset",
        entity_id=asset["id"],
        details=f"Raised maintenance request ID {new_id} for asset {asset['asset_tag']} with priority {req.priority}."
    )
    cursor.close()

    return get_maint_by_id(db, new_id)


@router.get("", response_model=List[schemas.MaintenanceRequestResponse])
def list_maintenance_requests(
    asset_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """List all maintenance requests. Standard Employees only see requests they raised, Managers/Admin see all."""
    cursor = db.cursor(dictionary=True)
    query = """SELECT m.*, a.name as asset_name, a.asset_tag, rb.name as raised_by_name, ab.name as approved_by_name
               FROM maintenance_requests m
               JOIN assets a ON m.asset_id = a.id
               LEFT JOIN employees rb ON m.raised_by_id = rb.id
               LEFT JOIN employees ab ON m.approved_by_id = ab.id
               WHERE 1=1"""
    params = []

    # Access control
    if current_user.role not in ["Admin", "Asset Manager"]:
        query += " AND m.raised_by_id = %s"
        params.append(current_user.id)

    if asset_id:
        query += " AND m.asset_id = %s"
        params.append(asset_id)
    if status_filter:
        query += " AND m.status = %s"
        params.append(status_filter)
    if priority_filter:
        query += " AND m.priority = %s"
        params.append(priority_filter)

    query += " ORDER BY m.created_at DESC"

    cursor.execute(query, tuple(params))
    mreqs = cursor.fetchall()
    cursor.close()
    return mreqs


@router.get("/{req_id}", response_model=schemas.MaintenanceRequestResponse)
def get_maintenance_request(
    req_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    mreq = get_maint_by_id(db, req_id)
    if not mreq:
        raise HTTPException(status_code=404, detail="Maintenance request not found")

    # Access control
    if current_user.role not in ["Admin", "Asset Manager"] and mreq["raised_by_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this request")

    return mreq


@router.put("/{req_id}", response_model=schemas.MaintenanceRequestResponse)
def update_maintenance_workflow(
    req_id: int,
    req: schemas.MaintenanceRequestUpdate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_asset_manager)
):
    """Manage maintenance lifecycle (Pending -> Approved/Rejected -> In Progress -> Resolved)."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM maintenance_requests WHERE id = %s", (req_id,))
    mreq = cursor.fetchone()
    if not mreq:
        cursor.close()
        raise HTTPException(status_code=404, detail="Maintenance request not found")

    cursor.execute("SELECT * FROM assets WHERE id = %s", (mreq["asset_id"],))
    asset = cursor.fetchone()

    old_status = mreq["status"]
    new_status = req.status

    if new_status is not None:
        if new_status not in ["Approved", "Rejected", "In Progress", "Resolved"]:
            cursor.close()
            raise HTTPException(status_code=400, detail="Invalid status transition")
        
        # Guard against invalid transitions
        if old_status == "Resolved":
            cursor.close()
            raise HTTPException(status_code=400, detail="Request is already resolved and locked")
        if old_status == "Rejected":
            cursor.close()
            raise HTTPException(status_code=400, detail="Request is already rejected and locked")

        # Handle database state side-effects
        if new_status == "Approved":
            # Auto-update Asset status -> Under Maintenance
            cursor.execute("UPDATE assets SET status = 'Under Maintenance' WHERE id = %s", (asset["id"],))
            cursor.execute("UPDATE maintenance_requests SET approved_by_id = %s WHERE id = %s", (current_user.id, req_id))
            
            # Terminate active allocations if they exist
            cursor.execute(
                """SELECT * FROM asset_allocations 
                   WHERE asset_id = %s AND status IN ('Active', 'Overdue')
                   LIMIT 1""",
                (asset["id"],)
            )
            active_alloc = cursor.fetchone()
            if active_alloc:
                cursor.execute(
                    "UPDATE asset_allocations SET status = 'Returned', returned_date = %s, return_condition = 'Damaged (Sent for Repair)' WHERE id = %s",
                    (datetime.utcnow(), active_alloc["id"])
                )
                
                # Notify active holder
                if active_alloc["employee_id"]:
                    create_notification(
                        db=db,
                        user_id=active_alloc["employee_id"],
                        message=f"Asset recalled: Asset '{asset['name']}' ({asset['asset_tag']}) was recalled for repair."
                    )
                cursor.execute("UPDATE assets SET current_holder_id = NULL, current_department_id = NULL WHERE id = %s", (asset["id"],))

        elif new_status == "Resolved":
            # Revert Asset status -> Available
            cursor.execute("UPDATE assets SET status = 'Available', `condition` = 'Good' WHERE id = %s", (asset["id"],))
            if req.resolved_notes:
                cursor.execute("UPDATE maintenance_requests SET resolved_notes = %s WHERE id = %s", (req.resolved_notes, req_id))

        cursor.execute("UPDATE maintenance_requests SET status = %s WHERE id = %s", (new_status, req_id))

    if req.assigned_technician is not None:
        cursor.execute("UPDATE maintenance_requests SET assigned_technician = %s WHERE id = %s", (req.assigned_technician, req_id))

    if req.resolved_notes is not None and (new_status == "Resolved" or old_status == "Resolved"):
        cursor.execute("UPDATE maintenance_requests SET resolved_notes = %s WHERE id = %s", (req.resolved_notes, req_id))

    db.commit()
    cursor.close()

    # Notify requester about workflow update
    create_notification(
        db=db,
        user_id=mreq["raised_by_id"],
        message=f"Maintenance request update: Your request for asset '{asset['name']}' has been updated to '{new_status or old_status}'."
    )

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Update Maintenance Request Workflow",
        entity_type="Asset",
        entity_id=asset["id"],
        details=f"Maintenance ID {req_id} moved from {old_status} to {new_status or old_status}."
    )

    return get_maint_by_id(db, req_id)
