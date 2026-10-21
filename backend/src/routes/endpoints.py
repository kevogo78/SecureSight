import logging
import datetime
import time
import os
from fastapi import APIRouter, HTTPException, Response
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db_connection
from ..models.schemas import EndpointUpdate
from ..config import S3_BUCKET
from ..utils.s3_helper import s3_client

logger = logging.getLogger("endpoints")

router = APIRouter(prefix="/api/v1/endpoints", tags=["Endpoints"])

# Heartbeat timeout: Agent transmits every 10 seconds.
# If no telemetry or heartbeat received within 35 seconds (>3 intervals), mark as Offline.
HEARTBEAT_TIMEOUT_SECONDS = 35

def format_relative_time(seconds_ago: float) -> str:
    if seconds_ago < 15:
        return "Just now"
    elif seconds_ago < 60:
        return f"{int(seconds_ago)}s ago"
    elif seconds_ago < 3600:
        return f"{int(seconds_ago // 60)}m ago"
    elif seconds_ago < 86400:
        return f"{int(seconds_ago // 3600)}h ago"
    else:
        return f"{int(seconds_ago // 86400)}d ago"

def format_uptime(seconds_val: float) -> str:
    seconds = int(seconds_val or 0)
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        m = seconds // 60
        s = seconds % 60
        return f"{m}m {s}s"
    elif seconds < 86400:
        h = seconds // 3600
        m = (seconds % 3600) // 60
        return f"{h}h {m}m"
    else:
        d = seconds // 86400
        h = (seconds % 86400) // 3600
        return f"{d}d {h}h"

# In-memory storage for active endpoints, kicked endpoint IDs, paused consent IDs, and connection history
ACTIVE_ENDPOINTS = {}
KICKED_ENDPOINTS = set()
PAUSED_ENDPOINTS = set()
IN_MEMORY_CONNECTION_HISTORY = []
_SCHEMA_MIGRATION_CHECKED = False

