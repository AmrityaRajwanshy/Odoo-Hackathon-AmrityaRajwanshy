from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from sqlalchemy import text

router = APIRouter(
    prefix="/assets",
    tags=["Assets"]
)

@router.post("/", response_model=schemas.AssetResponse, status_code=status.HTTP_201_CREATED)
def register_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    # 1. Basic duplicate check for serial number
    existing = db.execute(
        text("SELECT id FROM assets WHERE serial_number = :sn"), 
        {"sn": asset.serial_number}
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Serial number already registered")

    # 2. Automatically generate the Next Asset Tag (e.g., AF-0005)
    last_asset = db.execute(text("SELECT id FROM assets ORDER BY id DESC LIMIT 1")).fetchone()
    next_id = (last_asset[0] + 1) if last_asset else 1
    asset_tag = f"AF-{next_id:04d}"

    # 3. Insert into MySQL
    insert_query = text("""
        INSERT INTO assets (asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, `condition`, location, is_shared_bookable, lifecycle_status)
        VALUES (:tag, :name, :cat_id, :sn, :acq_date, :cost, :cond, :loc, :bookable, 'Available')
    """)
    
    db.execute(insert_query, {
        "tag": asset_tag, "name": asset.name, "cat_id": asset.category_id,
        "sn": asset.serial_number, "acq_date": asset.acquisition_date,
        "cost": asset.acquisition_cost, "cond": asset.condition, "loc": asset.location,
        "bookable": asset.is_shared_bookable
    })
    db.commit()

    # Fetch the newly inserted row to return it
    new_row = db.execute(text("SELECT * FROM assets WHERE asset_tag = :tag"), {"tag": asset_tag}).mappings().fetchone()
    return new_row