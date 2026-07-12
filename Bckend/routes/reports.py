import csv
import io
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from types import SimpleNamespace

from database import get_db
from auth import get_current_active_user, require_dept_head_or_manager

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

# --- DASHBOARD & ANALYTICS ENDPOINTS ---

@router.get("/utilization")
def get_utilization_trends(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Retrieve utilization trends: assets with high allocation/booking activity vs. unused ones."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, name, asset_tag, is_shared_bookable, status FROM assets WHERE status != 'Disposed'")
    assets = cursor.fetchall()
    
    utilization_list = []
    for a in assets:
        cursor.execute("SELECT COUNT(*) as count FROM asset_allocations WHERE asset_id = %s", (a["id"],))
        alloc_count = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM resource_bookings WHERE asset_id = %s", (a["id"],))
        booking_count = cursor.fetchone()["count"]
        
        total_uses = alloc_count + booking_count
        utilization_list.append({
            "id": a["id"],
            "name": a["name"],
            "asset_tag": a["asset_tag"],
            "is_shared_bookable": bool(a["is_shared_bookable"]),
            "status": a["status"],
            "allocations_count": alloc_count,
            "bookings_count": booking_count,
            "total_uses": total_uses
        })
    cursor.close()

    # Sort to find most used
    most_used = sorted(utilization_list, key=lambda x: x["total_uses"], reverse=True)[:5]
    # Idle assets (total uses is 0)
    idle = [x for x in utilization_list if x["total_uses"] == 0][:10]

    return {
        "most_used": most_used,
        "idle": idle
    }


