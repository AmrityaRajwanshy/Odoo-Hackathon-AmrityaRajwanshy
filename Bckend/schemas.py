from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# --- AUTH & EMPLOYEE SCHEMAS ---

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: "EmployeeResponse"


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


class EmployeeCreate(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "Employee"  # Admin, Asset Manager, Department Head, Employee
    department_id: Optional[int] = None
    status: Optional[str] = "Active"


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    status: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True



# --- DEPARTMENT SCHEMAS ---

class DepartmentCreate(BaseModel):
    name: str
    department_head_id: Optional[int] = None
    parent_department_id: Optional[int] = None
    status: Optional[str] = "Active"


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    department_head_id: Optional[int] = None
    parent_department_id: Optional[int] = None
    status: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    department_head_id: Optional[int] = None
    parent_department_id: Optional[int] = None
    status: str
    created_at: datetime
    # We will include head name and parent name manually or via custom resolvers if needed
    head_name: Optional[str] = None
    parent_name: Optional[str] = None

    class Config:
        from_attributes = True


# --- ASSET CATEGORY SCHEMAS ---

class AssetCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    fields_schema: Optional[Any] = None


class AssetCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    fields_schema: Optional[Any] = None


class AssetCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    fields_schema: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- ASSET SCHEMAS ---

class AssetCreate(BaseModel):
    name: str
    category_id: int
    serial_number: str
    acquisition_date: date
    acquisition_cost: Optional[float] = 0.0
    condition: Optional[str] = "New"  # New, Good, Fair, Poor
    location: str
    photo_url: Optional[str] = None
    documents: Optional[str] = None
    is_shared_bookable: Optional[bool] = False
    custom_values: Optional[Dict[str, Any]] = None  # key-value pairs mapping to category's fields_schema


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    serial_number: Optional[str] = None
    acquisition_date: Optional[date] = None
    acquisition_cost: Optional[float] = None
    condition: Optional[str] = None
    location: Optional[str] = None
    photo_url: Optional[str] = None
    documents: Optional[str] = None
    is_shared_bookable: Optional[bool] = None
    status: Optional[str] = None
    custom_values: Optional[Dict[str, Any]] = None


class AssetResponse(BaseModel):
    id: int
    name: str
    category_id: int
    category_name: Optional[str] = None
    asset_tag: str
    serial_number: str
    acquisition_date: date
    acquisition_cost: float
    condition: str
    location: str
    photo_url: Optional[str] = None
    documents: Optional[str] = None
    custom_values: Optional[Dict[str, Any]] = None
    is_shared_bookable: bool
    status: str
    current_holder_id: Optional[int] = None
    current_holder_name: Optional[str] = None
    current_department_id: Optional[int] = None
    current_department_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- ALLOCATION & TRANSFER SCHEMAS ---

class AllocationCreate(BaseModel):
    asset_id: int
    employee_id: Optional[int] = None
    department_id: Optional[int] = None
    expected_return_date: Optional[datetime] = None


class AllocationReturn(BaseModel):
    return_condition: str
    return_notes: Optional[str] = None


class AllocationResponse(BaseModel):
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    asset_tag: Optional[str] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    allocated_by_id: Optional[int] = None
    allocated_by_name: Optional[str] = None
    allocation_date: datetime
    expected_return_date: Optional[datetime] = None
    returned_date: Optional[datetime] = None
    return_condition: Optional[str] = None
    return_notes: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TransferRequestCreate(BaseModel):
    asset_id: int
    target_employee_id: Optional[int] = None
    target_department_id: Optional[int] = None
    notes: Optional[str] = None


class TransferRequestResponse(BaseModel):
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    asset_tag: Optional[str] = None
    requested_by_id: int
    requested_by_name: Optional[str] = None
    target_employee_id: Optional[int] = None
    target_employee_name: Optional[str] = None
    target_department_id: Optional[int] = None
    target_department_name: Optional[str] = None
    status: str
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- RESOURCE BOOKING SCHEMAS ---

class ResourceBookingCreate(BaseModel):
    asset_id: int
    start_time: datetime
    end_time: datetime


class ResourceBookingResponse(BaseModel):
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    booked_by_id: int
    booked_by_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- MAINTENANCE SCHEMAS ---

class MaintenanceRequestCreate(BaseModel):
    asset_id: int
    description: str
    priority: Optional[str] = "Medium"  # Low, Medium, High, Critical
    photo_url: Optional[str] = None


class MaintenanceRequestUpdate(BaseModel):
    status: Optional[str] = None  # Approved, Rejected, In Progress, Resolved
    assigned_technician: Optional[str] = None
    resolved_notes: Optional[str] = None


class MaintenanceRequestResponse(BaseModel):
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    asset_tag: Optional[str] = None
    raised_by_id: int
    raised_by_name: Optional[str] = None
    description: str
    priority: str
    photo_url: Optional[str] = None
    status: str
    assigned_technician: Optional[str] = None
    resolved_notes: Optional[str] = None
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- AUDIT SCHEMAS ---

class AuditCycleCreate(BaseModel):
    name: str
    scope_type: str  # Department, Location, All
    scope_value: Optional[str] = None
    start_date: date
    end_date: date
    auditor_ids: List[int]  # List of employee IDs assigned as auditors


class AuditCycleResponse(BaseModel):
    id: int
    name: str
    scope_type: str
    scope_value: Optional[str] = None
    start_date: date
    end_date: date
    status: str
    created_at: datetime
    auditors: List[EmployeeResponse] = []

    class Config:
        from_attributes = True


class AuditAssetResultCreate(BaseModel):
    status: str  # Verified, Missing, Damaged
    notes: Optional[str] = None


class AuditAssetResultResponse(BaseModel):
    id: int
    audit_cycle_id: int
    asset_id: int
    asset_name: Optional[str] = None
    asset_tag: Optional[str] = None
    audited_by_id: Optional[int] = None
    audited_by_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    audited_at: datetime

    class Config:
        from_attributes = True


class AuditDiscrepancyReport(BaseModel):
    asset_id: int
    asset_name: str
    asset_tag: str
    status: str  # The flagged status (Missing/Damaged)
    notes: Optional[str] = None
    audited_by_name: Optional[str] = None
    audited_at: datetime


# --- LOGS & NOTIFICATIONS ---

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Resolve circular dependencies in schemas
TokenResponse.model_rebuild()
