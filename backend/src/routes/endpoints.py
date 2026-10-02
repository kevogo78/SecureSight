from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db_connection

router = APIRouter(prefix="/api/v1/endpoints", tags=["Endpoints"])

# In-memory storage for active endpoints and kicked endpoint IDs
# Ensures graceful operation even if PostgreSQL database connection is deferred
ACTIVE_ENDPOINTS = {}
KICKED_ENDPOINTS = set()

class EndpointRegistration(BaseModel):
    endpoint_id: int
    hostname: str
    os_type: str = "Windows 11 Enterprise"
    user: str = "Authorized User"
    agent_ver: str = "1.0.0"

@router.get("")
def list_endpoints():
    """Returns active monitored endpoints."""
    results = []
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT e.endpoint_id, e.hostname, e.os_type, e.agent_ver, e.is_active, e.last_seen,
                           COALESCE(u.username, 'Authorized User') as user,
                           latest.active_app, latest.cpu_percent, latest.ram_percent
                    FROM endpoints e
                    LEFT JOIN users u ON e.user_id = u.user_id
                    LEFT JOIN LATERAL (
                        SELECT active_app, cpu_percent, ram_percent
                        FROM audit_logs
                        WHERE endpoint_id = e.endpoint_id
                        ORDER BY timestamp DESC
                        LIMIT 1
                    ) latest ON true
                    ORDER BY e.last_seen DESC;
                """)
                rows = cur.fetchall()
                for r in rows:
                    ep_id = r[0]
                    is_kicked = ep_id in KICKED_ENDPOINTS or not r[4]
                    results.append({
                        "endpoint_id": ep_id,
                        "name": r[1],
                        "os": r[2],
                        "osType": "mac" if "mac" in (r[2] or "").lower() else "win",
                        "agent_ver": r[3],
                        "status": "Offline" if is_kicked else ("Online" if r[4] else "Offline"),
                        "lastSeen": "Just now",
                        "lastSeenDate": r[5].isoformat() if r[5] else None,
                        "user": r[6],
                        "app": r[7] or "Agent Active",
                        "cpu": r[8] or 0.0,
                        "ram": r[9] or 0.0,
                        "kicked": is_kicked,
                        "consent_granted": True
                    })
                return results
    except Exception as e:
        # Fallback to in-memory tracking if DB is offline
        pass

    for ep_id, ep in ACTIVE_ENDPOINTS.items():
        is_kicked = ep_id in KICKED_ENDPOINTS
        results.append({
            **ep,
            "status": "Offline" if is_kicked else ep.get("status", "Online"),
            "kicked": is_kicked
        })
    return results

@router.post("/register")
def register_endpoint(ep: EndpointRegistration):
    """Registers an endpoint upon consent authorization."""
    ACTIVE_ENDPOINTS[ep.endpoint_id] = {
        "endpoint_id": ep.endpoint_id,
        "name": ep.hostname,
        "os": ep.os_type,
        "osType": "mac" if "mac" in ep.os_type.lower() else "win",
        "agent_ver": ep.agent_ver,
        "status": "Online",
        "lastSeen": "Just now",
        "user": ep.user,
        "app": "Consent Authorized",
        "cpu": 0.0,
        "ram": 0.0,
        "consent_granted": True
    }
    # Unkick if re-authorized
    KICKED_ENDPOINTS.discard(ep.endpoint_id)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO endpoints (endpoint_id, user_id, hostname, os_type, agent_ver, is_active, last_seen)
                    VALUES (%s, 1, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)
                    ON CONFLICT (endpoint_id) DO UPDATE SET 
                        hostname = EXCLUDED.hostname,
                        os_type = EXCLUDED.os_type,
                        is_active = TRUE,
                        last_seen = CURRENT_TIMESTAMP;
                """, (ep.endpoint_id, ep.hostname, ep.os_type, ep.agent_ver))
                conn.commit()
    except Exception:
        pass

    return {"status": "registered", "endpoint_id": ep.endpoint_id}

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
    return {"endpoint_id": endpoint_id, "kicked": is_kicked}
