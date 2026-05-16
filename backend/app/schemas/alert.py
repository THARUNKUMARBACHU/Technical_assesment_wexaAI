from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------- Alert Condition ----------

class AlertCondition(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100)
    metric: str = Field(..., pattern=r"^(count|sum|avg|min|max)$")
    operator: str = Field(..., pattern=r"^(gt|lt|eq|gte|lte)$")
    threshold: float
    time_window_minutes: int = Field(..., ge=1, le=1440)


# ---------- Alert Rule CRUD ----------

class CreateAlertRuleRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    severity: str = Field(..., pattern=r"^(info|warning|critical)$")
    condition: AlertCondition
    cooldown_minutes: int = Field(15, ge=1, le=1440)
    notification_channels: list[str] = Field(..., min_length=1)
    email_recipients: list[str] = []
    webhook_url: str | None = None


class UpdateAlertRuleRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    severity: str | None = Field(None, pattern=r"^(info|warning|critical)$")
    condition: AlertCondition | None = None
    cooldown_minutes: int | None = Field(None, ge=1, le=1440)
    notification_channels: list[str] | None = None
    email_recipients: list[str] | None = None
    webhook_url: str | None = None


class MuteAlertRequest(BaseModel):
    duration_minutes: int = Field(..., ge=1, le=10080)  # max 7 days


class ToggleAlertRequest(BaseModel):
    is_enabled: bool


class AlertRuleOut(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    severity: str
    is_enabled: bool
    is_muted: bool
    muted_until: datetime | None = None
    condition: dict
    cooldown_minutes: int
    notification_channels: list[str]
    email_recipients: list[str]
    webhook_url: str | None = None
    last_triggered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Alert Events (History) ----------

class AlertEventOut(BaseModel):
    id: UUID
    rule_id: UUID
    rule_name: str
    severity: str
    status: str  # firing, acknowledged, resolved
    triggered_value: float
    threshold_value: float
    operator: str
    fired_at: datetime
    acknowledged_at: datetime | None = None
    acknowledged_by: UUID | None = None
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}


class AlertEventsQueryParams(BaseModel):
    status: str | None = Field(None, pattern=r"^(all|firing|acknowledged|resolved)$")
    rule_id: UUID | None = None
    time_range: str = Field("7d", pattern=r"^(24h|7d|30d)$")
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)
