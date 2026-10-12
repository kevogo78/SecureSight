import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
from ..config import S3_BUCKET, AWS_REGION

s3_client = boto3.client("s3", region_name=AWS_REGION, config=Config(signature_version="s3v4"))

def generate_upload_url(s3_key: str, expiration_seconds: int = 300) -> str:
    """Generates an expiring presigned PUT URL for direct client S3 upload."""
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key,
                    "ContentType": "application/octet-stream"},
            ExpiresIn=expiration_seconds
        )
        return url
    except ClientError as e:
        print(f"S3 Presign generation error: {e}")
        return None

def generate_download_url(s3_key: str, expiration_seconds: int = 900) -> str:
    """Generates an expiring presigned GET URL for dashboard media review."""
    try:
        return s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=expiration_seconds
        )
    except ClientError as e:
        print(f"S3 Retrieval generation error: {e}")
        return None
