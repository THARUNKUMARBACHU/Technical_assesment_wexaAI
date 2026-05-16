from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------- Events ----------

class EventIn(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100)
    event_name: str | None = Field(None, max_length=255)
    actor_id: str | None = Field(None, max_length=255)
    properties: dict = Field(default_factory=dict)
    numeric_value: float | None = None
    timestamp: datetime | None = None  # defaults to server time if omitted


class BatchIngestRequest(BaseModel):
    events: list[EventIn] = Field(..., min_length=1, max_length=1000)


class SingleIngestResponse(BaseModel):
    id: UUID
    status: str = "accepted"
    received_at: datetime


class BatchIngestResponse(BaseModel):
    batch_id: UUID
    total_count: int
    status: str = "processing"


class EventOut(BaseModel):
    id: UUID
    event_type: str
    event_name: str | None = None
    actor_id: str | None = None
    properties: dict = {}
    numeric_value: float | None = None
    source: str
    timestamp: datetime
    received_at: datetime

    model_config = {"from_attributes": True}


class EventsQueryParams(BaseModel):
    event_type: str | None = None
    actor_id: str | None = None
    source: str | None = Field(None, pattern=r"^(api|csv|webhook)$")
    start_time: datetime | None = None
    end_time: datetime | None = None
    limit: int = Field(50, ge=1, le=200)
    offset: int = Field(0, ge=0)
    order: str = Field("desc", pattern=r"^(asc|desc)$")


class EventStats(BaseModel):
    today_count: int
    events_per_minute: float
    csv_uploads_this_month: int
    last_csv_upload: dict | None = None  # {filename, row_count}
    active_api_keys: int
    sources: dict  # {api: int, csv: int, webhook: int}


# ---------- API Keys ----------

class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scopes: list[str] = Field(..., min_length=1)
    expires_at: datetime | None = None


class ApiKeyOut(BaseModel):
    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreatedOut(ApiKeyOut):
    """Only returned on creation - includes the full key."""
    key: str


# ---------- CSV Uploads ----------

class CsvUploadResponse(BaseModel):
    id: UUID
    filename: str
    file_size_bytes: int
    row_count: int | None = None
    status: str
    columns: list[str] = []
    preview_rows: list[list[str]] = []
    created_at: datetime


class CsvColumnMapping(BaseModel):
    mapping: dict = Field(
        ...,
        description="Column mapping: {timestamp, event_type, actor_id?, numeric_value?, properties: {key: column}}"
    )


class CsvUploadOut(BaseModel):
    id: UUID
    filename: str
    file_size_bytes: int
    row_count: int | None = None
    status: str
    success_count: int | None = None
    error_count: int | None = None
    error_summary: list[dict] | None = None
    uploaded_by: UUID
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}
