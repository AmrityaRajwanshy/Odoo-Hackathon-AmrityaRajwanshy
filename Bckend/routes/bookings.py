from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from types import SimpleNamespace

from database import get_db
import schemas
from auth import get_current_active_user
from routes.logs import log_activity, create_notification

router = APIRouter(prefix="/api/bookings", tags=["Resource Booking"])

# --- BOOKING STATUS SYNC & REMINDERS HELPER ---

def sync_bookings_and_remind(db):
    """Sync booking statuses (Upcoming/Ongoing/Completed) based on current time
    and generate reminder notifications for bookings starting in the next 15 minutes.
    """
    now = datetime.utcnow()
    cursor = db.cursor(dictionary=True)
    
    # 1. Upcoming -> Ongoing (if start_time <= now < end_time)
    cursor.execute(
        "UPDATE resource_bookings SET status = 'Ongoing' WHERE status = 'Upcoming' AND start_time <= %s AND end_time > %s",
        (now, now)
    )
    ongoing_updated = cursor.rowcount

    # 2. Upcoming/Ongoing -> Completed (if end_time <= now)
    cursor.execute(
        "UPDATE resource_bookings SET status = 'Completed' WHERE status IN ('Upcoming', 'Ongoing') AND end_time <= %s",
        (now,)
    )
    completed_updated = cursor.rowcount

    # 3. Reminder notifications for bookings starting in next 15 minutes
    reminder_window = now + timedelta(minutes=15)
    cursor.execute(
        """SELECT r.*, a.name as asset_name 
           FROM resource_bookings r 
           JOIN assets a ON r.asset_id = a.id 
           WHERE r.status = 'Upcoming' AND r.start_time > %s AND r.start_time <= %s""",
        (now, reminder_window)
    )
    upcoming_bookings = cursor.fetchall()

    for b in upcoming_bookings:
        reminder_msg = f"Reminder: Your booking for resource '{b['asset_name']}' is scheduled to start soon at {b['start_time'].strftime('%H:%M')}."
        
        cursor.execute(
            "SELECT id FROM notifications WHERE user_id = %s AND message = %s LIMIT 1",
            (b["booked_by_id"], reminder_msg)
        )
        existing_notif = cursor.fetchone()
        if not existing_notif:
            create_notification(db=db, user_id=b["booked_by_id"], message=reminder_msg)

    if ongoing_updated or completed_updated or upcoming_bookings:
        db.commit()
    cursor.close()


# --- ENDPOINTS ---

@router.post("", response_model=schemas.ResourceBookingResponse)
def create_booking(
    req: schemas.ResourceBookingCreate,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    # Sync status first
    sync_bookings_and_remind(db)

    cursor = db.cursor(dictionary=True)

    # 1. Fetch Asset (resource)
    cursor.execute("SELECT * FROM assets WHERE id = %s", (req.asset_id,))
    asset = cursor.fetchone()
    if not asset:
        cursor.close()
        raise HTTPException(status_code=404, detail="Resource not found")

    # 2. Validate bookability
    if not asset["is_shared_bookable"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This asset is not flagged as a shared/bookable resource"
        )
    if asset["status"] in ["Disposed", "Retired", "Lost"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resource is unavailable because its status is {asset['status']}"
        )

    # 3. Validate inputs
    if req.start_time >= req.end_time:
        cursor.close()
        raise HTTPException(status_code=400, detail="Start time must precede end time")
    if req.start_time < datetime.utcnow():
        cursor.close()
        raise HTTPException(status_code=400, detail="Cannot book in the past")

    # 4. Overlap Validation
    cursor.execute(
        """SELECT r.*, e.name as user_name 
           FROM resource_bookings r
           LEFT JOIN employees e ON r.booked_by_id = e.id
           WHERE r.asset_id = %s 
             AND r.status IN ('Upcoming', 'Ongoing')
             AND r.start_time < %s 
             AND r.end_time > %s
           LIMIT 1""",
        (req.asset_id, req.end_time, req.start_time)
    )
    overlap = cursor.fetchone()

    if overlap:
        user_name = overlap["user_name"] if overlap["user_name"] else "another employee"
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Time slot overlaps with booking by {user_name} ({overlap['start_time'].strftime('%H:%M')} - {overlap['end_time'].strftime('%H:%M')})"
        )

    # 5. Create Booking
    cursor.execute(
        """INSERT INTO resource_bookings (asset_id, booked_by_id, start_time, end_time, status)
           VALUES (%s, %s, %s, %s, 'Upcoming')""",
        (req.asset_id, current_user.id, req.start_time, req.end_time)
    )
    db.commit()
    new_id = cursor.lastrowid

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Create Booking",
        entity_type="Booking",
        entity_id=new_id,
        details=f"Booked resource {asset['name']} ({req.start_time} to {req.end_time})"
    )

    create_notification(
        db=db,
        user_id=current_user.id,
        message=f"Booking Confirmed: Resource '{asset['name']}' is booked for you on {req.start_time.strftime('%Y-%m-%d')} from {req.start_time.strftime('%H:%M')} to {req.end_time.strftime('%H:%M')}."
    )

    cursor.execute("SELECT * FROM resource_bookings WHERE id = %s", (new_id,))
    new_booking = cursor.fetchone()
    cursor.close()

    return {
        **new_booking,
        "asset_name": asset["name"],
        "booked_by_name": current_user.name
    }


