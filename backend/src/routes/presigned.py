from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from ..utils.s3_helper import generate_upload_url, generate_download_url
from ..database import get_db_connection

router = APIRouter(prefix="/api/v1/presigned", tags=["Presigned Media Operations"])

# --- Request / Response Models ---

class UploadURLRequest(BaseModel):
    endpoint_id: int = Field(..., description="ID of the client endpoint requesting the upload")
    log_id: int = Field(..., description="Associated audit_log entry ID")
    file_extension: str = Field(default="enc", description="File extension, defaults to encrypted .enc")

class UploadURLResponse(BaseModel):
    status: str
    s3_key: str
    upload_url: str
    expires_in_seconds: int

class DownloadURLResponse(BaseModel):
    status: str
    s3_key: str
    download_url: str
    expires_in_seconds: int


# --- Endpoints ---

@router.post("/upload-url", response_model=UploadURLResponse, status_code=status.HTTP_200_OK)
def request_s3_upload_url(payload: UploadURLRequest):
    """
    Generates a secure, expiring presigned PUT URL allowing the client agent
    to upload an encrypted screenshot directly to the S3 bucket.
    """
    # Verify that the referencing audit_log exists in RDS PostgreSQL
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT log_id FROM audit_logs WHERE log_id = %s AND endpoint_id = %s;",
                    (payload.log_id, payload.endpoint_id)
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Referenced log_id for this endpoint does not exist."
                    )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database verification failure: {str(e)}"
        )

    # Standardized S3 object key partitioning: screenshots/<endpoint_id>/<log_id>.<ext>
    s3_key = f"screenshots/{payload.endpoint_id}/{payload.log_id}.{payload.file_extension}"
    expiration = 300  # 5 minutes validity

    upload_url = generate_upload_url(s3_key=s3_key, expiration_seconds=expiration)
    
    if not upload_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate S3 presigned upload URL from AWS SDK."
        )

    return UploadURLResponse(
        status="success",
        s3_key=s3_key,
        upload_url=upload_url,
        expires_in_seconds=expiration
    )


@router.get("/download-url", response_model=DownloadURLResponse, status_code=status.HTTP_200_OK)
def request_s3_download_url(
    s3_key: str = Query(..., description="Target S3 object key stored in media_captures"),
    expiration: int = Query(default=900, ge=60, le=3600, description="Token expiration window in seconds")
):
    """
    Generates an expiring presigned GET URL allowing administrators
    viewing the React dashboard to inspect media stored in private S3 buckets.
    """
    download_url = generate_download_url(s3_key=s3_key, expiration_seconds=expiration)

    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate S3 presigned download URL."
        )

    return DownloadURLResponse(
        status="success",
        s3_key=s3_key,
        download_url=download_url,
        expires_in_seconds=expiration
    )