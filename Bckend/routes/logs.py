from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user, require_admin

router = APIRouter(prefix="", tags=["Logs & Notifications"])

# --- HELPERS ---

def log_activity(db, user_id: Optional[int], action: str, entity_type: str, entity_id: Optional[int], details: Optional[str] = None):
    """Log user or system actions in the database."""
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES (%s, %s, %s, %s, %s)",
        (user_id, action, entity_type, entity_id, details)
    )
    db.commit()
    cursor.close()

def create_notification(db, user_id: int, message: str):
    """Create a new notification for a specific employee."""
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO notifications (user_id, message, is_read) VALUES (%s, %s, %s)",
        (user_id, message, False)
    )
    db.commit()
    cursor.close()


# --- ENDPOINTS ---

@router.get("/api/logs", response_model=List[schemas.ActivityLogResponse])
def get_activity_logs(db = Depends(get_db), current_user: SimpleNamespace = Depends(require_admin)):
    """Retrieve full history of system logs. Admin only."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT a.*, e.name as user_name 
           FROM activity_logs a 
           LEFT JOIN employees e ON a.user_id = e.id 
           ORDER BY a.created_at DESC"""
    )
    logs = cursor.fetchall()
    cursor.close()

    for l in logs:
        if not l.get("user_name"):
            l["user_name"] = "System"
            
    return logs

@router.get("/api/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(db = Depends(get_db), current_user: SimpleNamespace = Depends(get_current_active_user)):
    """Retrieve all notifications for the logged-in user."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC",
        (current_user.id,)
    )
    res = cursor.fetchall()
    cursor.close()
    return res

@router.post("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Mark a specific notification as read."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM notifications WHERE id = %s AND user_id = %s",
        (notification_id, current_user.id)
    )
    notification = cursor.fetchone()
    if not notification:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    cursor.execute(
        "UPDATE notifications SET is_read = %s WHERE id = %s",
        (True, notification_id)
    )
    db.commit()
    cursor.close()
    return {"message": "Notification marked as read"}