def ensure_schema_migration():
    """Idempotently executes database migrations for persistent hardware tracking."""
    global _SCHEMA_MIGRATION_CHECKED
    if _SCHEMA_MIGRATION_CHECKED:
        return
    _SCHEMA_MIGRATION_CHECKED = True
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS custom_name VARCHAR(100);
                    ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS mac_address VARCHAR(50);
                    ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(100);
                    CREATE TABLE IF NOT EXISTS endpoint_connection_history (
                        connection_id BIGSERIAL PRIMARY KEY,
                        endpoint_id INT REFERENCES endpoints(endpoint_id) ON DELETE CASCADE,
                        device_fingerprint VARCHAR(100),
                        mac_address VARCHAR(50),
                        user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
                        username VARCHAR(100),
                        ip_address VARCHAR(50),
                        hostname VARCHAR(100),
                        connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(20) DEFAULT 'Online'
                    );
                    CREATE INDEX IF NOT EXISTS idx_endpoints_device_fingerprint ON endpoints(device_fingerprint);
                    CREATE INDEX IF NOT EXISTS idx_endpoints_mac_address ON endpoints(mac_address);
                    CREATE INDEX IF NOT EXISTS idx_conn_hist_fingerprint ON endpoint_connection_history(device_fingerprint);
                    CREATE INDEX IF NOT EXISTS idx_conn_hist_mac ON endpoint_connection_history(mac_address);
                    CREATE INDEX IF NOT EXISTS idx_conn_hist_endpoint ON endpoint_connection_history(endpoint_id);
                    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_website_url ON audit_logs(website_url);
                    CREATE TABLE IF NOT EXISTS privacy_rules (
                        rule_id VARCHAR(50) PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        category VARCHAR(30) NOT NULL,
                        pattern TEXT NOT NULL,
                        replacement VARCHAR(100) DEFAULT '[REDACTED]',
                        action VARCHAR(30) DEFAULT 'mask_and_block',
                        reason VARCHAR(50) NOT NULL,
                        enabled BOOLEAN DEFAULT TRUE,
                        is_builtin BOOLEAN DEFAULT FALSE,
                        description TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_privacy_rules_category ON privacy_rules(category);
                    CREATE INDEX IF NOT EXISTS idx_privacy_rules_enabled ON privacy_rules(enabled);
                """)
                conn.commit()
    except Exception as e:
        logger.debug(f"Schema check deferred or error: {e}")

class EndpointRegistration(BaseModel):
    endpoint_id: int
    hostname: str
    custom_name: Optional[str] = None
    os_type: str = "Windows 11 Enterprise"
    user: str = "Authorized User"
    agent_ver: str = "1.0.0"
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    device_fingerprint: Optional[str] = None

@router.get("")
def list_endpoints():
    """Returns monitored endpoints with live heartbeat status, session uptime, MAC address, and device fingerprint."""
    ensure_schema_migration()
    results = []
    seen_ids = set()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_ts = time.time()

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT e.endpoint_id, e.hostname, e.os_type, e.agent_ver, e.is_active, e.last_seen,
                           COALESCE(u.username, 'Authorized User') as user,
                           latest.active_app, latest.cpu_percent, latest.ram_percent,
                           e.custom_name, e.mac_address, e.device_fingerprint, e.user_id
                    FROM endpoints e
                    LEFT JOIN users u ON e.user_id = u.user_id
                    LEFT JOIN LATERAL (
                        SELECT active_app, cpu_percent, ram_percent
                        FROM audit_logs
                        WHERE endpoint_id = e.endpoint_id
                        ORDER BY timestamp DESC
                        LIMIT 1
                    ) latest ON true
                    WHERE e.hostname NOT IN ('WORKSTATION-WIN11', 'MACBOOK-PRO-M2')
                      AND LOWER(e.hostname) NOT LIKE '%ubuntu%'
                    ORDER BY e.last_seen DESC;
                """)
                rows = cur.fetchall()
                for r in rows:
                    ep_id = r[0]
                    seen_ids.add(ep_id)
                    is_kicked = ep_id in KICKED_ENDPOINTS
                    cached_ep = ACTIVE_ENDPOINTS.get(ep_id, {})
                    is_paused = ep_id in PAUSED_ENDPOINTS or cached_ep.get("consent_paused", False)

                    last_seen_dt = r[5]
                    if last_seen_dt:
                        if last_seen_dt.tzinfo is None:
                            last_seen_dt = last_seen_dt.replace(tzinfo=datetime.timezone.utc)
                        seconds_ago = max(0, (now_utc - last_seen_dt).total_seconds())
                    else:
                        seconds_ago = 999999

                    is_alive = seconds_ago <= HEARTBEAT_TIMEOUT_SECONDS

                    if is_kicked:
                        calc_status = "Kicked / Offline"
                    elif not is_alive:
                        calc_status = "Offline"
                    elif is_paused:
                        calc_status = "Paused"
                    else:
                        calc_status = "Online"

                    # Calculate session uptime
                    session_start = cached_ep.get("session_start_time")
                    if is_alive:
                        if cached_ep.get("uptime_seconds") is not None:
                            uptime_sec = cached_ep.get("uptime_seconds")
                        elif session_start:
                            uptime_sec = max(0, int(now_ts - session_start))
                        else:
                            uptime_sec = int(max(0, HEARTBEAT_TIMEOUT_SECONDS - seconds_ago))
                        calc_uptime = format_uptime(uptime_sec)
                    else:
                        uptime_sec = 0
                        calc_uptime = "Offline"

                    ip_val = cached_ep.get("ipAddress") or cached_ep.get("ip_address") or f"192.168.1.{100 + (ep_id % 150)}"
                    custom_name = r[10] or cached_ep.get("custom_name")
                    display_name = custom_name or cached_ep.get("display_name") or r[1]
                    mac_val = r[11] or cached_ep.get("mac_address") or f"02:00:00:00:00:{ep_id:02x}"
                    fp_val = r[12] or cached_ep.get("device_fingerprint") or f"fp_{ep_id}"

                    results.append({
                        "endpoint_id": ep_id,
                        "name": display_name,
                        "hostname": r[1],
                        "custom_name": custom_name,
                        "mac_address": mac_val,
                        "device_fingerprint": fp_val,
                        "user_id": r[13],
                        "os": r[2],
                        "osType": "mac" if "mac" in (r[2] or "").lower() else "win",
                        "agent_ver": r[3],
                        "status": calc_status,
                        "uptime": calc_uptime,
                        "uptime_seconds": uptime_sec,
                        "lastSeen": format_relative_time(seconds_ago),
                        "lastSeenDate": last_seen_dt.isoformat() if last_seen_dt else None,
                        "user": r[6],
                        "app": r[7] or ("Idle" if not is_alive else "Agent Active"),
                        "cpu": r[8] if (is_alive and r[8] is not None) else 0.0,
                        "ram": r[9] if (is_alive and r[9] is not None) else 0.0,
                        "kicked": is_kicked,
                        "consent_granted": True,
                        "consent_paused": is_paused,
                        "ipAddress": ip_val,
                        "ip_address": ip_val
                    })
    except Exception as e:
        logger.error(f"[!] Database list_endpoints query error: {e}", exc_info=True)

    # Seamlessly merge any in-memory registered active endpoints that may not yet be committed to DB
    for ep_id, ep in ACTIVE_ENDPOINTS.items():
        if ep.get("name") in ('WORKSTATION-WIN11', 'MACBOOK-PRO-M2') or 'ubuntu' in (ep.get("name") or '').lower():
            continue
        if ep_id not in seen_ids:
            is_kicked = ep_id in KICKED_ENDPOINTS
            is_paused = ep_id in PAUSED_ENDPOINTS or ep.get("consent_paused", False)
            last_seen_time = ep.get("last_seen_time", now_ts)
            seconds_ago = max(0, now_ts - last_seen_time)
            is_alive = seconds_ago <= HEARTBEAT_TIMEOUT_SECONDS

            if is_kicked:
                calc_status = "Kicked / Offline"
            elif not is_alive:
                calc_status = "Offline"
            elif is_paused:
                calc_status = "Paused"
            else:
                calc_status = "Online"

            session_start = ep.get("session_start_time")
            if is_alive:
                if ep.get("uptime_seconds") is not None:
                    uptime_sec = ep.get("uptime_seconds")
                elif session_start:
                    uptime_sec = max(0, int(now_ts - session_start))
                else:
                    uptime_sec = 60
                calc_uptime = format_uptime(uptime_sec)
            else:
                uptime_sec = 0
                calc_uptime = "Offline"

            ip_val = ep.get("ipAddress") or ep.get("ip_address") or f"192.168.1.{100 + (ep_id % 150)}"
            mac_val = ep.get("mac_address") or f"02:00:00:00:00:{ep_id:02x}"
            fp_val = ep.get("device_fingerprint") or f"fp_{ep_id}"
            results.append({
                **ep,
                "status": calc_status,
                "uptime": calc_uptime,
                "uptime_seconds": uptime_sec,
                "lastSeen": format_relative_time(seconds_ago),
                "kicked": is_kicked,
                "consent_paused": is_paused,
                "ipAddress": ip_val,
                "ip_address": ip_val,
                "mac_address": mac_val,
                "device_fingerprint": fp_val
            })
    return results

