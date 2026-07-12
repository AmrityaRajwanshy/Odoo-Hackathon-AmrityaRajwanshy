from fastapi import APIRouter, Depends, HTTPException, status
from itsdangerous import SignatureExpired, BadSignature
from types import SimpleNamespace

from database import get_db
import schemas
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    serializer,
    get_current_active_user
)
from routes.logs import log_activity, create_notification

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup", response_model=schemas.EmployeeResponse)
def signup(req: schemas.SignupRequest, db = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    
    # Check if email is already taken
    cursor.execute("SELECT id FROM employees WHERE email = %s", (req.email,))
    existing_user = cursor.fetchone()
    if existing_user:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Determine role: first user is Admin, others are Employee
    cursor.execute("SELECT COUNT(*) as count FROM employees")
    employee_count = cursor.fetchone()["count"]
    role = "Admin" if employee_count == 0 else "Employee"

    hashed_pwd = hash_password(req.password)
    cursor.execute(
        "INSERT INTO employees (name, email, password_hash, role, status) VALUES (%s, %s, %s, %s, %s)",
        (req.name, req.email, hashed_pwd, role, "Active")
    )
    db.commit()
    new_id = cursor.lastrowid

    # Retrieve the newly created employee
    cursor.execute("SELECT * FROM employees WHERE id = %s", (new_id,))
    new_employee = cursor.fetchone()
    cursor.close()

    # Log action
    log_activity(
        db=db,
        user_id=new_employee["id"],
        action="Signup",
        entity_type="Employee",
        entity_id=new_employee["id"],
        details=f"Employee signed up with email {req.email} and assigned role {role}"
    )

    create_notification(
        db=db,
        user_id=new_employee["id"],
        message=f"Welcome to the Asset Management System! Your role is {role}."
    )

    return new_employee


@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM employees WHERE email = %s", (req.email,))
    user = cursor.fetchone()
    cursor.close()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user["status"] != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently deactivated."
        )

    access_token = create_access_token(data={"email": user["email"], "id": user["id"]})

    # Log action
    log_activity(
        db=db,
        user_id=user["id"],
        action="Login",
        entity_type="Employee",
        entity_id=user["id"],
        details="User logged in successfully"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, email FROM employees WHERE email = %s", (req.email,))
    user = cursor.fetchone()
    cursor.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email address not found"
        )

    # Generate a temporary token valid for password reset
    reset_token = serializer.dumps({"email": user["email"]}, salt="reset-password")

    log_activity(
        db=db,
        user_id=user["id"],
        action="Forgot Password Request",
        entity_type="Employee",
        entity_id=user["id"],
        details="Generated reset password token"
    )

    return {
        "message": "Reset token generated successfully. Use this token to reset your password.",
        "reset_token": reset_token
    }


@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db = Depends(get_db)):
    # Verify the reset token
    try:
        payload = serializer.loads(req.token, salt="reset-password", max_age=3600)  # Token valid for 1 hour
    except (SignatureExpired, BadSignature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if payload.get("email") != req.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token does not match the provided email address"
        )

    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM employees WHERE email = %s", (req.email,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update password
    new_hash = hash_password(req.new_password)
    cursor.execute("UPDATE employees SET password_hash = %s WHERE id = %s", (new_hash, user["id"]))
    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=user["id"],
        action="Reset Password",
        entity_type="Employee",
        entity_id=user["id"],
        details="Password reset via token validation"
    )

    create_notification(
        db=db,
        user_id=user["id"],
        message="Your password was successfully reset."
    )

    return {"message": "Password has been successfully updated"}


@router.get("/me", response_model=schemas.EmployeeResponse)
def get_me(current_user: SimpleNamespace = Depends(get_current_active_user)):
    return current_user


from pydantic import BaseModel
from typing import Optional

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

@router.put("/profile")
def update_profile(
    req: UserProfileUpdate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    cursor = db.cursor(dictionary=True)
    if req.name is not None:
        cursor.execute("UPDATE employees SET name = %s WHERE id = %s", (req.name, current_user.id))
    if req.email is not None:
        cursor.execute("SELECT id FROM employees WHERE email = %s AND id != %s", (req.email, current_user.id))
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            raise HTTPException(status_code=400, detail="Email is already in use by another user")
        cursor.execute("UPDATE employees SET email = %s WHERE id = %s", (req.email, current_user.id))
    db.commit()
    cursor.close()
    return {"message": "Profile updated successfully"}
