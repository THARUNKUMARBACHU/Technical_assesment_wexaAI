from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_org_id, get_current_user, get_db, require_role
from app.models.auth import User
from app.schemas.dashboard import (
    CreateDashboardRequest, CreateShareRequest, CreateWidgetRequest,
    DashboardOut, DashboardShareOut, LayoutUpdateRequest,
    UpdateDashboardRequest, UpdateWidgetRequest, WidgetDataResponse, WidgetOut,
)
from app.services.dashboard import DashboardService, ShareService, WidgetService

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


async def _enrich_dashboard(dashboard, db: AsyncSession) -> dict:
    """Convert a Dashboard ORM object to a dict with created_by as {id, full_name}."""
    creator_id = dashboard.created_by
    result = await db.execute(select(User).where(User.id == creator_id))
    creator = result.scalar_one_or_none()

    data = {
        "id": dashboard.id,
        "title": dashboard.title,
        "description": dashboard.description,
        "is_default": dashboard.is_default,
        "auto_refresh_seconds": dashboard.auto_refresh_seconds,
        "layout": dashboard.layout,
        "widgets": dashboard.widgets if hasattr(dashboard, "widgets") else [],
        "created_by": {"id": creator_id, "full_name": creator.full_name if creator else "Unknown"},
        "updated_at": dashboard.updated_at,
        "created_at": dashboard.created_at,
    }
    return data


# ---------- Dashboard CRUD ----------

@router.get("")
async def list_dashboards(
    filter: str = Query("all"),
    search: str | None = None,
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DashboardService(db)
    rows = await svc.list_dashboards(org_id, user.id, filter=filter, search=search)
    # Enrich created_by UUID with user name
    user_cache: dict[UUID, str] = {}
    enriched = []
    for row in rows:
        uid = row["created_by"]
        if uid not in user_cache:
            result = await db.execute(select(User).where(User.id == uid))
            u = result.scalar_one_or_none()
            user_cache[uid] = u.full_name if u else "Unknown"
        row["created_by"] = {"id": uid, "full_name": user_cache[uid]}
        enriched.append(row)
    return enriched


@router.post("", status_code=201)
async def create_dashboard(
    body: CreateDashboardRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DashboardService(db)
    dashboard = await svc.create(org_id, user.id, body.model_dump())
    data = await _enrich_dashboard(dashboard, db)
    return DashboardOut.model_validate(data)


@router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: UUID,
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DashboardService(db)
    dashboard = await svc.get(dashboard_id, org_id)
    data = await _enrich_dashboard(dashboard, db)
    return DashboardOut.model_validate(data)


@router.patch("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: UUID,
    body: UpdateDashboardRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DashboardService(db)
    dashboard = await svc.update(dashboard_id, org_id, body.model_dump(exclude_unset=True))
    data = await _enrich_dashboard(dashboard, db)
    return DashboardOut.model_validate(data)


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: UUID,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DashboardService(db)
    await svc.delete(dashboard_id, org_id)


@router.post("/{dashboard_id}/duplicate", status_code=201)
async def duplicate_dashboard(
    dashboard_id: UUID,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DashboardService(db)
    dashboard = await svc.duplicate(dashboard_id, org_id, user.id)
    data = await _enrich_dashboard(dashboard, db)
    return DashboardOut.model_validate(data)


# ---------- Widgets ----------

@router.post("/{dashboard_id}/widgets", status_code=201)
async def create_widget(
    dashboard_id: UUID,
    body: CreateWidgetRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = WidgetService(db)
    widget = await svc.create(dashboard_id, org_id, body.model_dump())
    return WidgetOut.model_validate(widget)


@router.patch("/{dashboard_id}/widgets/{widget_id}")
async def update_widget(
    dashboard_id: UUID,
    widget_id: UUID,
    body: UpdateWidgetRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    db: AsyncSession = Depends(get_db),
):
    svc = WidgetService(db)
    widget = await svc.update(dashboard_id, widget_id, body.model_dump(exclude_unset=True))
    return WidgetOut.model_validate(widget)


@router.delete("/{dashboard_id}/widgets/{widget_id}", status_code=204)
async def delete_widget(
    dashboard_id: UUID,
    widget_id: UUID,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    db: AsyncSession = Depends(get_db),
):
    svc = WidgetService(db)
    await svc.delete(dashboard_id, widget_id)


@router.patch("/{dashboard_id}/layout")
async def update_layout(
    dashboard_id: UUID,
    body: LayoutUpdateRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    db: AsyncSession = Depends(get_db),
):
    svc = WidgetService(db)
    await svc.update_layout(dashboard_id, [item.model_dump() for item in body.layout])
    return {"status": "ok"}


@router.get("/{dashboard_id}/widgets/{widget_id}/data")
async def get_widget_data(
    dashboard_id: UUID,
    widget_id: UUID,
    time_range: str | None = None,
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = WidgetService(db)
    return await svc.get_data(dashboard_id, widget_id, org_id, time_range)


# ---------- Sharing ----------

@router.post("/{dashboard_id}/share", status_code=201)
async def share_dashboard(
    dashboard_id: UUID,
    body: CreateShareRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    db: AsyncSession = Depends(get_db),
):
    svc = ShareService(db)
    share = await svc.create_share(dashboard_id, body.model_dump())
    return DashboardShareOut.model_validate(share)
