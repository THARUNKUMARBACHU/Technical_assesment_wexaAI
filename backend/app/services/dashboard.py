import copy
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFound
from app.models.auth import User
from app.repositories.dashboard import DashboardRepo, DashboardShareRepo, WidgetRepo
from app.repositories.ingestion import EventRepo
from app.utils.security import generate_token


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.dashboards = DashboardRepo(db)
        self.widgets = WidgetRepo(db)

    async def create(self, org_id: UUID, user_id: UUID, data: dict) -> dict:
        dashboard = await self.dashboards.create(
            org_id=org_id,
            created_by=user_id,
            title=data["title"],
            description=data.get("description"),
            is_default=data.get("is_default", False),
            auto_refresh_seconds=data.get("auto_refresh_seconds"),
        )
        return dashboard

    async def get(self, dashboard_id: UUID, org_id: UUID):
        dashboard = await self.dashboards.get_by_id(dashboard_id, org_id)
        if not dashboard:
            raise NotFound("Dashboard not found")
        return dashboard

    async def list_dashboards(self, org_id: UUID, user_id: UUID, filter: str | None = None, search: str | None = None):
        return await self.dashboards.list_by_org(org_id, filter=filter, user_id=user_id, search=search)

    async def update(self, dashboard_id: UUID, org_id: UUID, data: dict):
        dashboard = await self.dashboards.get_by_id(dashboard_id, org_id)
        if not dashboard:
            raise NotFound("Dashboard not found")
        return await self.dashboards.update(dashboard, **data)

    async def delete(self, dashboard_id: UUID, org_id: UUID):
        dashboard = await self.dashboards.get_by_id(dashboard_id, org_id)
        if not dashboard:
            raise NotFound("Dashboard not found")
        from datetime import datetime, timezone
        dashboard.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def duplicate(self, dashboard_id: UUID, org_id: UUID, user_id: UUID):
        original = await self.dashboards.get_by_id(dashboard_id, org_id)
        if not original:
            raise NotFound("Dashboard not found")

        new_dash = await self.dashboards.create(
            org_id=org_id,
            created_by=user_id,
            title=f"{original.title} (Copy)",
            description=original.description,
            is_default=False,
            auto_refresh_seconds=original.auto_refresh_seconds,
        )

        for w in original.widgets:
            if w.deleted_at is None:
                await self.widgets.create(
                    dashboard_id=new_dash.id,
                    org_id=org_id,
                    title=w.title,
                    widget_type=w.widget_type,
                    config=copy.deepcopy(w.config),
                    time_range=copy.deepcopy(w.time_range),
                    position=copy.deepcopy(w.position),
                )

        return await self.dashboards.get_by_id(new_dash.id, org_id)


class WidgetService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.widgets = WidgetRepo(db)
        self.events = EventRepo(db)

    async def create(self, dashboard_id: UUID, org_id: UUID, data: dict):
        return await self.widgets.create(
            dashboard_id=dashboard_id,
            org_id=org_id,
            title=data["title"],
            widget_type=data["widget_type"],
            config=data["config"],
            time_range=data["time_range"],
            position=data["position"],
        )

    async def update(self, dashboard_id: UUID, widget_id: UUID, data: dict):
        widget = await self.widgets.get_by_id(widget_id, dashboard_id)
        if not widget:
            raise NotFound("Widget not found")
        return await self.widgets.update(widget, **data)

    async def delete(self, dashboard_id: UUID, widget_id: UUID):
        widget = await self.widgets.get_by_id(widget_id, dashboard_id)
        if not widget:
            raise NotFound("Widget not found")
        widget.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def update_layout(self, dashboard_id: UUID, layouts: list[dict]):
        await self.widgets.bulk_update_positions(dashboard_id, layouts)

    async def get_data(self, dashboard_id: UUID, widget_id: UUID, org_id: UUID, time_range_override: str | None = None):
        widget = await self.widgets.get_by_id(widget_id, dashboard_id)
        if not widget:
            raise NotFound("Widget not found")

        config = widget.config
        tr = widget.time_range

        # Determine time range
        now = datetime.now(timezone.utc)
        range_value = time_range_override or tr.get("value", "24h")
        range_map = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}
        hours = range_map.get(range_value, 24)
        start_time = now - timedelta(hours=hours)

        # Query aggregated data
        rows = await self.events.aggregate(
            org_id=org_id,
            event_type=config.get("event_type", ""),
            aggregation=config.get("aggregation", "count"),
            time_bucket=config.get("time_bucket", "hour"),
            start_time=start_time,
            end_time=now,
            group_by=config.get("group_by"),
            filters=config.get("filters"),
        )

        widget_type = widget.widget_type
        data = self._format_data(widget_type, rows, config)

        return {
            "widget_id": widget.id,
            "widget_type": widget_type,
            "data": data,
            "meta": {
                "total": len(rows),
                "time_range": {"start": start_time.isoformat(), "end": now.isoformat()},
                "aggregation": config.get("aggregation", "count"),
                "time_bucket": config.get("time_bucket", "hour"),
            },
        }

    def _format_data(self, widget_type: str, rows: list[dict], config: dict) -> dict:
        if widget_type in ("line", "bar"):
            group_by = config.get("group_by")
            if group_by and group_by != "none":
                # Grouped datasets
                groups: dict[str, list] = {}
                labels = []
                for row in rows:
                    label = str(row["bucket"])
                    if label not in labels:
                        labels.append(label)
                    gk = str(row.get("group_key", ""))
                    groups.setdefault(gk, []).append(row["value"])
                return {
                    "labels": labels,
                    "datasets": [{"label": k, "values": v} for k, v in groups.items()],
                }
            else:
                return {
                    "labels": [str(r["bucket"]) for r in rows],
                    "datasets": [{"label": config.get("event_type", ""), "values": [r["value"] for r in rows]}],
                }

        elif widget_type == "kpi":
            current = rows[-1]["value"] if rows else 0
            previous = rows[-2]["value"] if len(rows) >= 2 else current
            change = round(((current - previous) / max(previous, 1)) * 100, 1)
            return {
                "current_value": current,
                "previous_value": previous,
                "change_percent": abs(change),
                "change_direction": "up" if change > 0 else "down" if change < 0 else "flat",
            }

        elif widget_type == "pie":
            return {
                "labels": [str(r.get("group_key", r.get("bucket", ""))) for r in rows],
                "values": [r["value"] for r in rows],
            }

        elif widget_type == "table":
            group_by = config.get("group_by")
            if group_by and group_by != "none":
                return {
                    "columns": [group_by, config.get("aggregation", "count")],
                    "rows": [{group_by: r.get("group_key", ""), config.get("aggregation", "count"): r["value"]} for r in rows],
                }
            return {
                "columns": ["bucket", "value"],
                "rows": [{"bucket": str(r["bucket"]), "value": r["value"]} for r in rows],
            }

        return {"raw": rows}


class ShareService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.shares = DashboardShareRepo(db)
        self.dashboards = DashboardRepo(db)

    async def create_share(self, dashboard_id: UUID, data: dict):
        raw_token, token_hash = generate_token()
        share = await self.shares.create(
            dashboard_id=dashboard_id,
            shared_with_user_id=data.get("shared_with_user_id"),
            share_token=raw_token,
            permission=data.get("permission", "view"),
            expires_at=data.get("expires_at"),
        )
        return share

    async def get_shared_dashboard(self, share_token: str):
        dashboard = await self.shares.get_dashboard_by_share_token(share_token)
        if not dashboard:
            raise NotFound("Shared dashboard not found or expired")
        return dashboard