@router.post("/register")
def register_endpoint(ep: EndpointRegistration):
    """Registers an endpoint upon consent authorization and logs initial device connection."""
    ensure_schema_migration()
    ip_val = ep.ip_address or f"192.168.1.{100 + (ep.endpoint_id % 150)}"
    mac_val = ep.mac_address or f"02:00:00:00:00:{ep.endpoint_id:02x}"
    fp_val = ep.device_fingerprint or f"fp_{ep.endpoint_id}"
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_ts = time.time()

    ACTIVE_ENDPOINTS[ep.endpoint_id] = {
        "endpoint_id": ep.endpoint_id,
        "name": ep.custom_name or ep.hostname,
        "hostname": ep.hostname,
        "custom_name": ep.custom_name,
        "mac_address": mac_val,
        "device_fingerprint": fp_val,
        "os": ep.os_type,
        "osType": "mac" if "mac" in ep.os_type.lower() else "win",
        "agent_ver": ep.agent_ver,
        "status": "Online",
        "uptime": "Just started",
        "uptime_seconds": 0,
        "session_start_time": now_ts,
        "lastSeen": "Just now",
        "lastSeenDate": now_utc.isoformat(),
        "last_seen_time": now_ts,
        "user": ep.user,
        "app": "Consent Authorized",
        "cpu": 0.0,
        "ram": 0.0,
        "consent_granted": True,
        "consent_paused": False,
        "ipAddress": ip_val,
        "ip_address": ip_val
    }
    # Unkick if re-authorized
    KICKED_ENDPOINTS.discard(ep.endpoint_id)

    # In-memory history tracking
    conn_entry = {
        "connection_id": len(IN_MEMORY_CONNECTION_HISTORY) + 1,
        "endpoint_id": ep.endpoint_id,
        "device_fingerprint": fp_val,
        "mac_address": mac_val,
        "user_id": 1,
        "username": ep.user,
        "ip_address": ip_val,
        "hostname": ep.hostname,
        "connected_at": now_utc.isoformat(),
        "last_seen": now_utc.isoformat(),
        "status": "Online"
    }
    IN_MEMORY_CONNECTION_HISTORY.insert(0, conn_entry)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                valid_user_id = 1
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

                cur.execute("""
                    INSERT INTO endpoints (
                        endpoint_id, user_id, hostname, custom_name, mac_address, device_fingerprint, os_type, agent_ver, is_active, last_seen
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)
                    ON CONFLICT (endpoint_id) DO UPDATE SET 
                        hostname = EXCLUDED.hostname,
                        custom_name = COALESCE(EXCLUDED.custom_name, endpoints.custom_name),
                        mac_address = COALESCE(EXCLUDED.mac_address, endpoints.mac_address),
                        device_fingerprint = COALESCE(EXCLUDED.device_fingerprint, endpoints.device_fingerprint),
                        os_type = EXCLUDED.os_type,
                        is_active = TRUE,
                        last_seen = CURRENT_TIMESTAMP;
                """, (ep.endpoint_id, valid_user_id, ep.hostname, ep.custom_name, mac_val, fp_val, ep.os_type, ep.agent_ver))

                cur.execute("""
                    INSERT INTO endpoint_connection_history (
                        endpoint_id, device_fingerprint, mac_address, user_id, username, ip_address, hostname, connected_at, last_seen, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Online');
                """, (ep.endpoint_id, fp_val, mac_val, valid_user_id, ep.user, ip_val, ep.hostname))

                conn.commit()
    except Exception as e:
        logger.error(f"[!] Database register_endpoint error: {e}", exc_info=True)

    return {"status": "registered", "endpoint_id": ep.endpoint_id}

