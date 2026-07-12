import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user, require_asset_manager
from routes.logs import log_activity

router = APIRouter(prefix="/api/assets", tags=["Asset Registration & Directory"])

# --- HELPERS ---

def generate_asset_tag(db, category_name: str) -> str:
    """Generate an asset tag automatically based on category name.
    E.g. Electronics -> EL-0001, EL-0002.
    """
    prefix = "".join([c for c in category_name if c.isalpha()]).upper()[:2]
    if len(prefix) < 2:
        prefix = (prefix + "AS")[:2]
    
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT asset_tag FROM assets WHERE asset_tag LIKE %s", (f"{prefix}-%",))
    existing_tags = cursor.fetchall()
    cursor.close()
    
    max_num = 0
    for tag_dict in existing_tags:
        tag = tag_dict["asset_tag"]
        try:
            num = int(tag.split("-")[1])
            if num > max_num:
                max_num = num
        except Exception:
            pass
    next_num = max_num + 1
    return f"{prefix}-{next_num:04d}"

def get_asset_by_id(db, asset_id: int):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT a.*, c.name as category_name, e.name as current_holder_name, d.name as current_department_name
           FROM assets a
           LEFT JOIN asset_categories c ON a.category_id = c.id
           LEFT JOIN employees e ON a.current_holder_id = e.id
           LEFT JOIN departments d ON a.current_department_id = d.id
           WHERE a.id = %s""",
        (asset_id,)
    )
    res = cursor.fetchone()
    cursor.close()
    return res

def make_asset_response(asset_dict) -> schemas.AssetResponse:
    custom_vals = {}
    if asset_dict.get("custom_values"):
        try:
            if isinstance(asset_dict["custom_values"], str):
                custom_vals = json.loads(asset_dict["custom_values"])
            else:
                custom_vals = asset_dict["custom_values"]
        except Exception:
            pass
            
    return schemas.AssetResponse(
        id=asset_dict["id"],
        name=asset_dict["name"],
        category_id=asset_dict["category_id"],
        category_name=asset_dict.get("category_name"),
        asset_tag=asset_dict["asset_tag"],
        serial_number=asset_dict["serial_number"],
        acquisition_date=asset_dict["acquisition_date"],
        acquisition_cost=asset_dict["acquisition_cost"],
        condition=asset_dict["condition"],
        location=asset_dict["location"],
        photo_url=asset_dict.get("photo_url"),
        documents=asset_dict.get("documents"),
        custom_values=custom_vals,
        is_shared_bookable=bool(asset_dict.get("is_shared_bookable")),
        status=asset_dict["status"],
        current_holder_id=asset_dict.get("current_holder_id"),
        current_holder_name=asset_dict.get("current_holder_name"),
        current_department_id=asset_dict.get("current_department_id"),
        current_department_name=asset_dict.get("current_department_name"),
        created_at=asset_dict["created_at"]
    )


# --- ENDPOINTS ---

@router.post("", response_model=schemas.AssetResponse)
def register_asset(
    req: schemas.AssetCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_asset_manager)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT name FROM asset_categories WHERE id = %s", (req.category_id,))
    cat = cursor.fetchone()
    if not cat:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {req.category_id} not found"
        )

    # Generate tag
    asset_tag = generate_asset_tag(db, cat["name"])

    # Serialize custom fields schema validation
    custom_vals_str = None
    if req.custom_values:
        custom_vals_str = json.dumps(req.custom_values)

    cursor.execute(
        """INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, `condition`, location, photo_url, documents, is_shared_bookable, status, custom_values)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (req.name, req.category_id, asset_tag, req.serial_number, req.acquisition_date, req.acquisition_cost or 0.0, req.condition or "New", req.location, req.photo_url, req.documents, req.is_shared_bookable or False, "Available", custom_vals_str)
    )
    db.commit()
    new_id = cursor.lastrowid
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Register Asset",
        entity_type="Asset",
        entity_id=new_id,
        details=f"Registered new asset {req.name} (Tag: {asset_tag}, Category: {cat['name']})"
    )

    return make_asset_response(get_asset_by_id(db, new_id))


