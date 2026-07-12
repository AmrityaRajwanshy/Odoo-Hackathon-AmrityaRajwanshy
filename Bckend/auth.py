import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from types import SimpleNamespace

from database import get_db

# In-production, replace with a real secure environment variable
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-for-asset-management-system-12345")
# Token serializer
serializer = URLSafeTimedSerializer(SECRET_KEY)

# OAuth2PasswordBearer reads token from Authorization: Bearer <token>
# We set tokenUrl to our login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    """Hash password using PBKDF2 with a random salt."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password by re-hashing with the stored salt."""
    try:
        salt_hex, key_hex = hashed_password.split(":")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100000)
        return key == new_key
    except Exception:
        return False

def create_access_token(data: dict, expires_in_seconds: int = 86400) -> str:
    """Generate a signed URL-safe token with an expiration time."""
    payload = data.copy()
    payload["exp"] = (datetime.utcnow() + timedelta(seconds=expires_in_seconds)).timestamp()
    return serializer.dumps(payload, salt="auth-token")

def verify_access_token(token: str) -> Optional[dict]:
    """Verify token signature and expiration, returns the payload."""
    try:
        payload = serializer.loads(token, salt="auth-token")
        # Check explicit expiration timestamp just in case
        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
            return None
        return payload
    except (SignatureExpired, BadSignature):
        return None

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db = Depends(get_db)) -> SimpleNamespace:
    """Dependency to retrieve user from token, throws HTTP 401 if invalid."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = verify_access_token(token)
    if not payload:
        raise credentials_exception

    email = payload.get("email")
    if not email:
        raise credentials_exception

    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM employees WHERE email = %s", (email,))
    user_dict = cursor.fetchone()
    cursor.close()

    if not user_dict:
        raise credentials_exception

    return SimpleNamespace(**user_dict)

def get_current_active_user(current_user: SimpleNamespace = Depends(get_current_user)) -> SimpleNamespace:
    """Dependency ensuring the user is active."""
    if current_user.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive account"
        )
    return current_user

# Role check helper dependency generators

def require_role(roles: list[str]):
    def dependency(current_user: SimpleNamespace = Depends(get_current_active_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation forbidden. Required roles: {', '.join(roles)}"
            )
        return current_user
    return dependency

# Common role dependencies
require_admin = require_role(["Admin"])
require_asset_manager = require_role(["Admin", "Asset Manager"])
require_dept_head_or_manager = require_role(["Admin", "Asset Manager", "Department Head"])