@router.get("/{endpoint_id}/history")
def get_endpoint_history(endpoint_id: int):
    """
    Returns connection history for this physical device.
    Past logins from the same physical device link together by MAC address or persistent device fingerprint.
    """
    ensure_schema_migration()
    history = []
    mac_val = None
    fp_val = None

    # Retrieve known hardware identifiers
    if endpoint_id in ACTIVE_ENDPOINTS:
        mac_val = ACTIVE_ENDPOINTS[endpoint_id].get("mac_address")
        fp_val = ACTIVE_ENDPOINTS[endpoint_id].get("device_fingerprint")

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if not mac_val or not fp_val:
                    cur.execute("SELECT mac_address, device_fingerprint FROM endpoints WHERE endpoint_id = %s;", (endpoint_id,))
                    row = cur.fetchone()
                    if row:
                        mac_val = row[0] or mac_val
                        fp_val = row[1] or fp_val

                # Query all sessions from the same physical device linked by MAC, fingerprint, or endpoint ID
                cur.execute("""
                    SELECT connection_id, endpoint_id, device_fingerprint, mac_address,
                           user_id, username, ip_address, hostname, connected_at, last_seen, status
                    FROM endpoint_connection_history
                    WHERE endpoint_id = %s 
                       OR (device_fingerprint IS NOT NULL AND device_fingerprint = %s)
                       OR (mac_address IS NOT NULL AND mac_address = %s)
                    ORDER BY connected_at DESC
                    LIMIT 50;
                """, (endpoint_id, fp_val or "__NONE__", mac_val or "__NONE__"))
                rows = cur.fetchall()
                for r in rows:
                    history.append({
                        "connection_id": r[0],
                        "endpoint_id": r[1],
                        "device_fingerprint": r[2],
                        "mac_address": r[3],
                        "user_id": r[4],
                        "username": r[5] or "Authorized User",
                        "ip_address": r[6],
                        "hostname": r[7],
                        "connected_at": r[8].isoformat() if r[8] else None,
                        "last_seen": r[9].isoformat() if r[9] else None,
                        "status": r[10] or "Online"
                    })
    except Exception as e:
        logger.warning(f"Database get_endpoint_history query notice: {e}")

    # Fallback to in-memory history matching endpoint_id or hardware fingerprint
    if not history and IN_MEMORY_CONNECTION_HISTORY:
        matched = [
            h for h in IN_MEMORY_CONNECTION_HISTORY
            if h.get("endpoint_id") == endpoint_id 
            or (fp_val and h.get("device_fingerprint") == fp_val)
            or (mac_val and h.get("mac_address") == mac_val)
        ]
        history.extend(matched)

    # If still empty, provide current session record
    if not history and endpoint_id in ACTIVE_ENDPOINTS:
        ep = ACTIVE_ENDPOINTS[endpoint_id]
        history.append({
            "connection_id": 1,
            "endpoint_id": endpoint_id,
            "device_fingerprint": ep.get("device_fingerprint") or f"fp_{endpoint_id}",
            "mac_address": ep.get("mac_address") or f"02:00:00:00:00:{endpoint_id:02x}",
            "user_id": 1,
            "username": ep.get("user") or "Authorized User",
            "ip_address": ep.get("ipAddress") or "192.168.1.100",
            "hostname": ep.get("hostname") or ep.get("name"),
            "connected_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "last_seen": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": ep.get("status") or "Online"
        })

    return history

