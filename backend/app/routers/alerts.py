from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_org_id, get_current_user, get_db, require_role
from app.models.auth import User
from app.schemas.alert import (
    AlertEventOut, AlertRuleOut, CreateAlertRuleRequest,
    MuteAlertRequest, ToggleAlertRequest, UpdateAlertRuleRequest,
)
from app.services.alert import AlertEventService, AlertRuleService

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ---------- Alert Rules ----------

@router.get("/rules", response_model=list[AlertRuleOut])
async def list_rules(
    status: str | None = None,
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    rules = await svc.list_rules(org_id, status)
    return [AlertRuleOut.model_validate(r) for r in rules]


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_rule(
    body: CreateAlertRuleRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    rule = await svc.create(org_id, user.id, body.model_dump())
    return AlertRuleOut.model_validate(rule)


@router.get("/rules/{rule_id}", response_model=AlertRuleOut)
async def get_rule(
    rule_id: UUID,
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    rule = await svc.get(rule_id, org_id)
    return AlertRuleOut.model_validate(rule)


@router.patch("/rules/{rule_id}", response_model=AlertRuleOut)
async def update_rule(
    rule_id: UUID,
    body: UpdateAlertRuleRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    rule = await svc.update(rule_id, org_id, body.model_dump(exclude_unset=True))
    return AlertRuleOut.model_validate(rule)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    await svc.delete(rule_id, org_id)


@router.post("/rules/{rule_id}/mute")
async def mute_rule(
    rule_id: UUID,
    body: MuteAlertRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    return await svc.mute(rule_id, org_id, body.duration_minutes)


@router.post("/rules/{rule_id}/unmute")
async def unmute_rule(
    rule_id: UUID,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    await svc.unmute(rule_id, org_id)
    return {"status": "unmuted"}


@router.patch("/rules/{rule_id}/toggle")
async def toggle_rule(
    rule_id: UUID,
    body: ToggleAlertRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertRuleService(db)
    await svc.toggle(rule_id, org_id, body.is_enabled)
    return {"is_enabled": body.is_enabled}


# ---------- Alert Events (History) ----------

@router.get("/events")
async def list_alert_events(
    status: str | None = None,
    rule_id: UUID | None = None,
    time_range: str = Query("7d", pattern="^(24h|7d|30d)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertEventService(db)
    return await svc.list_events(org_id, {
        "status": status,
        "rule_id": rule_id,
        "time_range": time_range,
        "limit": limit,
        "offset": offset,
    })


@router.patch("/events/{event_id}/acknowledge")
async def acknowledge_event(
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertEventService(db)
    return await svc.acknowledge(event_id, user.id)


@router.patch("/events/{event_id}/resolve")
async def resolve_event(
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = AlertEventService(db)
    return await svc.resolve(event_id)
