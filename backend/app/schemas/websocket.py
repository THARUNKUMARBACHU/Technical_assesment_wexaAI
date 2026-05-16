from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ---------- Base Message ----------

class WsMessage(BaseModel):
    type: str
    payload: dict = {}
    timestamp: datetime | None = None


# ---------- Client -> Server ----------

class WsSubscribeWidgets(BaseModel):
    type: str = "subscribe_widgets"
    payload: dict  # {"widget_ids": ["uuid", ...]}


class WsSetFilters(BaseModel):
    type: str = "set_filters"
    payload: dict  # {"event_types": [...], "sources": [...]}


# ---------- Server -> Client: Dashboard Channel ----------

class WsWidgetDataUpdate(BaseModel):
    type: str = "widget_data_update"
    payload: dict  # {"widget_id": "uuid", "data": {...}}
    timestamp: datetime


# ---------- Server -> Client: Alerts Channel ----------

class WsAlertFired(BaseModel):
    type: str = "alert_fired"
    payload: dict
    # payload: {event_id, rule_id, rule_name, severity, triggered_value, threshold_value, fired_at}
    timestamp: datetime


class WsAlertResolved(BaseModel):
    type: str = "alert_resolved"
    payload: dict
    # payload: {event_id, rule_id, rule_name, resolved_at}
    timestamp: datetime


# ---------- Server -> Client: Events Channel ----------

class WsNewEvent(BaseModel):
    type: str = "new_event"
    payload: dict
    # payload: {id, event_type, event_name, actor_id, properties, numeric_value, source, timestamp}
    timestamp: datetime


# ---------- Heartbeat ----------

class WsPing(BaseModel):
    type: str = "ping"


class WsPong(BaseModel):
    type: str = "pong"