@router.put("/{endpoint_id}")
def update_endpoint(endpoint_id: int, payload: EndpointUpdate):
    """
    Updates endpoint display name, MAC address, device fingerprint, or assigned user.
    Enables manually linking / re-linking device identifiers.
    """
    ensure_schema_migration()
    new_name = payload.display_name or payload.custom_name
    mac = payload.mac_address
    fingerprint = payload.device_fingerprint
    user_name = payload.user

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Update endpoints table
                cur.execute("""
                    UPDATE endpoints
                    SET custom_name = COALESCE(%s, custom_name),
                        mac_address = COALESCE(%s, mac_address),
                        device_fingerprint = COALESCE(%s, device_fingerprint)
                    WHERE endpoint_id = %s;
                """, (new_name, mac, fingerprint, endpoint_id))

                # Re-link connection history entries for this endpoint
                if mac or fingerprint:
                    cur.execute("""
                        UPDATE endpoint_connection_history
                        SET mac_address = COALESCE(%s, mac_address),
                            device_fingerprint = COALESCE(%s, device_fingerprint)
                        WHERE endpoint_id = %s;
                    """, (mac, fingerprint, endpoint_id))
                conn.commit()
    except Exception as e:
        logger.warning(f"Database update_endpoint error: {e}")

    # Update in-memory ACTIVE_ENDPOINTS
    if endpoint_id in ACTIVE_ENDPOINTS:
        if new_name:
            ACTIVE_ENDPOINTS[endpoint_id]["custom_name"] = new_name
            ACTIVE_ENDPOINTS[endpoint_id]["name"] = new_name
        if mac:
            ACTIVE_ENDPOINTS[endpoint_id]["mac_address"] = mac
        if fingerprint:
            ACTIVE_ENDPOINTS[endpoint_id]["device_fingerprint"] = fingerprint
        if user_name:
            ACTIVE_ENDPOINTS[endpoint_id]["user"] = user_name

    # Update in-memory connection history
    for entry in IN_MEMORY_CONNECTION_HISTORY:
        if entry.get("endpoint_id") == endpoint_id:
            if mac:
                entry["mac_address"] = mac
            if fingerprint:
                entry["device_fingerprint"] = fingerprint
            if new_name:
                entry["hostname"] = new_name
            if user_name:
                entry["username"] = user_name

    return {
        "status": "success",
        "message": "Endpoint configuration updated and device identifiers successfully linked.",
        "endpoint_id": endpoint_id,
        "endpoint": ACTIVE_ENDPOINTS.get(endpoint_id, {
            "endpoint_id": endpoint_id,
            "custom_name": new_name,
            "mac_address": mac,
            "device_fingerprint": fingerprint
        })
    }

