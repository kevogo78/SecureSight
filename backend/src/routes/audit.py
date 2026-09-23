from fastapi import APIRouter, HTTPException
from ..database import get_db_connection
from ..utils.s3_helper import generate_download_url

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])

@router.get("/logs")
def fetch_recent_logs(limit: int = 50):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT a.log_id, a.endpoint_id, a.timestamp, a.active_app, 
                           a.keystroke_count, a.filter_status, a.dlp_flag, m.s3_key
                    FROM audit_logs a
                    LEFT JOIN media_captures m ON a.log_id = m.log_id
                    ORDER BY a.timestamp DESC
                    LIMIT %s;
                """, (limit,))
                rows = cur.fetchall()

                results = []
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
                        "media_url": media_url
                    })
                return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))