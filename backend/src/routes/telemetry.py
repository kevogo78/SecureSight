import datetime
import logging
from fastapi import APIRouter, HTTPException
from ..models.schemas import TelemetryPayload, PresignedURLResponse
from ..database import get_db_connection
from ..utils.s3_helper import generate_upload_url
from ..config import S3_BUCKET
from .endpoints import KICKED_ENDPOINTS, ACTIVE_ENDPOINTS
from .audit import IN_MEMORY_AUDIT_LOGS

logger = logging.getLogger("telemetry")

router = APIRouter(prefix="/api/v1", tags=["Telemetry"])

@router.post("/telemetry", response_model=PresignedURLResponse)
def record_telemetry(payload: TelemetryPayload):
    # 1. Enforcement Check: If endpoint was kicked by admin, reject telemetry
    if payload.endpoint_id in KICKED_ENDPOINTS:
        return PresignedURLResponse(status="kicked", log_id=0, upload_url=None)

    # 2. Update in-memory active endpoints tracking
    hostname = payload.hostname or f"WORKSTATION-{payload.endpoint_id}"
    os_type = payload.os_type or "Windows 11 Enterprise"
    user_name = payload.user or "Authorized User"
    
    ACTIVE_ENDPOINTS[payload.endpoint_id] = {
        "endpoint_id": payload.endpoint_id,
        "name": hostname,
        "os": os_type,
        "osType": "mac" if "mac" in os_type.lower() else "win",
        "agent_ver": "1.0.0",
        "status": "Online",
        "lastSeen": "Just now",
        "lastSeenDate": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "user": user_name,
        "app": payload.active_app,
        "cpu": payload.cpu_percent,
        "ram": payload.ram_percent,
        "category": payload.app_category,
        "consent_granted": True
    }

    # 3. Store in-memory audit log for real-time dashboard reactivity
    log_entry = {
        "log_id": len(IN_MEMORY_AUDIT_LOGS) + 1000,
        "endpoint_id": payload.endpoint_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "active_app": payload.active_app,
        "app_category": payload.app_category,
        "keystrokes": payload.keystroke_count,
        "activity_state": payload.activity_state,
        "cpu_percent": payload.cpu_percent,
        "ram_percent": payload.ram_percent,
        "filter_status": payload.filter_status,
        "dlp_flag": payload.dlp_flag,
        "media_url": None,
        "hostname": hostname,
        "os_type": os_type,
        "user": user_name
    }
    IN_MEMORY_AUDIT_LOGS.insert(0, log_entry)
    if len(IN_MEMORY_AUDIT_LOGS) > 500:
        IN_MEMORY_AUDIT_LOGS.pop()

    # 4. Attempt database write
    log_id = log_entry["log_id"]
    upload_url = None

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Resolve a valid user_id to satisfy foreign key (auto-create admin if empty)
                valid_user_id = None
                try:
                    cur.execute("SELECT user_id FROM users LIMIT 1;")
                    user_row = cur.fetchone()
                    if user_row:
                        valid_user_id = user_row[0]
                    else:
                        cur.execute("""
                            INSERT INTO users (username, email, password_hash, role)
                            VALUES ('system_admin', 'admin@monitoring.local', 'pbkdf2:sha256:dummyhashforinit', 'Admin')
                            ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role
                            RETURNING user_id;
                        """)
                        user_row = cur.fetchone()
                        valid_user_id = user_row[0] if user_row else 1
                except Exception as ue:
                    logger.warning(f"Could not query/provision default user: {ue}")
                    valid_user_id = 1

                # 2. Ensure endpoint exists in endpoints table to satisfy foreign key
                cur.execute("""
                    INSERT INTO endpoints (endpoint_id, user_id, hostname, os_type, agent_ver, is_active, last_seen)
                    VALUES (%s, %s, %s, %s, '1.0.0', TRUE, CURRENT_TIMESTAMP)
                    ON CONFLICT (endpoint_id) DO UPDATE SET 
                        hostname = EXCLUDED.hostname,
                        os_type = EXCLUDED.os_type,
                        is_active = TRUE,
                        last_seen = CURRENT_TIMESTAMP;
                """, (payload.endpoint_id, valid_user_id, hostname, os_type))

                cur.execute("""
                    INSERT INTO audit_logs (
                        endpoint_id, active_app, app_category, keystroke_count,
                        activity_state, cpu_percent, ram_percent, filter_status, dlp_flag
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING log_id;
                """, (
                    payload.endpoint_id, payload.active_app, payload.app_category,
                    payload.keystroke_count, payload.activity_state, payload.cpu_percent,
                    payload.ram_percent, payload.filter_status, payload.dlp_flag
                ))
                log_id = cur.fetchone()[0]

                if payload.capture_requested and payload.file_hash:
                    s3_key = f"screenshots/{payload.endpoint_id}/{log_id}.enc"
                    upload_url = generate_upload_url(s3_key)
                    
                    cur.execute("""
                        INSERT INTO media_captures (log_id, s3_bucket, s3_key, file_hash, encryption_iv)
                        VALUES (%s, %s, %s, %s, %s);
                    """, (log_id, S3_BUCKET, s3_key, payload.file_hash, payload.encryption_iv or ""))

                conn.commit()
    except Exception as e:
        logger.error(f"[!] Database telemetry ingestion error: {e}", exc_info=True)

    return PresignedURLResponse(status="success", log_id=log_id, upload_url=upload_url)