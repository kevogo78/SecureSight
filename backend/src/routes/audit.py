import logging
from fastapi import APIRouter, HTTPException
from typing import List
from ..database import get_db_connection

logger = logging.getLogger("audit")

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
                           COALESCE(e.os_type, 'Windows 11 Enterprise') as os_type,
                           m.capture_id
                    FROM audit_logs a
                    LEFT JOIN media_captures m ON a.log_id = m.log_id
                    LEFT JOIN endpoints e ON a.endpoint_id = e.endpoint_id
                    WHERE COALESCE(e.hostname, '') NOT IN ('WORKSTATION-WIN11', 'MACBOOK-PRO-M2')
                      AND LOWER(COALESCE(e.hostname, '')) NOT LIKE '%ubuntu%'
                    ORDER BY a.timestamp DESC
                    LIMIT %s;
                """, (limit,))
                rows = cur.fetchall()

                for r in rows:
                    media_url = f"/api/v1/media/{r[14]}/image" if r[7] and r[14] else None
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
                if len(results) > 0:
                    return results
    except Exception as e:
        logger.error(f"[!] Database fetch_recent_logs error: {e}", exc_info=True)

    # If DB has no logs or connection failed, return recent in-memory logs
    if len(IN_MEMORY_AUDIT_LOGS) > 0:
        filtered_mem = [
            l for l in IN_MEMORY_AUDIT_LOGS
            if l.get("hostname") not in ('WORKSTATION-WIN11', 'MACBOOK-PRO-M2')
            and 'ubuntu' not in (l.get("hostname") or '').lower()
        ]
        return sorted(filtered_mem, key=lambda x: x["timestamp"], reverse=True)[:limit]

    return results
