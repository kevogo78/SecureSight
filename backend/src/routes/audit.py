from fastapi import APIRouter, HTTPException
from typing import List
from ..database import get_db_connection
from ..utils.s3_helper import generate_download_url

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])

IN_MEMORY_AUDIT_LOGS = []

@router.get("/logs")
def fetch_recent_logs(limit: int = 50):
    results = []
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT a.log_id, a.endpoint_id, a.timestamp, a.active_app, 
                           a.keystroke_count, a.filter_status, a.dlp_flag, m.s3_key,
                           a.cpu_percent, a.ram_percent, a.activity_state, a.app_category,
                           COALESCE(e.hostname, 'WORKSTATION-' || a.endpoint_id) as hostname,
                           COALESCE(e.os_type, 'Windows 11 Enterprise') as os_type
                    FROM audit_logs a
                    LEFT JOIN media_captures m ON a.log_id = m.log_id
                    LEFT JOIN endpoints e ON a.endpoint_id = e.endpoint_id
                    ORDER BY a.timestamp DESC
                    LIMIT %s;
                """, (limit,))
                rows = cur.fetchall()

                for r in rows:
                    media_url = generate_download_url(r[7]) if r[7] else None
                    results.append({
                        "log_id": r[0],
                        "endpoint_id": r[1],
                        "timestamp": r[2].isoformat() if r[2] else None,
                        "active_app": r[3],
                        "keystrokes": r[4],
                        "filter_status": r[5],
                        "dlp_flag": r[6],
                        "media_url": media_url,
                        "cpu_percent": r[8] if r[8] is not None else 0.0,
                        "ram_percent": r[9] if r[9] is not None else 0.0,
                        "activity_state": r[10] or "Active",
                        "app_category": r[11] or "Development",
                        "hostname": r[12],
                        "os_type": r[13]
                    })
                return results
    except Exception as e:
        # Fallback to in-memory logs if DB connection fails
        pass

    # If DB not available or empty, return recent in-memory logs
    return sorted(IN_MEMORY_AUDIT_LOGS, key=lambda x: x["timestamp"], reverse=True)[:limit]