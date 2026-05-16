from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.auth import User
from app.schemas.dashboard import DashboardOut
from app.services.dashboard import ShareService, WidgetService

router = APIRouter(prefix="/shared", tags=["shared"])


@router.get("/{share_token}")
async def get_shared_dashboard(share_token: str, db: AsyncSession = Depends(get_db)):
    svc = ShareService(db)
    dashboard = await svc.get_shared_dashboard(share_token)
    # Enrich created_by UUID → {id, full_name} to match DashboardOut schema
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
    return DashboardOut.model_validate(data)


@router.get("/{share_token}/widgets/{widget_id}/data")
async def get_shared_widget_data(
    share_token: str,
    widget_id: UUID,
    time_range: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Public widget data endpoint — no auth required, validated via share token."""
    share_svc = ShareService(db)
    dashboard = await share_svc.get_shared_dashboard(share_token)
    widget_svc = WidgetService(db)
    return await widget_svc.get_data(dashboard.id, widget_id, dashboard.org_id, time_range)