@router.delete("/{endpoint_id}")
def delete_endpoint(endpoint_id: int):
    """
    Safely and completely removes an endpoint and its associated logs, history, and media
    from the database and active fleet registry. Allows the node to cleanly rejoin later.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Clean media captures associated with this endpoint's audit logs
                cur.execute("""
                    DELETE FROM media_captures 
                    WHERE log_id IN (SELECT log_id FROM audit_logs WHERE endpoint_id = %s);
                """, (endpoint_id,))
                
                # 2. Clean audit logs
                cur.execute("DELETE FROM audit_logs WHERE endpoint_id = %s;", (endpoint_id,))
                
                # 3. Clean telemetry logs
                cur.execute("DELETE FROM telemetry_logs WHERE endpoint_id = %s;", (endpoint_id,))
                
                # 4. Clean connection history
                cur.execute("DELETE FROM endpoint_connection_history WHERE endpoint_id = %s;", (endpoint_id,))
                
                # 5. Delete the endpoint record itself
                cur.execute("DELETE FROM endpoints WHERE endpoint_id = %s;", (endpoint_id,))
                conn.commit()
    except Exception as e:
        logger.warning(f"Database delete_endpoint warning: {e}")

    # Clean in-memory caches
    ACTIVE_ENDPOINTS.pop(endpoint_id, None)
    KICKED_ENDPOINTS.discard(endpoint_id)
    PAUSED_ENDPOINTS.discard(endpoint_id)

    # Clean in-memory connection history
    global IN_MEMORY_CONNECTION_HISTORY
    IN_MEMORY_CONNECTION_HISTORY = [
        item for item in IN_MEMORY_CONNECTION_HISTORY if item.get("endpoint_id") != endpoint_id
    ]

    # Clean in-memory audit logs
    try:
        from .audit import IN_MEMORY_AUDIT_LOGS
        IN_MEMORY_AUDIT_LOGS[:] = [
            l for l in IN_MEMORY_AUDIT_LOGS if l.get("endpoint_id") != endpoint_id
        ]
    except Exception:
        pass

    return {
        "status": "deleted",
        "message": f"Endpoint {endpoint_id} and all associated logs were successfully removed from the system.",
        "endpoint_id": endpoint_id
    }

@router.post("/{endpoint_id}/kick")
def kick_endpoint(endpoint_id: int):
    """Kicks / de-authorizes an endpoint from active monitoring."""
    KICKED_ENDPOINTS.add(endpoint_id)
    if endpoint_id in ACTIVE_ENDPOINTS:
        ACTIVE_ENDPOINTS[endpoint_id]["status"] = "Kicked / Offline"

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE endpoints 
                    SET is_active = FALSE 
                    WHERE endpoint_id = %s;
                """, (endpoint_id,))
                conn.commit()
    except Exception:
        pass

    return {"status": "kicked", "endpoint_id": endpoint_id}

@router.get("/{endpoint_id}/status")
def get_endpoint_status(endpoint_id: int):
    """Allows client agent to poll or check if it has been kicked."""
    is_kicked = endpoint_id in KICKED_ENDPOINTS
    is_paused = endpoint_id in PAUSED_ENDPOINTS
    return {"endpoint_id": endpoint_id, "kicked": is_kicked, "paused": is_paused}

@router.post("/{endpoint_id}/pause")
def pause_endpoint(endpoint_id: int):
    """Pauses consent monitoring for an endpoint."""
    PAUSED_ENDPOINTS.add(endpoint_id)
    if endpoint_id in ACTIVE_ENDPOINTS:
        ACTIVE_ENDPOINTS[endpoint_id]["status"] = "Paused"
        ACTIVE_ENDPOINTS[endpoint_id]["consent_paused"] = True
        ACTIVE_ENDPOINTS[endpoint_id]["consent_status"] = "Paused"
    return {"status": "paused", "endpoint_id": endpoint_id}

@router.post("/{endpoint_id}/resume")
def resume_endpoint(endpoint_id: int):
    """Resumes consent monitoring for an endpoint."""
    PAUSED_ENDPOINTS.discard(endpoint_id)
    if endpoint_id in ACTIVE_ENDPOINTS:
        ACTIVE_ENDPOINTS[endpoint_id]["status"] = "Online"
        ACTIVE_ENDPOINTS[endpoint_id]["consent_paused"] = False
        ACTIVE_ENDPOINTS[endpoint_id]["consent_status"] = "Granted"
    return {"status": "resumed", "endpoint_id": endpoint_id}

@router.post("/{endpoint_id}/disconnect")
def disconnect_endpoint(endpoint_id: int):
    """Marks an endpoint as disconnected / offline immediately."""
    if endpoint_id in ACTIVE_ENDPOINTS:
        ACTIVE_ENDPOINTS[endpoint_id]["status"] = "Offline"
        ACTIVE_ENDPOINTS[endpoint_id]["last_seen_time"] = 0
    return {"status": "disconnected", "endpoint_id": endpoint_id}


# ======================================================================
# KEYSTROKE AUDIT .TXT FILE RETRIEVAL & MANAGEMENT ROUTES
# ======================================================================

def _get_keylog_storage_dirs(endpoint_id: int) -> List[str]:
    """Resolves potential local directory locations for keylog files."""
    dirs = [
        os.path.abspath(f"backend/keylogs/{endpoint_id}"),
        os.path.abspath(f"keylogs/{endpoint_id}"),
        os.path.abspath(f"agent/keylogs/{endpoint_id}"),
        os.path.abspath("agent/keylogs"),
        os.path.abspath("keylogs")
    ]
    return [d for d in dirs if os.path.exists(d)]

