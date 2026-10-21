"""Short encrypted MP4 uploads and administrator-only playback."""
from contextlib import contextmanager
from datetime import datetime
import hashlib
import hmac
import logging
import os
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from ..config import S3_BUCKET
from ..database import get_db_connection
from ..utils.s3_helper import generate_upload_url, s3_client
from .auth import require_admin

router = APIRouter(prefix="/api/v1/recordings", tags=["Video recordings"])
logger = logging.getLogger(__name__)
MAX_BYTES = 16 * 1024 * 1024


@contextmanager
def cursor():
    try:
        with get_db_connection() as conn:
            try:
                with conn.cursor() as cur:
                    yield cur
                conn.commit()
            except Exception:
                conn.rollback()
                raise
    except HTTPException:
        raise
    except Exception:
        logger.exception("Video recording database operation failed")
        raise HTTPException(503, "Recording storage unavailable; check migration and backend logs")


class UploadRequest(BaseModel):
    endpoint_id: int = Field(gt=0)
    started_at: datetime
    duration_seconds: float = Field(gt=0, le=30)
    fps: int = Field(ge=1, le=5)
    width: int = Field(ge=2, le=1280)
    height: int = Field(ge=2, le=720)
    encryption_iv: str = Field(pattern=r"^[0-9a-fA-F]{24}$")
    file_hash: str = Field(pattern=r"^[0-9a-fA-F]{64}$")
    encrypted_size: int = Field(ge=17, le=MAX_BYTES)


@router.post("/upload-url")
def request_upload(payload: UploadRequest):
    if payload.started_at.tzinfo is None:
        raise HTTPException(422, "started_at must include a timezone")
    recording_id = uuid4()
    key = f"recordings/{payload.endpoint_id}/{recording_id}.mp4.enc"
    with cursor() as cur:
        cur.execute("SELECT is_active FROM endpoints WHERE endpoint_id = %s", (payload.endpoint_id,))
        endpoint = cur.fetchone()
        if not endpoint or not endpoint[0]:
            raise HTTPException(403, "Endpoint is not registered and active")
        url = generate_upload_url(key)
        if not url:
            raise HTTPException(502, "Could not sign video upload")
        cur.execute("""INSERT INTO video_recordings
            (recording_id, endpoint_id, started_at, duration_seconds, fps, width, height,
             s3_bucket, s3_key, encryption_iv, file_hash, encrypted_size)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (str(recording_id), payload.endpoint_id, payload.started_at, payload.duration_seconds,
             payload.fps, payload.width, payload.height, S3_BUCKET, key,
             payload.encryption_iv, payload.file_hash.lower(), payload.encrypted_size))
    return {"recording_id": str(recording_id), "upload_url": url,
            "complete_path": f"/api/v1/recordings/{recording_id}/complete"}


@router.post("/{recording_id}/complete")
def confirm_upload(recording_id: UUID):
    with cursor() as cur:
        cur.execute("SELECT s3_bucket, s3_key, encrypted_size FROM video_recordings WHERE recording_id = %s",
                    (str(recording_id),))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Recording not found")
        try:
            obj = s3_client.head_object(Bucket=row[0], Key=row[1])
        except (ClientError, BotoCoreError):
            raise HTTPException(502, "Video upload could not be verified in S3")
        if obj["ContentLength"] != row[2]:
            raise HTTPException(409, "Video upload size does not match")
        cur.execute("UPDATE video_recordings SET status = 'uploaded' WHERE recording_id = %s",
                    (str(recording_id),))
    return {"status": "uploaded"}


@router.get("", dependencies=[Depends(require_admin)])
def list_recordings(endpoint_id: int = Query(gt=0), limit: int = Query(50, ge=1, le=100)):
    with cursor() as cur:
        cur.execute("""SELECT recording_id, started_at, duration_seconds, fps, width, height
            FROM video_recordings WHERE endpoint_id = %s AND status = 'uploaded'
            ORDER BY started_at DESC LIMIT %s""", (endpoint_id, limit))
        rows = cur.fetchall()
    return [{"recording_id": str(row[0]), "started_at": row[1].isoformat(),
             "duration_seconds": row[2], "fps": row[3], "width": row[4], "height": row[5],
             "video_url": f"/api/v1/recordings/{row[0]}/video"} for row in rows]


@router.get("/{recording_id}/video", dependencies=[Depends(require_admin)])
def play_recording(recording_id: UUID):
    key = os.getenv("SCREENSHOT_KEY_HEX", "")
    if not key:
        raise HTTPException(503, "Capture decryption key is not configured")
    with cursor() as cur:
        cur.execute("""SELECT s3_bucket, s3_key, encryption_iv, file_hash, encrypted_size
            FROM video_recordings WHERE recording_id = %s AND status = 'uploaded'""", (str(recording_id),))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Uploaded recording not found")
    try:
        obj = s3_client.get_object(Bucket=row[0], Key=row[1])
        body = obj["Body"]
        try:
            if obj.get("ContentLength", 0) > MAX_BYTES:
                raise HTTPException(413, "Recording exceeds playback size limit")
            encrypted = body.read(MAX_BYTES + 1)
        finally:
            body.close()
    except (ClientError, BotoCoreError):
        raise HTTPException(502, "Could not retrieve recording from S3")
    if len(encrypted) != row[4] or len(encrypted) > MAX_BYTES:
        raise HTTPException(422, "Recording size validation failed")
    try:
        key_bytes = bytes.fromhex(key)
        if len(key_bytes) != 32:
            raise ValueError()
        video = AESGCM(key_bytes).decrypt(bytes.fromhex(row[2]), encrypted, None)
        if not hmac.compare_digest(hashlib.sha256(video).hexdigest(), row[3]):
            raise ValueError()
        if video[4:8] != b"ftyp":
            raise ValueError()
    except (InvalidTag, ValueError, TypeError):
        raise HTTPException(422, "Recording decryption or integrity check failed")
    return Response(video, media_type="video/mp4", headers={
        "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f'inline; filename="recording-{recording_id}.mp4"',
    })
