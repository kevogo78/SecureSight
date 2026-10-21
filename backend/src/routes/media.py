"""Fetch encrypted evidence from S3 and decrypt only for signed-in admins."""
import hashlib
import hmac
import logging
import os

from botocore.exceptions import ClientError, BotoCoreError
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List, Optional
from pydantic import BaseModel

from ..database import get_db_connection
from ..utils.s3_helper import s3_client
from .auth import require_admin

router = APIRouter(prefix="/api/v1/media", tags=["Screenshot viewing"])
logger = logging.getLogger(__name__)
MAX_CAPTURE_BYTES = 20 * 1024 * 1024


def decrypt_image(encrypted, iv, key, expected_hash):
    key_bytes = bytes.fromhex(key)
    nonce = bytes.fromhex(iv)
    if len(key_bytes) != 32 or len(nonce) != 12:
        raise ValueError("Invalid AES-256 key or nonce")
    image = AESGCM(key_bytes).decrypt(nonce, encrypted, None)
    if expected_hash and not hmac.compare_digest(hashlib.sha256(image).hexdigest(), expected_hash.lower()):
        raise ValueError("Capture hash mismatch")
    if not image.startswith(b"\xff\xd8\xff") or not image.endswith(b"\xff\xd9"):
        raise ValueError("Capture is not a JPEG")
    return image


@router.get("/{capture_id}/image", dependencies=[Depends(require_admin)])
def view_image(capture_id: int):
    key = os.getenv("SCREENSHOT_KEY_HEX", "")
    if not key:
        raise HTTPException(503, "Screenshot decryption key is not configured")
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""SELECT s3_bucket, s3_key, encryption_iv, file_hash
                               FROM media_captures WHERE capture_id = %s""", (capture_id,))
                capture = cur.fetchone()
    except Exception:
        logger.exception("Screenshot metadata lookup failed")
        raise HTTPException(503, "Could not load screenshot metadata")
    if not capture:
        raise HTTPException(404, "Screenshot not found")
    bucket, object_key, iv, digest = capture
    try:
        result = s3_client.get_object(Bucket=bucket, Key=object_key)
        body = result["Body"]
        try:
            if result.get("ContentLength", 0) > MAX_CAPTURE_BYTES:
                raise HTTPException(413, "Screenshot is too large")
            encrypted = body.read(MAX_CAPTURE_BYTES + 1)
            if len(encrypted) > MAX_CAPTURE_BYTES:
                raise HTTPException(413, "Screenshot is too large")
        finally:
            body.close()
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        if code in ("NoSuchKey", "404", "NotFound"):
            raise HTTPException(404, "Screenshot upload is missing or still pending")
        logger.exception("Screenshot S3 retrieval failed")
        raise HTTPException(502, "Could not retrieve screenshot from S3")
    except BotoCoreError:
        logger.exception("Screenshot S3 transport failed")
        raise HTTPException(502, "Could not retrieve screenshot from S3")
    try:
        image = decrypt_image(encrypted, iv, key, digest)
    except (InvalidTag, ValueError, TypeError):
        logger.error("Screenshot decryption or integrity validation failed for capture %s", capture_id)
        raise HTTPException(422, "Screenshot could not be decrypted; check its key and capture metadata")
    return Response(image, media_type="image/jpeg", headers={
        "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f'inline; filename="capture-{capture_id}.jpg"',
    })


@router.delete("/{capture_id}")
def delete_screenshot(capture_id: int):
    """
    Deletes a single screenshot from the media_captures database table and Amazon S3.
    """
    bucket = None
    object_key = None
    log_id = None
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT s3_bucket, s3_key, log_id FROM media_captures WHERE capture_id = %s", (capture_id,))
                row = cur.fetchone()
                if row:
                    bucket, object_key, log_id = row
                    cur.execute("DELETE FROM media_captures WHERE capture_id = %s", (capture_id,))
                    conn.commit()
    except Exception as e:
        logger.exception("Screenshot database deletion failed")
        raise HTTPException(500, f"Failed to delete screenshot from database: {e}")

    if bucket and object_key and s3_client:
        try:
            s3_client.delete_object(Bucket=bucket, Key=object_key)
        except Exception as s3_err:
            logger.warning(f"Failed to delete screenshot from S3: {s3_err}")

    return {"status": "success", "capture_id": capture_id, "log_id": log_id}


@router.delete("/by-log/{log_id}")
def delete_screenshot_by_log(log_id: int):
    """
    Deletes screenshot(s) associated with a given audit log_id from media_captures and Amazon S3.
    """
    deleted_captures = []
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT capture_id, s3_bucket, s3_key FROM media_captures WHERE log_id = %s", (log_id,))
                rows = cur.fetchall()
                for r in rows:
                    cid, b, k = r
                    deleted_captures.append(cid)
                    if b and k and s3_client:
                        try:
                            s3_client.delete_object(Bucket=b, Key=k)
                        except Exception:
                            pass
                cur.execute("DELETE FROM media_captures WHERE log_id = %s", (log_id,))
                conn.commit()
    except Exception as e:
        logger.exception("Screenshot deletion by log_id failed")
        raise HTTPException(500, f"Failed to delete screenshot: {e}")

    return {"status": "success", "log_id": log_id, "deleted_captures": deleted_captures}


class BatchDeleteScreenshotsPayload(BaseModel):
    capture_ids: Optional[List[int]] = []
    log_ids: Optional[List[int]] = []


@router.post("/batch-delete")
def batch_delete_screenshots(payload: BatchDeleteScreenshotsPayload):
    """
    Deletes multiple screenshots given a list of capture_ids and/or log_ids from media_captures and Amazon S3.
    """
    deleted_captures = []
    items_to_delete_from_s3 = []

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if payload.capture_ids:
                    cur.execute(
                        "SELECT capture_id, s3_bucket, s3_key, log_id FROM media_captures WHERE capture_id = ANY(%s)",
                        (payload.capture_ids,)
                    )
                    for r in cur.fetchall():
                        deleted_captures.append(r[0])
                        if r[1] and r[2]:
                            items_to_delete_from_s3.append((r[1], r[2]))
                    cur.execute("DELETE FROM media_captures WHERE capture_id = ANY(%s)", (payload.capture_ids,))

                if payload.log_ids:
                    cur.execute(
                        "SELECT capture_id, s3_bucket, s3_key, log_id FROM media_captures WHERE log_id = ANY(%s)",
                        (payload.log_ids,)
                    )
                    for r in cur.fetchall():
                        if r[0] not in deleted_captures:
                            deleted_captures.append(r[0])
                        if r[1] and r[2]:
                            items_to_delete_from_s3.append((r[1], r[2]))
                    cur.execute("DELETE FROM media_captures WHERE log_id = ANY(%s)", (payload.log_ids,))

                conn.commit()
    except Exception as e:
        logger.exception("Batch screenshot deletion failed")
        raise HTTPException(500, f"Failed to batch delete screenshots: {e}")

    if s3_client and items_to_delete_from_s3:
        for bucket, key in items_to_delete_from_s3:
            try:
                s3_client.delete_object(Bucket=bucket, Key=key)
            except Exception:
                pass

    return {
        "status": "success",
        "deleted_count": len(deleted_captures),
        "deleted_capture_ids": deleted_captures
    }
