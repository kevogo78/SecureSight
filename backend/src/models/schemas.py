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
    consent_paused: Optional[bool] = False
    capture_requested: bool = False
    file_hash: Optional[str] = None
    encryption_iv: Optional[str] = None
    hostname: Optional[str] = None
    os_type: Optional[str] = None
    user: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    website_url: Optional[str] = None

class PresignedURLResponse(BaseModel):
    status: str
    log_id: int
    upload_url: Optional[str] = None

class EndpointUpdate(BaseModel):
    display_name: Optional[str] = None
    custom_name: Optional[str] = None
    mac_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    user: Optional[str] = None

class ConnectionHistoryItem(BaseModel):
    connection_id: int
    endpoint_id: int
    device_fingerprint: Optional[str] = None
    mac_address: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    connected_at: Optional[str] = None
    last_seen: Optional[str] = None
    status: str = "Online"