@router.get("", response_model=List[schemas.ResourceBookingResponse])
def get_bookings(
    asset_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """List bookings with calendar-filtering supports."""
    sync_bookings_and_remind(db)

    cursor = db.cursor(dictionary=True)
    query = """SELECT r.*, a.name as asset_name, e.name as booked_by_name
               FROM resource_bookings r
               JOIN assets a ON r.asset_id = a.id
               JOIN employees e ON r.booked_by_id = e.id
               WHERE 1=1"""
    params = []
    
    if asset_id:
        query += " AND r.asset_id = %s"
        params.append(asset_id)
    if start_date:
        query += " AND r.start_time >= %s"
        params.append(start_date)
    if end_date:
        query += " AND r.end_time <= %s"
        params.append(end_date)

    query += " ORDER BY r.start_time ASC"

    cursor.execute(query, tuple(params))
    bookings = cursor.fetchall()
    cursor.close()
    return bookings


@router.put("/{booking_id}", response_model=schemas.ResourceBookingResponse)
def reschedule_booking(
    booking_id: int,
    start_time: datetime,
    end_time: datetime,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Reschedule an existing upcoming booking checking for conflicts."""
    sync_bookings_and_remind(db)

    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT r.*, a.name as asset_name
           FROM resource_bookings r
           JOIN assets a ON r.asset_id = a.id
           WHERE r.id = %s""",
        (booking_id,)
    )
    booking = cursor.fetchone()
    if not booking:
        cursor.close()
        raise HTTPException(status_code=404, detail="Booking not found")

    # Access control: only owner or admin can reschedule
    if booking["booked_by_id"] != current_user.id and current_user.role not in ["Admin", "Asset Manager"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reschedule this booking"
        )

    if booking["status"] not in ["Upcoming"]:
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule booking that has already started or is cancelled/completed"
        )

    if start_time >= end_time:
        cursor.close()
        raise HTTPException(status_code=400, detail="Start time must precede end time")
    if start_time < datetime.utcnow():
        cursor.close()
        raise HTTPException(status_code=400, detail="Cannot reschedule to the past")

    # Overlap checking (excluding this booking itself)
    cursor.execute(
        """SELECT r.*, e.name as user_name 
           FROM resource_bookings r
           LEFT JOIN employees e ON r.booked_by_id = e.id
           WHERE r.asset_id = %s 
             AND r.id != %s
             AND r.status IN ('Upcoming', 'Ongoing')
             AND r.start_time < %s 
             AND r.end_time > %s
           LIMIT 1""",
        (booking["asset_id"], booking_id, end_time, start_time)
    )
    overlap = cursor.fetchone()

    if overlap:
        user_name = overlap["user_name"] if overlap["user_name"] else "another employee"
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reschedule conflict: overlaps with booking by {user_name} ({overlap['start_time'].strftime('%H:%M')} - {overlap['end_time'].strftime('%H:%M')})"
        )

    cursor.execute(
        "UPDATE resource_bookings SET start_time = %s, end_time = %s WHERE id = %s",
        (start_time, end_time, booking_id)
    )
    db.commit()

    # Retrieve updated booking and booked_by name
    cursor.execute(
        """SELECT r.*, e.name as booked_by_name
           FROM resource_bookings r
           JOIN employees e ON r.booked_by_id = e.id
           WHERE r.id = %s""",
        (booking_id,)
    )
    updated_booking = cursor.fetchone()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Reschedule Booking",
        entity_type="Booking",
        entity_id=booking_id,
        details=f"Rescheduled resource {booking['asset_name']} to {start_time} - {end_time}"
    )

    create_notification(
        db=db,
        user_id=booking["booked_by_id"],
        message=f"Booking Updated: Rescheduled '{booking['asset_name']}' to {start_time.strftime('%Y-%m-%d %H:%M')}."
    )

    return {
        **updated_booking,
        "asset_name": booking["asset_name"]
    }


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Cancel a booking."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT r.*, a.name as asset_name
           FROM resource_bookings r
           JOIN assets a ON r.asset_id = a.id
           WHERE r.id = %s""",
        (booking_id,)
    )
    booking = cursor.fetchone()
    if not booking:
        cursor.close()
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["booked_by_id"] != current_user.id and current_user.role not in ["Admin", "Asset Manager"]:
        cursor.close()
        raise HTTPException(status_code=403, detail="You are not authorized to cancel this booking")

    if booking["status"] in ["Cancelled", "Completed"]:
        cursor.close()
        raise HTTPException(status_code=400, detail="Booking is already completed or cancelled")

    cursor.execute("UPDATE resource_bookings SET status = 'Cancelled' WHERE id = %s", (booking_id,))
    db.commit()
    cursor.close()

    log_activity(
        db=db,
        user_id=current_user.id,
        action="Cancel Booking",
        entity_type="Booking",
        entity_id=booking_id,
        details=f"Cancelled booking for resource {booking['asset_name']}"
    )

    create_notification(
        db=db,
        user_id=booking["booked_by_id"],
        message=f"Booking Cancelled: Your booking for resource '{booking['asset_name']}' was cancelled."
    )

    return {"message": "Booking has been cancelled"}
