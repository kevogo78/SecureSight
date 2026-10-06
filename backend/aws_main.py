"""Drop-in EC2 main.py; uses telemetry_logs plus aws_endpoint_registry.sql."""
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, Optional, Union
from uuid import UUID, uuid4

import boto3
import psycopg2
from botocore.config import Config
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg2.extras import Json, RealDictCursor

app = FastAPI(title="Endpoint Observability Ingestion API", version="1.0.0")
logger = logging.getLogger("uvicorn.error")


def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), database=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgresadmin"), password=os.getenv("DB_PASS"),
        port=int(os.getenv("DB_PORT", "5432")), connect_timeout=5,
        sslmode=os.getenv("DB_SSLMODE", "prefer"),
    )


@contextmanager
def database():
    conn = None
    try:
        conn = get_db()
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
    except HTTPException:
        raise
    except Exception:
        logger.exception("Database operation failed")
        raise HTTPException(503, "Database operation failed; check endpoint-api service logs")
    finally:
        if conn is not None:
            conn.close()


@lru_cache
def s3():
    # Default credential chain supports existing environment keys and EC2 roles.
    return boto3.client(
        "s3", region_name=os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1")),
        config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=5),
    )


class LegacyTelemetry(BaseModel):
    hostname: str = Field(min_length=1, max_length=100)
    timestamp: datetime
    metrics: Dict[str, Any]
    event_type: Optional[str] = "heartbeat"


class AgentTelemetry(BaseModel):
    hostname: str = Field(min_length=1, max_length=100)
    endpoint_id: int
    active_app: str = Field(max_length=100)
    cpu_percent: float = Field(ge=0, le=100)
    ram_percent: float = Field(ge=0, le=100)
    app_category: str = "General"
    keystroke_count: int = Field(default=0, ge=0)
    activity_state: str = "Active"
    filter_status: str = "Clean"
    dlp_flag: bool = False
    capture_requested: bool = False
    file_hash: Optional[str] = None
    encryption_iv: Optional[str] = None
    os_type: Optional[str] = None
    user: Optional[str] = None


class Registration(BaseModel):
    hostname: str = Field(min_length=1, max_length=100)
    endpoint_id: int
    os_type: Optional[str] = None
    user: Optional[str] = None
    agent_ver: str = "1.0.0"


def registry(cur, hostname):
    # A database ID per hostname avoids the old agent's small ID collisions.
    cur.execute("""INSERT INTO aws_endpoint_registry (hostname) VALUES (%s)
                   ON CONFLICT (hostname) DO NOTHING""", (hostname,))
    cur.execute("SELECT * FROM aws_endpoint_registry WHERE hostname = %s FOR UPDATE", (hostname,))
    return cur.fetchone()


@app.post("/api/v1/endpoints/register")
def register_endpoint(payload: Registration):
    with database() as cur:
        ep = registry(cur, payload.hostname)
        cur.execute("""UPDATE aws_endpoint_registry SET kicked = FALSE,
                       last_seen = CURRENT_TIMESTAMP, metadata = %s WHERE endpoint_id = %s""",
                    (Json(payload.model_dump(exclude={"hostname", "endpoint_id"})), ep["endpoint_id"]))
    return {"status": "registered", "endpoint_id": ep["endpoint_id"]}


@app.post("/api/v1/telemetry")
def ingest_telemetry(payload: Union[LegacyTelemetry, AgentTelemetry]):
    now = datetime.now(timezone.utc)
    if isinstance(payload, LegacyTelemetry):
        timestamp = payload.timestamp
        metrics = dict(payload.metrics)
        event_type = payload.event_type or "heartbeat"
    else:
        timestamp = now
        metrics = payload.model_dump(exclude={"hostname", "endpoint_id"})
        event_type = "heartbeat"
    log_id = str(uuid4())
    upload_url = None
    upload_error = None
    with database() as cur:
        ep = registry(cur, payload.hostname)
        if ep["kicked"]:
            return {"status": "kicked", "log_id": None, "upload_url": None}
        metrics["endpoint_id"] = ep["endpoint_id"]
        metrics["log_id"] = log_id
        metrics["received_at"] = now.isoformat()
        if metrics.get("capture_requested") and metrics.get("file_hash"):
            bucket = os.getenv("S3_BUCKET")
            if not bucket:
                upload_error = "S3_BUCKET is not configured"
            else:
                key = f"screenshots/{ep['endpoint_id']}/{log_id}.enc"
                try:
                    upload_url = s3().generate_presigned_url(
                        "put_object", Params={"Bucket": bucket, "Key": key,
                                              "ContentType": "application/octet-stream"},
                        ExpiresIn=300,
                    )
                    metrics.update(s3_bucket=bucket, s3_key=key, upload_status="pending")
                except Exception:
                    logger.exception("Could not generate S3 upload URL")
                    upload_error = "Could not generate S3 upload URL; check service logs"
            if upload_error:
                metrics["upload_status"] = "unavailable"
                logger.warning("Screenshot upload unavailable: %s", upload_error)
        cur.execute("""INSERT INTO telemetry_logs (hostname, timestamp, event_type, metrics)
                       VALUES (%s, %s, %s, %s)""",
                    (payload.hostname, timestamp, event_type, Json(metrics)))
        metadata = dict(ep["metadata"] or {})
        metadata.update({k: v for k, v in metrics.items() if v is not None})
        cur.execute("""UPDATE aws_endpoint_registry SET last_seen = %s, metadata = %s
                       WHERE endpoint_id = %s""", (now, Json(metadata), ep["endpoint_id"]))
    # This response is returned only after the transaction commits.
    return {"status": "success", "database_saved": True, "endpoint_id": ep["endpoint_id"],
            "log_id": log_id, "upload_url": upload_url, "upload_error": upload_error,
            "upload_complete_path": f"/api/v1/media/{log_id}/complete" if upload_url else None}