@router.get("/{endpoint_id}/keylogs")
def list_endpoint_keylogs(endpoint_id: int):
    """
    Returns a list of all available keystroke audit .txt files for this endpoint,
    aggregating from local server storage and Amazon S3.
    """
    files_map = {}

    # 1. Search local directories
    candidate_dirs = _get_keylog_storage_dirs(endpoint_id)
    for cdir in candidate_dirs:
        try:
            norm_cdir = cdir.replace("\\", "/")
            is_endpoint_dir = norm_cdir.endswith(f"/{endpoint_id}") or f"keylogs/{endpoint_id}" in norm_cdir
            for fname in os.listdir(cdir):
                if not fname.endswith(".txt"):
                    continue
                # If directory is dedicated to this endpoint, all .txt files belong to this endpoint.
                # If shared directory, match endpoint-specific prefixes.
                if not is_endpoint_dir and not (
                    f"ep{endpoint_id}_" in fname or 
                    f"endpoint_{endpoint_id}" in fname or 
                    fname == "keystroke_audit.txt"
                ):
                    continue
                full_p = os.path.join(cdir, fname)
                stat = os.stat(full_p)
                
                # Extract event type from filename
                fname_lower = fname.lower()
                event_type = "Interval"
                if "pause" in fname_lower:
                    event_type = "Paused"
                elif "kick" in fname_lower:
                    event_type = "Kicked"
                elif "session_end" in fname_lower or "end" in fname_lower:
                    event_type = "Session End"
                elif "1-min" in fname_lower or "minute" in fname_lower or "active" in fname_lower or "min" in fname_lower:
                    event_type = "1-Min Active"

                files_map[fname] = {
                    "filename": fname,
                    "event_type": event_type,
                    "size_bytes": stat.st_size,
                    "modified_at": datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).isoformat(),
                    "source": "local",
                    "download_url": f"/api/v1/endpoints/{endpoint_id}/keylogs/{fname}"
                }
        except Exception as e:
            logger.debug(f"Local keylog directory scan notice: {e}")

    # 2. Query Amazon S3 bucket if configured
    if S3_BUCKET and s3_client:
        try:
            s3_prefixes = [f"keylogs/{endpoint_id}/", f"keystroke_audit/"]
            for prefix in s3_prefixes:
                try:
                    resp = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix, MaxKeys=50)
                    for item in resp.get("Contents", []):
                        key = item["Key"]
                        fname = os.path.basename(key)
                        if fname.endswith(".txt") and (fname not in files_map):
                            fname_lower = fname.lower()
                            event_type = "Interval"
                            if "pause" in fname_lower:
                                event_type = "Paused"
                            elif "kick" in fname_lower:
                                event_type = "Kicked"
                            elif "session_end" in fname_lower or "end" in fname_lower:
                                event_type = "Session End"
                            elif "1-min" in fname_lower or "minute" in fname_lower or "active" in fname_lower or "min" in fname_lower:
                                event_type = "1-Min Active"

                            files_map[fname] = {
                                "filename": fname,
                                "event_type": event_type,
                                "size_bytes": item.get("Size", 0),
                                "modified_at": item["LastModified"].isoformat() if hasattr(item["LastModified"], "isoformat") else str(item["LastModified"]),
                                "source": "s3",
                                "s3_key": key,
                                "download_url": f"/api/v1/endpoints/{endpoint_id}/keylogs/{fname}"
                            }
                except Exception:
                    pass
        except Exception as s3_err:
            logger.debug(f"S3 keylog list notice: {s3_err}")

    # Sort files by modified timestamp descending
    results = sorted(files_map.values(), key=lambda x: x.get("modified_at", ""), reverse=True)
    return results

