import datetime
import time
import logging
from fastapi import APIRouter, HTTPException
from ..models.schemas import TelemetryPayload, PresignedURLResponse
from ..database import get_db_connection
from ..utils.s3_helper import generate_upload_url
from ..config import S3_BUCKET
from .endpoints import (
    KICKED_ENDPOINTS, ACTIVE_ENDPOINTS, PAUSED_ENDPOINTS, 
    IN_MEMORY_CONNECTION_HISTORY, format_uptime
)
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
    
    is_paused = (
        payload.endpoint_id in PAUSED_ENDPOINTS or 
        bool(payload.consent_paused) or 
        payload.filter_status == "User_Suspended"
    )
    if is_paused:
        PAUSED_ENDPOINTS.add(payload.endpoint_id)
    else:
        PAUSED_ENDPOINTS.discard(payload.endpoint_id)

    status_str = "Paused" if is_paused else "Online"
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_ts = time.time()

    existing_entry = ACTIVE_ENDPOINTS.get(payload.endpoint_id, {})
    ip_val = payload.ip_address or existing_entry.get("ipAddress") or f"192.168.1.{100 + (payload.endpoint_id % 150)}"
    mac_val = payload.mac_address or existing_entry.get("mac_address")
    fp_val = payload.device_fingerprint or existing_entry.get("device_fingerprint")
    existing_custom_name = existing_entry.get("custom_name")

    # Session uptime calculation: maintain session_start_time across heartbeats
    session_start = existing_entry.get("session_start_time")
    if not session_start or (now_ts - existing_entry.get("last_seen_time", 0)) > 60:
        session_start = now_ts

    uptime_sec = payload.uptime_seconds if payload.uptime_seconds is not None else max(0, int(now_ts - session_start))
    uptime_display = format_uptime(uptime_sec)

    ACTIVE_ENDPOINTS[payload.endpoint_id] = {
        "endpoint_id": payload.endpoint_id,
        "name": existing_custom_name or hostname,
        "hostname": hostname,
        "custom_name": existing_custom_name,
        "mac_address": mac_val,
        "device_fingerprint": fp_val,
        "os": os_type,
        "osType": "mac" if "mac" in os_type.lower() else "win",
        "agent_ver": "1.0.0",
        "status": status_str,
        "uptime": uptime_display,
        "uptime_seconds": uptime_sec,
        "session_start_time": session_start,
        "lastSeen": "Just now",
        "lastSeenDate": now_utc.isoformat(),
        "last_seen_time": now_ts,
        "user": user_name,
        "app": payload.active_app,
        "cpu": payload.cpu_percent,
        "ram": payload.ram_percent,
        "category": payload.app_category,
        "consent_granted": True,
        "consent_paused": is_paused,
        "consent_status": "Paused" if is_paused else "Granted",
        "ipAddress": ip_val,
        "ip_address": ip_val
    }

    # Ensure in-memory connection history has an active entry (e.g. after deletion and rejoining)
    has_active_conn = any(
        h.get("endpoint_id") == payload.endpoint_id and h.get("status") == "Online"
        for h in IN_MEMORY_CONNECTION_HISTORY
    )
    if not has_active_conn:
        IN_MEMORY_CONNECTION_HISTORY.insert(0, {
            "connection_id": len(IN_MEMORY_CONNECTION_HISTORY) + 1,
            "endpoint_id": payload.endpoint_id,
            "device_fingerprint": fp_val or f"fp_{payload.endpoint_id}",
            "mac_address": mac_val or f"02:00:00:00:00:{payload.endpoint_id:02x}",
            "user_id": 1,
            "username": user_name,
            "ip_address": ip_val,
            "hostname": hostname,
            "connected_at": now_utc.isoformat(),
            "last_seen": now_utc.isoformat(),
            "status": "Online"
        })

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
        "website_url": payload.website_url,
        "media_url": None,
        "hostname": hostname,
        "os_type": os_type,
        "user": user_name,
        "ip_address": ip_val
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
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    valid_user_id = 1

                # 2. Ensure endpoint exists in endpoints table to satisfy foreign key
                cur.execute("""
                    INSERT INTO endpoints (
                        endpoint_id, user_id, hostname, os_type, agent_ver, is_active, last_seen, mac_address, device_fingerprint
                    )
                    VALUES (%s, %s, %s, %s, '1.0.0', TRUE, CURRENT_TIMESTAMP, %s, %s)
                    ON CONFLICT (endpoint_id) DO UPDATE SET 
                        hostname = EXCLUDED.hostname,
                        os_type = EXCLUDED.os_type,
                        is_active = TRUE,
                        last_seen = CURRENT_TIMESTAMP,
                        mac_address = COALESCE(EXCLUDED.mac_address, endpoints.mac_address),
                        device_fingerprint = COALESCE(EXCLUDED.device_fingerprint, endpoints.device_fingerprint);
                """, (payload.endpoint_id, valid_user_id, hostname, os_type, mac_val, fp_val))

                # 3. Auto-insert connection history session if none exists or reconnected
                cur.execute("""
                    INSERT INTO endpoint_connection_history (
                        endpoint_id, device_fingerprint, mac_address, user_id, username, ip_address, hostname, connected_at, last_seen, status
                    )
                    SELECT %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Online'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM endpoint_connection_history 
                        WHERE endpoint_id = %s AND status = 'Online'
                    );
                """, (payload.endpoint_id, fp_val, mac_val, valid_user_id, user_name, ip_val, hostname, payload.endpoint_id))

                cur.execute("""
                    INSERT INTO audit_logs (
                        endpoint_id, active_app, app_category, keystroke_count,
                        activity_state, cpu_percent, ram_percent, filter_status, dlp_flag, website_url
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING log_id;
                """, (
                    payload.endpoint_id, payload.active_app, payload.app_category,
                    payload.keystroke_count, payload.activity_state, payload.cpu_percent,
                    payload.ram_percent, payload.filter_status, payload.dlp_flag, payload.website_url
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
