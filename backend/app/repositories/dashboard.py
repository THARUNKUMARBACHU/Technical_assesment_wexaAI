from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dashboard import Dashboard, DashboardShare, Widget


class DashboardRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Dashboard:
        d = Dashboard(**kwargs)
        self.db.add(d)
        await self.db.flush()
        await self.db.refresh(d)
        return d

    async def get_by_id(self, dashboard_id: UUID, org_id: UUID) -> Dashboard | None:
        result = await self.db.execute(
            select(Dashboard)
            .options(selectinload(Dashboard.widgets))
            .where(
                Dashboard.id == dashboard_id,
                Dashboard.org_id == org_id,
                Dashboard.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_org(
        self, org_id: UUID, filter: str | None = None, user_id: UUID | None = None, search: str | None = None
    ) -> list[dict]:
        q = (
            select(
                Dashboard.id,
                Dashboard.title,
                Dashboard.description,
                Dashboard.is_default,
                Dashboard.auto_refresh_seconds,
                Dashboard.created_by,
                Dashboard.updated_at,
                Dashboard.created_at,
                func.count(Widget.id).label("widget_count"),
            )
            .outerjoin(Widget, (Widget.dashboard_id == Dashboard.id) & Widget.deleted_at.is_(None))
            .where(Dashboard.org_id == org_id, Dashboard.deleted_at.is_(None))
            .group_by(Dashboard.id)
            .order_by(Dashboard.updated_at.desc().nullslast(), Dashboard.created_at.desc())
        )

        if filter == "mine" and user_id:
            q = q.where(Dashboard.created_by == user_id)

        if search:
            q = q.where(Dashboard.title.ilike(f"%{search}%"))

        result = await self.db.execute(q)
        return [dict(row._mapping) for row in result.all()]

    async def update(self, dashboard: Dashboard, **kwargs) -> Dashboard:
        for k, v in kwargs.items():
            if v is not None:
                setattr(dashboard, k, v)
        await self.db.flush()
        await self.db.refresh(dashboard)
        return dashboard


class WidgetRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Widget:
        w = Widget(**kwargs)
        self.db.add(w)
        await self.db.flush()
        await self.db.refresh(w)
        return w

    async def get_by_id(self, widget_id: UUID, dashboard_id: UUID) -> Widget | None:
        result = await self.db.execute(
            select(Widget).where(
                Widget.id == widget_id,
                Widget.dashboard_id == dashboard_id,
                Widget.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def update(self, widget: Widget, **kwargs) -> Widget:
        for k, v in kwargs.items():
            if v is not None:
                setattr(widget, k, v)
        await self.db.flush()
        await self.db.refresh(widget)
        return widget

    async def bulk_update_positions(self, dashboard_id: UUID, layouts: list[dict]) -> None:
        for item in layouts:
            result = await self.db.execute(
                select(Widget).where(
                    Widget.id == item["widget_id"],
                    Widget.dashboard_id == dashboard_id,
                )
            )
            widget = result.scalar_one_or_none()
            if widget:
                widget.position = {"x": item["x"], "y": item["y"], "w": item["w"], "h": item["h"]}
        await self.db.flush()


class DashboardShareRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> DashboardShare:
        s = DashboardShare(**kwargs)
        self.db.add(s)
        await self.db.flush()
        await self.db.refresh(s)
        return s

    async def get_by_token(self, share_token: str) -> DashboardShare | None:
        result = await self.db.execute(
            select(DashboardShare).where(DashboardShare.share_token == share_token)
        )
        return result.scalar_one_or_none()

    async def get_dashboard_by_share_token(self, share_token: str) -> Dashboard | None:
        result = await self.db.execute(
            select(DashboardShare).where(DashboardShare.share_token == share_token)
        )
        share = result.scalar_one_or_none()
        if not share:
            return None

        from datetime import datetime, timezone
        if share.expires_at and share.expires_at < datetime.now(timezone.utc):
            return None

        d_result = await self.db.execute(
            select(Dashboard)
            .options(selectinload(Dashboard.widgets))
            .where(Dashboard.id == share.dashboard_id, Dashboard.deleted_at.is_(None))
        )
        return d_result.scalar_one_or_none()