@router.get("/{endpoint_id}/keylogs/{filename}")
def get_endpoint_keylog_file(endpoint_id: int, filename: str):
    """
    Streams the raw text content of a requested keystroke audit .txt file.
    """
    safe_filename = os.path.basename(filename)
    if ".." in filename or safe_filename != filename:
        raise HTTPException(status_code=400, detail="Invalid filename format.")

    # 1. Check local directories
    candidate_dirs = _get_keylog_storage_dirs(endpoint_id)
    for cdir in candidate_dirs:
        local_path = os.path.join(cdir, safe_filename)
        if os.path.exists(local_path):
            try:
                with open(local_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                return Response(
                    content=content,
                    media_type="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f'inline; filename="{safe_filename}"'}
                )
            except Exception as e:
                logger.warning(f"Error reading local keylog file: {e}")

    # 2. Check S3
    if S3_BUCKET and s3_client:
        possible_keys = [
            f"keylogs/{endpoint_id}/{safe_filename}",
            f"keystroke_audit/{safe_filename}",
            f"keystroke_audit/{endpoint_id}/{safe_filename}"
        ]
        for key in possible_keys:
            try:
                resp = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
                content = resp["Body"].read().decode("utf-8", errors="replace")
                return Response(
                    content=content,
                    media_type="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f'inline; filename="{safe_filename}"'}
                )
            except Exception:
                continue

    raise HTTPException(status_code=404, detail=f"Keylog file '{safe_filename}' not found.")

class KeylogUploadPayload(BaseModel):
    filename: str
    content: str
    event_type: Optional[str] = "active"

@router.post("/{endpoint_id}/keylogs/upload")
def upload_endpoint_keylog(endpoint_id: int, payload: KeylogUploadPayload):
    """
    Receives an audit .txt log from the agent client, writes it to server storage,
    and automatically mirrors it to Amazon S3.
    """
    safe_filename = os.path.basename(payload.filename)
    if not safe_filename.endswith(".txt"):
        safe_filename = f"{safe_filename}.txt"

    save_dir = os.path.abspath(f"backend/keylogs/{endpoint_id}")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, safe_filename)

    try:
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(payload.content)
        
        # Mirror upload to S3 if available
        if S3_BUCKET and s3_client:
            try:
                s3_key = f"keylogs/{endpoint_id}/{safe_filename}"
                s3_client.upload_file(save_path, S3_BUCKET, s3_key)
            except Exception as s3_err:
                logger.warning(f"Mirroring keylog upload to S3 skipped/failed: {s3_err}")

        return {
            "status": "success",
            "filename": safe_filename,
            "bytes_received": len(payload.content.encode('utf-8')),
            "endpoint_id": endpoint_id
        }
    except Exception as e:
        logger.error(f"Failed to store uploaded keylog file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save keylog file: {str(e)}")


@router.delete("/{endpoint_id}/keylogs/{filename}")
def delete_endpoint_keylog(endpoint_id: int, filename: str):
    """
    Deletes a specific keystroke audit .txt file from local storage and Amazon S3.
    """
    safe_filename = os.path.basename(filename)
    if ".." in filename or safe_filename != filename:
        raise HTTPException(status_code=400, detail="Invalid filename format.")

    deleted_local = False
    candidate_dirs = _get_keylog_storage_dirs(endpoint_id)
    for cdir in candidate_dirs:
        local_path = os.path.join(cdir, safe_filename)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
                deleted_local = True
            except Exception as e:
                logger.warning(f"Failed to delete local keylog {local_path}: {e}")

    deleted_s3 = False
    if S3_BUCKET and s3_client:
        possible_keys = [
            f"keylogs/{endpoint_id}/{safe_filename}",
            f"keystroke_audit/{safe_filename}",
            f"keystroke_audit/{endpoint_id}/{safe_filename}"
        ]
        for key in possible_keys:
            try:
                s3_client.delete_object(Bucket=S3_BUCKET, Key=key)
                deleted_s3 = True
            except Exception:
                pass

    return {
        "status": "success",
        "message": f"Keylog file '{safe_filename}' deleted.",
        "filename": safe_filename,
        "deleted_local": deleted_local,
        "deleted_s3": deleted_s3
    }


class BatchDeleteKeylogsPayload(BaseModel):
    filenames: List[str]


@router.post("/{endpoint_id}/keylogs/batch-delete")
def batch_delete_endpoint_keylogs(endpoint_id: int, payload: BatchDeleteKeylogsPayload):
    """
    Deletes multiple keystroke audit .txt files from local storage and Amazon S3.
    """
    deleted_files = []
    candidate_dirs = _get_keylog_storage_dirs(endpoint_id)

    for filename in payload.filenames:
        safe_filename = os.path.basename(filename)
        if ".." in filename or safe_filename != filename:
            continue

        for cdir in candidate_dirs:
            local_path = os.path.join(cdir, safe_filename)
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception as e:
                    logger.warning(f"Failed to delete local keylog {local_path}: {e}")

        if S3_BUCKET and s3_client:
            possible_keys = [
                f"keylogs/{endpoint_id}/{safe_filename}",
                f"keystroke_audit/{safe_filename}",
                f"keystroke_audit/{endpoint_id}/{safe_filename}"
            ]
            for key in possible_keys:
                try:
                    s3_client.delete_object(Bucket=S3_BUCKET, Key=key)
                except Exception:
                    pass

        deleted_files.append(safe_filename)

    return {
        "status": "success",
        "deleted_count": len(deleted_files),
        "filenames": deleted_files
    }