@router.get("", response_model=List[schemas.AssetResponse])
def search_assets(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    location: Optional[str] = None,
    is_shared_bookable: Optional[bool] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Search/filter assets across various attributes including QR scan match, serial, and location."""
    cursor = db.cursor(dictionary=True)
    query = """SELECT a.*, c.name as category_name, e.name as current_holder_name, d.name as current_department_name
               FROM assets a
               LEFT JOIN asset_categories c ON a.category_id = c.id
               LEFT JOIN employees e ON a.current_holder_id = e.id
               LEFT JOIN departments d ON a.current_department_id = d.id
               WHERE 1=1"""
    params = []
    
    if q:
        query += " AND (a.name LIKE %s OR a.asset_tag LIKE %s OR a.serial_number LIKE %s OR a.location LIKE %s)"
        like_q = f"%{q}%"
        params.extend([like_q, like_q, like_q, like_q])
    if category_id:
        query += " AND a.category_id = %s"
        params.append(category_id)
    if status:
        query += " AND a.status = %s"
        params.append(status)
    if department_id:
        query += " AND a.current_department_id = %s"
        params.append(department_id)
    if location:
        query += " AND a.location LIKE %s"
        params.append(f"%{location}%")
    if is_shared_bookable is not None:
        query += " AND a.is_shared_bookable = %s"
        params.append(int(is_shared_bookable))

    cursor.execute(query, tuple(params))
    assets = cursor.fetchall()
    cursor.close()
    return [make_asset_response(a) for a in assets]


@router.get("/{asset_id}", response_model=schemas.AssetResponse)
def get_asset_details(
    asset_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    asset = get_asset_by_id(db, asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )
    return make_asset_response(asset)


@router.put("/{asset_id}", response_model=schemas.AssetResponse)
def update_asset(
    asset_id: int,
    req: schemas.AssetUpdate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_asset_manager)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    if req.name is not None:
        cursor.execute("UPDATE assets SET name = %s WHERE id = %s", (req.name, asset_id))
    if req.category_id is not None:
        cursor.execute("SELECT name FROM asset_categories WHERE id = %s", (req.category_id,))
        if not cursor.fetchone():
            cursor.close()
            raise HTTPException(status_code=404, detail="Category not found")
        cursor.execute("UPDATE assets SET category_id = %s WHERE id = %s", (req.category_id, asset_id))
    if req.serial_number is not None:
        cursor.execute("UPDATE assets SET serial_number = %s WHERE id = %s", (req.serial_number, asset_id))
    if req.acquisition_date is not None:
        cursor.execute("UPDATE assets SET acquisition_date = %s WHERE id = %s", (req.acquisition_date, asset_id))
    if req.acquisition_cost is not None:
        cursor.execute("UPDATE assets SET acquisition_cost = %s WHERE id = %s", (req.acquisition_cost, asset_id))
    if req.condition is not None:
        cursor.execute("UPDATE assets SET `condition` = %s WHERE id = %s", (req.condition, asset_id))
    if req.location is not None:
        cursor.execute("UPDATE assets SET location = %s WHERE id = %s", (req.location, asset_id))
    if req.photo_url is not None:
        cursor.execute("UPDATE assets SET photo_url = %s WHERE id = %s", (req.photo_url, asset_id))
    if req.documents is not None:
        cursor.execute("UPDATE assets SET documents = %s WHERE id = %s", (req.documents, asset_id))
    if req.is_shared_bookable is not None:
        cursor.execute("UPDATE assets SET is_shared_bookable = %s WHERE id = %s", (int(req.is_shared_bookable), asset_id))
    if req.status is not None:
        cursor.execute("UPDATE assets SET status = %s WHERE id = %s", (req.status, asset_id))
    if req.custom_values is not None:
        cursor.execute("UPDATE assets SET custom_values = %s WHERE id = %s", (json.dumps(req.custom_values), asset_id))

    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Update Asset",
        entity_type="Asset",
        entity_id=asset_id,
        details=f"Updated asset details for: {asset['asset_tag']}"
    )

    return make_asset_response(get_asset_by_id(db, asset_id))


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_asset_manager)
):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    # Check if currently allocated or under maintenance
    if asset["status"] in ["Allocated", "Under Maintenance", "Reserved"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete asset because it is currently {asset['status']}"
        )

    tag = asset["asset_tag"]
    cursor.execute("DELETE FROM assets WHERE id = %s", (asset_id,))
    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Delete Asset",
        entity_type="Asset",
        entity_id=asset_id,
        details=f"Deleted asset with tag: {tag}"
    )

    return {"message": f"Asset {tag} has been deleted"}


@router.get("/{asset_id}/history")
def get_asset_history(
    asset_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Retrieve full allocation and maintenance logs for a specific asset."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Asset not found")

    cursor.execute(
        """SELECT a.*, e.name as employee_name, d.name as department_name, ab.name as allocated_by_name
           FROM asset_allocations a
           LEFT JOIN employees e ON a.employee_id = e.id
           LEFT JOIN departments d ON a.department_id = d.id
           LEFT JOIN employees ab ON a.allocated_by_id = ab.id
           WHERE a.asset_id = %s
           ORDER BY a.allocation_date DESC""",
        (asset_id,)
    )
    allocations = cursor.fetchall()

    cursor.execute(
        """SELECT m.*, rb.name as raised_by_name, ab.name as approved_by_name
           FROM maintenance_requests m
           LEFT JOIN employees rb ON m.raised_by_id = rb.id
           LEFT JOIN employees ab ON m.approved_by_id = ab.id
           WHERE m.asset_id = %s
           ORDER BY m.created_at DESC""",
        (asset_id,)
    )
    maintenance = cursor.fetchall()
    cursor.close()

    alloc_list = []
    for a in allocations:
        alloc_res = schemas.AllocationResponse.model_validate(a)
        alloc_res.asset_name = asset["name"]
        alloc_res.asset_tag = asset["asset_tag"]
        alloc_list.append(alloc_res)

    maint_list = []
    for m in maintenance:
        maint_res = schemas.MaintenanceRequestResponse.model_validate(m)
        maint_res.asset_name = asset["name"]
        maint_res.asset_tag = asset["asset_tag"]
        maint_list.append(maint_res)

    return {
        "asset_tag": asset["asset_tag"],
        "name": asset["name"],
        "allocations": alloc_list,
        "maintenance": maint_list
    }
