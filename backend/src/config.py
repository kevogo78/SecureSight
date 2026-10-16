import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "endpoint_monitor")
DB_USER = os.getenv("DB_USER", "postgresadmin")
DB_PASS = os.getenv("DB_PASS", "postgrespassword")
DB_PORT = os.getenv("DB_PORT", "5432")

S3_BUCKET = os.getenv("S3_BUCKET", "endpoint-monitor-media-captures")
AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