@app.post("/api/v1/media/{log_id}/complete")
def complete_upload(log_id: UUID):
    with database() as cur:
        cur.execute("""SELECT metrics FROM telemetry_logs
                       WHERE metrics::jsonb ->> 'log_id' = %s FOR UPDATE""", (str(log_id),))
        row = cur.fetchone()
        if not row or not row["metrics"].get("s3_key"):
            raise HTTPException(404, "Capture not found")
        metrics = dict(row["metrics"])
        try:
            obj = s3().head_object(Bucket=metrics["s3_bucket"], Key=metrics["s3_key"])
            if obj["ContentLength"] <= 0:
                raise HTTPException(409, "Uploaded object is empty")
        except HTTPException:
            raise
        except Exception:
            logger.exception("Could not verify screenshot in S3")
            raise HTTPException(502, "Could not verify S3 upload; check service logs")
        metrics.update(upload_status="uploaded", upload_bytes=obj["ContentLength"],
                       uploaded_at=datetime.now(timezone.utc).isoformat())
        cur.execute("""UPDATE telemetry_logs SET metrics = %s
                       WHERE metrics::jsonb ->> 'log_id' = %s""", (Json(metrics), str(log_id)))
    return {"status": "uploaded", "log_id": str(log_id), "bytes": obj["ContentLength"]}


def endpoint_view(row):
    metadata = row["metadata"] or {}
    seen = row["last_seen"]
    if seen and seen.tzinfo is None:
        seen = seen.replace(tzinfo=timezone.utc)
    age = max(0, (datetime.now(timezone.utc) - seen).total_seconds()) if seen else None
    online = not row["kicked"] and age is not None and age <= 60
    os_type = metadata.get("os_type") or "Unknown"
    return {
        "endpoint_id": row["endpoint_id"], "name": row["hostname"], "os": os_type,
        "osType": "mac" if "mac" in os_type.lower() or "darwin" in os_type.lower()
                  else "win" if "windows" in os_type.lower() else "linux",
        "user": metadata.get("user") or metadata.get("username") or "Unknown",
        "agent_ver": metadata.get("agent_ver") or "Unknown",
        "status": "Online" if online else "Offline", "kicked": row["kicked"],
        "lastSeen": f"{int(age)} seconds ago" if age is not None else "Unknown",
        "lastSeenDate": seen.isoformat() if seen else None,
        "cpu": metadata.get("cpu_percent", 0), "ram": metadata.get("ram_percent", 0),
        "app": metadata.get("active_app") or "Unknown",
        "category": metadata.get("app_category") or "General",
        # Registration/telemetry is accepted after consent by the agent.
        "consent_granted": True,
    }


@app.get("/api/v1/endpoints")
def list_endpoints():
    with database() as cur:
        cur.execute("SELECT * FROM aws_endpoint_registry ORDER BY last_seen DESC NULLS LAST")
        return [endpoint_view(row) for row in cur.fetchall()]


@app.post("/api/v1/endpoints/{endpoint_id}/kick")
def kick_endpoint(endpoint_id: int):
    with database() as cur:
        cur.execute("""UPDATE aws_endpoint_registry SET kicked = TRUE WHERE endpoint_id = %s
                       RETURNING endpoint_id""", (endpoint_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Endpoint not found")
    return {"status": "kicked", "endpoint_id": endpoint_id}


@app.get("/api/v1/audit/logs")
def audit_logs(limit: int = Query(default=100, ge=1, le=500)):
    with database() as cur:
        cur.execute("""SELECT t.hostname, t.timestamp, t.event_type, t.metrics, e.endpoint_id
                       FROM telemetry_logs t JOIN aws_endpoint_registry e USING (hostname)
                       ORDER BY t.timestamp::timestamptz DESC LIMIT %s""", (limit,))
        rows = cur.fetchall()
    results = []
    for row in rows:
        m = row["metrics"] or {}
        timestamp = row["timestamp"]
        timestamp = timestamp.isoformat() if hasattr(timestamp, "isoformat") else str(timestamp)
        results.append({
            "log_id": m.get("log_id") or f"{row['endpoint_id']}:{timestamp}",
            "endpoint_id": row["endpoint_id"], "hostname": row["hostname"], "timestamp": timestamp,
            "os_type": m.get("os_type"), "user": m.get("user") or m.get("username"),
            "active_app": m.get("active_app") or "Unknown", "app_category": m.get("app_category", "General"),
            "keystrokes": m.get("keystroke_count", m.get("keystrokes", 0)),
            "cpu_percent": m.get("cpu_percent", 0), "ram_percent": m.get("ram_percent", 0),
            "activity_state": m.get("activity_state", "Unknown"),
            "filter_status": m.get("filter_status", "Unknown"), "dlp_flag": m.get("dlp_flag", False),
            # .enc objects need decryption; they cannot be rendered as image URLs.
            "media_url": None, "s3_key": m.get("s3_key"), "s3_bucket": m.get("s3_bucket"),
            "upload_status": m.get("upload_status"),
        })
    return results


@app.get("/health")
def health():
    with database() as cur:
        cur.execute("SELECT 1")
    return {"status": "healthy", "database": "connected"}
