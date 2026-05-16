from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------- Widget Config Sub-Schemas ----------

class WidgetFilter(BaseModel):
    field: str
    operator: str = Field(..., pattern=r"^(eq|neq|gt|gte|lt|lte|contains|in)$")
    value: str | int | float | list[str]


class WidgetConfig(BaseModel):
    event_type: str
    aggregation: str = Field(..., pattern=r"^(count|sum|avg|min|max)$")
    time_bucket: str = Field("hour", pattern=r"^(minute|hour|day|week|month)$")
    group_by: str | None = None
    filters: list[WidgetFilter] = []


class WidgetTimeRange(BaseModel):
    type: str = Field(..., pattern=r"^(relative|absolute)$")
    value: str | None = None  # "1h", "6h", "24h", "7d", "30d"
    start: datetime | None = None
    end: datetime | None = None


class WidgetPosition(BaseModel):
    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)
    w: int = Field(..., ge=1, le=12)
    h: int = Field(..., ge=1)


# ---------- Widget CRUD ----------

class CreateWidgetRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    widget_type: str = Field(..., pattern=r"^(line|bar|pie|kpi|table)$")
    config: WidgetConfig
    time_range: WidgetTimeRange
    position: WidgetPosition


class UpdateWidgetRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    config: WidgetConfig | None = None
    time_range: WidgetTimeRange | None = None
    position: WidgetPosition | None = None


class WidgetOut(BaseModel):
    id: UUID
    title: str
    widget_type: str
    config: dict
    time_range: dict
    position: dict
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Dashboard CRUD ----------

class CreateDashboardRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    is_default: bool = False
    auto_refresh_seconds: int | None = None


class UpdateDashboardRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    is_default: bool | None = None
    auto_refresh_seconds: int | None = None


class DashboardCreatorOut(BaseModel):
    id: UUID
    full_name: str

    model_config = {"from_attributes": True}


class DashboardSummaryOut(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    widget_count: int = 0
    is_default: bool
    auto_refresh_seconds: int | None = None
    created_by: DashboardCreatorOut
    updated_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardOut(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    is_default: bool
    auto_refresh_seconds: int | None = None
    layout: dict = {}
    widgets: list[WidgetOut] = []
    created_by: DashboardCreatorOut
    updated_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Layout Bulk Update ----------

class LayoutItem(BaseModel):
    widget_id: UUID
    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)
    w: int = Field(..., ge=1, le=12)
    h: int = Field(..., ge=1)


class LayoutUpdateRequest(BaseModel):
    layout: list[LayoutItem]


# ---------- Widget Data Responses ----------

class DatasetOut(BaseModel):
    label: str
    values: list[float | int]


class LineChartData(BaseModel):
    labels: list[str]
    datasets: list[DatasetOut]


class BarChartData(BaseModel):
    labels: list[str]
    datasets: list[DatasetOut]


class PieChartData(BaseModel):
    labels: list[str]
    values: list[float | int]


class KpiData(BaseModel):
    current_value: float | int
    previous_value: float | int
    change_percent: float
    change_direction: str = Field(..., pattern=r"^(up|down|flat)$")


class TableData(BaseModel):
    columns: list[str]
    rows: list[dict]


class WidgetDataMeta(BaseModel):
    total: int
    time_range: dict  # {start, end}
    aggregation: str
    time_bucket: str


class WidgetDataResponse(BaseModel):
    widget_id: UUID
    widget_type: str
    data: dict  # LineChartData | BarChartData | PieChartData | KpiData | TableData
    meta: WidgetDataMeta


# ---------- Dashboard Sharing ----------

class CreateShareRequest(BaseModel):
    shared_with_user_id: UUID | None = None
    permission: str = Field("view", pattern=r"^(view|edit)$")
    expires_at: datetime | None = None


class DashboardShareOut(BaseModel):
    id: UUID
    share_token: str
    permission: str
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}
