from fastapi import APIRouter, HTTPException
from ..models.schemas import TelemetryPayload, PresignedURLResponse
from ..database import get_db_connection
from ..utils.s3_helper import generate_upload_url
from ..config import S3_BUCKET

router = APIRouter(prefix="/api/v1", tags=["Telemetry"])

@router.post("/telemetry", response_model=PresignedURLResponse)
def record_telemetry(payload: TelemetryPayload):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
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

                upload_url = None
                if payload.capture_requested and payload.file_hash:
                    s3_key = f"screenshots/{payload.endpoint_id}/{log_id}.enc"
                    upload_url = generate_upload_url(s3_key)
                    
                    cur.execute("""
                        INSERT INTO media_captures (log_id, s3_bucket, s3_key, file_hash, encryption_iv)
                        VALUES (%s, %s, %s, %s, %s);
                    """, (log_id, S3_BUCKET, s3_key, payload.file_hash, payload.encryption_iv or ""))

                conn.commit()
                return PresignedURLResponse(status="success", log_id=log_id, upload_url=upload_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database write failure: {str(e)}")