@router.get("/maintenance-frequency")
def get_maintenance_frequency(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Retrieve maintenance request statistics grouped by asset and category."""
    cursor = db.cursor(dictionary=True)

    # Group by Asset
    cursor.execute(
        """SELECT a.name, a.asset_tag, COUNT(m.id) as count
           FROM assets a
           JOIN maintenance_requests m ON a.id = m.asset_id
           GROUP BY a.id
           ORDER BY count DESC"""
    )
    asset_maint = cursor.fetchall()

    # Group by Category
    cursor.execute(
        """SELECT c.name as category, COUNT(m.id) as count
           FROM asset_categories c
           JOIN assets a ON c.id = a.category_id
           JOIN maintenance_requests m ON a.id = m.asset_id
           GROUP BY c.id
           ORDER BY count DESC"""
    )
    category_maint = cursor.fetchall()
    cursor.close()

    return {
        "by_asset": [{"name": r["name"], "tag": r["asset_tag"], "count": r["count"]} for r in asset_maint],
        "by_category": [{"category": r["category"], "count": r["count"]} for r in category_maint]
    }


@router.get("/maintenance-and-retirement")
def get_due_maintenance_and_retirement(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Retrieve assets currently requiring maintenance or approaching their retirement window."""
    cursor = db.cursor(dictionary=True)
    three_years_ago = date.today() - timedelta(days=3 * 365)
    
    cursor.execute(
        "SELECT * FROM assets WHERE (acquisition_date < %s OR `condition` = 'Poor') AND status != 'Disposed'",
        (three_years_ago,)
    )
    retirement_assets = cursor.fetchall()

    cursor.execute("SELECT * FROM assets WHERE status = 'Under Maintenance'")
    due_maintenance = cursor.fetchall()
    cursor.close()

    retire_list = []
    for a in retirement_assets:
        age_years = round((date.today() - a["acquisition_date"]).days / 365.25, 1)
        retire_list.append({
            "id": a["id"],
            "name": a["name"],
            "asset_tag": a["asset_tag"],
            "acquisition_date": a["acquisition_date"],
            "age_years": age_years,
            "condition": a["condition"],
            "status": a["status"]
        })

    maint_list = []
    for a in due_maintenance:
        maint_list.append({
            "id": a["id"],
            "name": a["name"],
            "asset_tag": a["asset_tag"],
            "condition": a["condition"],
            "location": a["location"]
        })

    return {
        "due_for_maintenance": maint_list,
        "nearing_retirement": retire_list
    }


@router.get("/department-summary")
def get_department_allocations_summary(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Retrieve counts of currently allocated assets grouped by department."""
    cursor = db.cursor(dictionary=True)
    
    # Direct allocations to department
    cursor.execute(
        """SELECT d.name, COUNT(a.id) as allocated_count
           FROM departments d
           JOIN assets a ON d.id = a.current_department_id
           WHERE a.status = 'Allocated'
           GROUP BY d.id"""
    )
    summary = cursor.fetchall()

    # Employee-based allocations belonging to departments
    cursor.execute(
        """SELECT d.name, COUNT(a.id) as allocated_count
           FROM departments d
           JOIN employees e ON d.id = e.department_id
           JOIN assets a ON e.id = a.current_holder_id
           WHERE a.status = 'Allocated'
           GROUP BY d.id"""
    )
    emp_allocs = cursor.fetchall()
    cursor.close()

    # Consolidate
    dept_totals = {}
    for r in summary:
        dept_totals[r["name"]] = dept_totals.get(r["name"], 0) + r["allocated_count"]
    for r in emp_allocs:
        dept_totals[r["name"]] = dept_totals.get(r["name"], 0) + r["allocated_count"]

    return [{"department": k, "allocated_assets": v} for k, v in dept_totals.items()]


@router.get("/booking-heatmap")
def get_booking_heatmap(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Generates a booking heat map indicating hourly slots usage frequency."""
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT start_time, end_time FROM resource_bookings WHERE status != 'Cancelled'")
    bookings = cursor.fetchall()
    cursor.close()
    
    # Hour slots from 00:00 to 23:00
    hourly_slots = {f"{h:02d}:00": 0 for h in range(24)}

    for b in bookings:
        start_hour = b["start_time"].hour
        end_hour = b["end_time"].hour
        
        curr = start_hour
        while curr < end_hour and curr < 24:
            slot_key = f"{curr:02d}:00"
            hourly_slots[slot_key] += 1
            curr += 1

    return hourly_slots


# --- EXPORT REPORT ENDPOINTS (CSV STREAMING) ---

@router.get("/export/assets")
def export_assets_report(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Stream a CSV report of all assets."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT a.*, c.name as category_name
           FROM assets a
           LEFT JOIN asset_categories c ON a.category_id = c.id
           ORDER BY a.asset_tag ASC"""
    )
    assets = cursor.fetchall()
    cursor.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Asset Tag", "Asset Name", "Category", "Serial Number",
        "Acquisition Date", "Acquisition Cost", "Condition", "Location",
        "Bookable", "Status"
    ])

    for a in assets:
        writer.writerow([
            a["asset_tag"], a["name"], a["category_name"], a["serial_number"],
            a["acquisition_date"].strftime("%Y-%m-%d"), a["acquisition_cost"], a["condition"], a["location"],
            "Yes" if a["is_shared_bookable"] else "No", a["status"]
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=assets_report.csv"}
    )


@router.get("/export/maintenance")
def export_maintenance_report(
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(require_dept_head_or_manager)
):
    """Stream a CSV report of all maintenance requests."""
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT m.*, a.asset_tag, a.name as asset_name, rb.name as raised_by_name
           FROM maintenance_requests m
           JOIN assets a ON m.asset_id = a.id
           LEFT JOIN employees rb ON m.raised_by_id = rb.id
           ORDER BY m.created_at DESC"""
    )
    reqs = cursor.fetchall()
    cursor.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Asset Tag", "Asset Name", "Reporter Name", "Description",
        "Priority", "Status", "Assigned Technician", "Resolved Notes", "Date Created"
    ])

    for r in reqs:
        writer.writerow([
            r["id"], r["asset_tag"], r["asset_name"], r["raised_by_name"] or "Unknown",
            r["description"], r["priority"], r["status"], r["assigned_technician"] or "None",
            r["resolved_notes"] or "None", r["created_at"].strftime("%Y-%m-%d %H:%M")
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=maintenance_report.csv"}
    )


@router.get("/dashboard")
def get_dashboard_kpis(
    month: Optional[str] = None,
    db = Depends(get_db),
    current_user: SimpleNamespace = Depends(get_current_active_user)
):
    """Retrieve operational dashboard snapshot of the whole system."""
    # Run overdue sync to ensure accuracy
    from routes.allocations import sync_overdue_allocations
    from routes.bookings import sync_bookings_and_remind
    sync_overdue_allocations(db)
    sync_bookings_and_remind(db)

    cursor = db.cursor(dictionary=True)
    now = datetime.utcnow()
    month_filter = month if month else now.strftime("%Y-%m")

    # Get total count of assets registered in this month
    cursor.execute("SELECT COUNT(*) as count FROM assets WHERE acquisition_date LIKE %s", (f"{month_filter}%",))
    registered_this_month = cursor.fetchone()["count"]

    # Calculate MoM growth rate dynamically
    try:
        parts = month_filter.split("-")
        yr = int(parts[0])
        mn = int(parts[1])
        if mn == 1:
            prev_month_str = f"{yr - 1}-12"
        else:
            prev_month_str = f"{yr}-{str(mn - 1).zfill(2)}"
    except Exception:
        prev_month_str = "2026-06"

    cursor.execute("SELECT COUNT(*) as count FROM assets WHERE acquisition_date LIKE %s", (f"{prev_month_str}%",))
    registered_prev_month = cursor.fetchone()["count"]

    if registered_prev_month > 0:
        growth_rate = round(((registered_this_month - registered_prev_month) / registered_prev_month) * 100, 1)
    else:
        growth_rate = 100.0 if registered_this_month > 0 else 0.0

    # Daily registration timeline for this month (max 31 days)
    cursor.execute(
        """SELECT DAY(acquisition_date) as day, COUNT(*) as count 
           FROM assets 
           WHERE acquisition_date LIKE %s 
           GROUP BY DAY(acquisition_date) 
           ORDER BY day""", 
        (f"{month_filter}%",)
    )
    daily_registrations_raw = cursor.fetchall()
    
    # Fill in all days of the month (e.g. 1 to 30/31 depending on month)
    days_in_month = 30
    try:
        parts = month_filter.split("-")
        m_val = parts[1]
        if m_val in ["01", "03", "05", "07", "08", "10", "12"]:
            days_in_month = 31
        elif m_val == "02":
            days_in_month = 28
    except Exception:
        pass
        
    daily_registrations = [{"day": d, "count": 0} for d in range(1, days_in_month + 1)]
    for r in daily_registrations_raw:
        day_idx = r["day"] - 1
        if 0 <= day_idx < len(daily_registrations):
            daily_registrations[day_idx]["count"] = r["count"]

    cursor.execute("SELECT COUNT(*) as count FROM assets WHERE status = 'Available'")
    assets_available = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM assets WHERE status = 'Allocated'")
    assets_allocated = cursor.fetchone()["count"]

    cursor.execute(
        "SELECT COUNT(*) as count FROM maintenance_requests WHERE status IN ('Approved', 'In Progress') AND created_at LIKE %s",
        (f"{month_filter}%",)
    )
    maintenance_today = cursor.fetchone()["count"]

    cursor.execute(
        "SELECT COUNT(*) as count FROM resource_bookings WHERE status = 'Ongoing' AND start_time LIKE %s",
        (f"{month_filter}%",)
    )
    active_bookings = cursor.fetchone()["count"]

    cursor.execute(
        "SELECT COUNT(*) as count FROM transfer_requests WHERE status = 'Pending' AND created_at LIKE %s",
        (f"{month_filter}%",)
    )
    pending_transfers = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM asset_allocations WHERE status = 'Overdue'")
    overdue_returns = cursor.fetchone()["count"]

    cursor.execute(
        "SELECT COUNT(*) as count FROM asset_allocations WHERE status = 'Active' AND expected_return_date > %s AND allocation_date LIKE %s",
        (now, f"{month_filter}%")
    )
    upcoming_returns = cursor.fetchone()["count"]
    cursor.close()

    return {
        "assets_available": assets_available,
        "assets_allocated": assets_allocated,
        "maintenance_today": maintenance_today,
        "active_bookings": active_bookings,
        "pending_transfers": pending_transfers,
        "upcoming_returns": upcoming_returns,
        "overdue_returns": overdue_returns,
        "registered_this_month": registered_this_month,
        "daily_registrations": daily_registrations,
        "growth_rate": growth_rate
    }
