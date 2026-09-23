from pydantic import BaseModel, Field
from typing import Optional

class TelemetryPayload(BaseModel):
    endpoint_id: int
    active_app: str = Field(..., max_length=100)
    app_category: str = Field(default="General", max_length=50)
    keystroke_count: int = Field(default=0, ge=0)
    activity_state: str = Field(default="Active")
    cpu_percent: float = Field(..., ge=0.0, le=100.0)
    ram_percent: float = Field(..., ge=0.0, le=100.0)
    filter_status: str = Field(default="Clean", max_length=50)
    dlp_flag: bool = Field(default=False)
    capture_requested: bool = False
    file_hash: Optional[str] = None
    encryption_iv: Optional[str] = None

class PresignedURLResponse(BaseModel):
    status: str
    log_id: int
    upload_url: Optional[str] = None