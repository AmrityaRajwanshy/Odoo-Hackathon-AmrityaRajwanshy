from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user, require_asset_manager
from routes.logs import log_activity, create_notification

router = APIRouter(prefix="/api/audits", tags=["Asset Audit Screen"])

# --- HELPERS ---

def get_scope_assets(db, scope_type: str, scope_value: Optional[str]) -> List[dict]:
    """Retrieve assets falling within the defined audit scope."""
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM assets WHERE status != 'Disposed'"
    params = []
    if scope_type == "Department" and scope_value:
        try:
            dept_id = int(scope_value)
            query += " AND current_department_id = %s"
            params.append(dept_id)
        except ValueError:
            pass
    elif scope_type == "Location" and scope_value:
        query += " AND location LIKE %s"
        params.append(f"%{scope_value}%")
    cursor.execute(query, tuple(params))
    res = cursor.fetchall()
    cursor.close()
    return res

def get_cycle_by_id(db, cycle_id: int):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM audit_cycles WHERE id = %s", (cycle_id,))
    cycle = cursor.fetchone()
    if not cycle:
        cursor.close()
        return None
    # Fetch auditors
    cursor.execute(
        """SELECT e.* 
           FROM audit_assignments a 
           JOIN employees e ON a.auditor_id = e.id 
           WHERE a.audit_cycle_id = %s""",
        (cycle_id,)
    )
    auditors = cursor.fetchall()
    cursor.close()
    return {
        **cycle,
        "auditors": auditors
    }


# --- CYCLES CRUD ---

@router.post("/cycles", response_model=schemas.AuditCycleResponse)
def create_audit_cycle(
    req: schemas.AuditCycleCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_asset_manager)
):
    cursor = db.cursor(dictionary=True)
    
    # Verify auditors
    for uid in req.auditor_ids:
        cursor.execute("SELECT id FROM employees WHERE id = %s", (uid,))
        if not cursor.fetchone():
            cursor.close()
            raise HTTPException(status_code=404, detail=f"Auditor ID {uid} not found")

    cursor.execute(
        """INSERT INTO audit_cycles (name, scope_type, scope_value, start_date, end_date, status)
           VALUES (%s, %s, %s, %s, %s, 'Active')""",
        (req.name, req.scope_type, req.scope_value, req.start_date, req.end_date)
    )
    db.commit()
    new_id = cursor.lastrowid

    # Add auditor assignments
    for uid in req.auditor_ids:
        cursor.execute(
            "INSERT INTO audit_assignments (audit_cycle_id, auditor_id) VALUES (%s, %s)",
            (new_id, uid)
        )
        create_notification(db, uid, f"You have been assigned to audit cycle '{req.name}' ({req.start_date} to {req.end_date}).")
    
    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Create Audit Cycle",
        entity_type="AuditCycle",
        entity_id=new_id,
        details=f"Created audit cycle '{req.name}' scoped to {req.scope_type}:{req.scope_value}"
    )

    return get_cycle_by_id(db, new_id)


