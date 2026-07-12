from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class AssetBase(BaseModel):
    name: str
    category_id: int
    serial_number: str
    acquisition_date: date
    acquisition_cost: float
    condition: str
    location: str
    is_shared_bookable: Optional[bool] = False

class AssetCreate(AssetBase):
    pass  # Used when the frontend POSTs a new asset

class AssetResponse(AssetBase):
    id: int
    asset_tag: str
    lifecycle_status: str

    class Config:
        from_attributes = True  # Tells Pydantic to read SQLAlchemy models