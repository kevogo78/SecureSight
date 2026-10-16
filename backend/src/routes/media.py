"""Fetch encrypted evidence from S3 and decrypt only for signed-in admins."""
import hashlib
import hmac
import logging
import os

from botocore.exceptions import ClientError, BotoCoreError
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Response

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