@router.get("/cycles", response_model=List[schemas.AuditCycleResponse])
def list_audit_cycles(
    status_filter: Optional[str] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    cursor = db.cursor(dictionary=True)
    query = "SELECT * FROM audit_cycles WHERE 1=1"
    params = []
    if status_filter:
        query += " AND status = %s"
        params.append(status_filter)
    query += " ORDER BY start_date DESC"
    cursor.execute(query, tuple(params))
    cycles = cursor.fetchall()
    cursor.close()
    
    return [get_cycle_by_id(db, c["id"]) for c in cycles]


@router.get("/cycles/{cycle_id}", response_model=schemas.AuditCycleResponse)
def get_audit_cycle(
    cycle_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    cycle = get_cycle_by_id(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    return cycle


@router.get("/cycles/{cycle_id}/assets-in-scope", response_model=List[schemas.AssetResponse])
def get_assets_in_scope(
    cycle_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Retrieve all assets that are scheduled for checking under this cycle's scope."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM audit_cycles WHERE id = %s", (cycle_id,))
    cycle = cursor.fetchone()
    cursor.close()
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    
    from routes.assets import make_asset_response, get_asset_by_id
    assets = get_scope_assets(db, cycle["scope_type"], cycle["scope_value"])
    return [make_asset_response(get_asset_by_id(db, a["id"])) for a in assets]


# --- AUDITOR ACTIONS ---

@router.post("/cycles/{cycle_id}/results/{asset_id}", response_model=schemas.AuditAssetResultResponse)
def submit_audit_result(
    cycle_id: int,
    asset_id: int,
    req: schemas.AuditAssetResultCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Allows an assigned auditor (or Admin/Asset Manager) to report check findings on a specific asset."""
    cursor = db.cursor(dictionary=True)

    # 1. Fetch Cycle & check state
    cursor.execute("SELECT * FROM audit_cycles WHERE id = %s", (cycle_id,))
    cycle = cursor.fetchone()
    if not cycle:
        cursor.close()
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    if cycle["status"] == "Closed":
        cursor.close()
        raise HTTPException(status_code=400, detail="Cannot log results on a closed audit cycle")

    # 2. Check if auditor is assigned (or Admin/Asset Manager)
    cursor.execute(
        "SELECT id FROM audit_assignments WHERE audit_cycle_id = %s AND auditor_id = %s LIMIT 1",
        (cycle_id, current_user.id)
    )
    is_assigned = cursor.fetchone()
    if not is_assigned and current_user.role not in ["Admin", "Asset Manager"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned as an auditor for this cycle"
        )

    # 3. Check asset existence
    cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    # 4. Check if asset falls inside the scope
    scope_assets = get_scope_assets(db, cycle["scope_type"], cycle["scope_value"])
    scope_asset_ids = [sa["id"] for sa in scope_assets]
    if asset["id"] not in scope_asset_ids:
        cursor.close()
        raise HTTPException(status_code=400, detail="This asset does not belong to the scope of this audit cycle")

    if req.status not in ["Verified", "Missing", "Damaged"]:
        cursor.close()
        raise HTTPException(status_code=400, detail="Status must be Verified, Missing, or Damaged")

    # 5. Check if result already registered for this cycle + asset
    cursor.execute(
        "SELECT id FROM audit_asset_results WHERE audit_cycle_id = %s AND asset_id = %s LIMIT 1",
        (cycle_id, asset_id)
    )
    existing_result = cursor.fetchone()

    now = datetime.utcnow()
    if existing_result:
        # Update
        cursor.execute(
            """UPDATE audit_asset_results 
               SET status = %s, notes = %s, audited_by_id = %s, audited_at = %s 
               WHERE id = %s""",
            (req.status, req.notes, current_user.id, now, existing_result["id"])
        )
        res_id = existing_result["id"]
    else:
        # Create
        cursor.execute(
            """INSERT INTO audit_asset_results (audit_cycle_id, asset_id, audited_by_id, status, notes, audited_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (cycle_id, asset_id, current_user.id, req.status, req.notes, now)
        )
        res_id = cursor.lastrowid

    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Submit Audit Result",
        entity_type="AuditCycle",
        entity_id=cycle_id,
        details=f"Audited asset {asset['asset_tag']}. Result: {req.status}. Notes: {req.notes}"
    )

    # Retrieve updated result with joined details
    cursor2 = db.cursor(dictionary=True)
    cursor2.execute(
        """SELECT r.*, a.name as asset_name, a.asset_tag, e.name as audited_by_name
           FROM audit_asset_results r
           JOIN assets a ON r.asset_id = a.id
           LEFT JOIN employees e ON r.audited_by_id = e.id
           WHERE r.id = %s""",
        (res_id,)
    )
    res_dict = cursor2.fetchone()
    cursor2.close()

    return res_dict


# --- DISCREPANCY REPORTS ---

@router.get("/cycles/{cycle_id}/discrepancies", response_model=List[schemas.AuditDiscrepancyReport])
def generate_discrepancy_report(
    cycle_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Retrieve all assets in this cycle that have been flagged as Missing or Damaged."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM audit_cycles WHERE id = %s", (cycle_id,))
    if not cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=404, detail="Audit cycle not found")

    cursor.execute(
        """SELECT r.asset_id, a.name as asset_name, a.asset_tag, r.status, r.notes, 
                  e.name as audited_by_name, r.audited_at
           FROM audit_asset_results r
           JOIN assets a ON r.asset_id = a.id
           LEFT JOIN employees e ON r.audited_by_id = e.id
           WHERE r.audit_cycle_id = %s AND r.status IN ('Missing', 'Damaged')""",
        (cycle_id,)
    )
    flagged_results = cursor.fetchall()
    cursor.close()

    for r in flagged_results:
        if not r.get("audited_by_name"):
            r["audited_by_name"] = "System"
            
    return flagged_results


# --- CLOSURE CONTROL ---

@router.post("/cycles/{cycle_id}/close")
def close_audit_cycle(
    cycle_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_asset_manager)
):
    """Closes and locks the audit cycle, automatically executing discrepancy updates on the actual assets."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM audit_cycles WHERE id = %s", (cycle_id,))
    cycle = cursor.fetchone()
    if not cycle:
        cursor.close()
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    
    if cycle["status"] == "Closed":
        cursor.close()
        raise HTTPException(status_code=400, detail="Audit cycle is already closed")

    # Fetch audit results to process state updates
    cursor.execute(
        """SELECT r.*, a.name as asset_name, a.asset_tag 
           FROM audit_asset_results r 
           JOIN assets a ON r.asset_id = a.id 
           WHERE r.audit_cycle_id = %s""",
        (cycle_id,)
    )
    results = cursor.fetchall()

    missing_count = 0
    damaged_count = 0

    for r in results:
        asset_id = r["asset_id"]
        status_val = r["status"]
        notes_val = r["notes"] or ""
        audited_by_val = r["audited_by_id"] or current_user.id
        
        if status_val == "Missing":
            # Confirmed missing -> update asset lifecycle status to Lost
            cursor.execute("UPDATE assets SET status = 'Lost', current_holder_id = NULL, current_department_id = NULL WHERE id = %s", (asset_id,))
            missing_count += 1
            
        elif status_val == "Damaged":
            # Damaged -> update asset lifecycle condition and status to Under Maintenance
            cursor.execute("UPDATE assets SET `condition` = 'Poor', status = 'Under Maintenance', current_holder_id = NULL, current_department_id = NULL WHERE id = %s", (asset_id,))
            damaged_count += 1

            # Automatically raise a Maintenance Request
            desc = f"Auto-generated repair ticket from Audit Cycle '{cycle['name']}': Asset marked Damaged. Notes: {notes_val}"
            cursor.execute(
                """INSERT INTO maintenance_requests (asset_id, raised_by_id, description, priority, status)
                   VALUES (%s, %s, %s, 'Medium', 'Pending')""",
                (asset_id, audited_by_val, desc)
            )

    # Set cycle status to Closed
    cursor.execute("UPDATE audit_cycles SET status = 'Closed' WHERE id = %s", (cycle_id,))
    db.commit()

    # Notify managers and auditors
    msg = f"Audit cycle '{cycle['name']}' has been CLOSED. Processed: {missing_count} Lost assets, {damaged_count} Damaged assets sent for maintenance."
    
    # Notify all auditors on the cycle
    cursor.execute("SELECT auditor_id FROM audit_assignments WHERE audit_cycle_id = %s", (cycle_id,))
    assignments = cursor.fetchall()
    cursor.close()

    for assign in assignments:
        create_notification(db, assign["auditor_id"], msg)
        
    log_activity(
        db=db,
        user_id=current_user.id,
        action="Close Audit Cycle",
        entity_type="AuditCycle",
        entity_id=cycle_id,
        details=f"Closed audit cycle '{cycle['name']}'. Flags updated: {missing_count} Missing (Lost), {damaged_count} Damaged."
    )

    return {
        "message": "Audit cycle successfully closed and locked. Asset statuses updated.",
        "processed_missing": missing_count,
        "processed_damaged": damaged_count
    }
