from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFound
from app.repositories.alert import AlertEventRepo, AlertRuleRepo


class AlertRuleService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rules = AlertRuleRepo(db)

    async def create(self, org_id: UUID, user_id: UUID, data: dict):
        return await self.rules.create(
            org_id=org_id,
            created_by=user_id,
            name=data["name"],
            description=data.get("description"),
            severity=data["severity"],
            condition=data["condition"],
            cooldown_minutes=data.get("cooldown_minutes", 15),
            notification_channels=data["notification_channels"],
            email_recipients=data.get("email_recipients", []),
            webhook_url=data.get("webhook_url"),
        )

    async def list_rules(self, org_id: UUID, status: str | None = None):
        return await self.rules.list_by_org(org_id, status)

    async def get(self, rule_id: UUID, org_id: UUID):
        rule = await self.rules.get_by_id(rule_id, org_id)
        if not rule:
            raise NotFound("Alert rule not found")
        return rule

    async def update(self, rule_id: UUID, org_id: UUID, data: dict):
        rule = await self.rules.get_by_id(rule_id, org_id)
        if not rule:
            raise NotFound("Alert rule not found")
        return await self.rules.update(rule, **data)

    async def delete(self, rule_id: UUID, org_id: UUID):
        rule = await self.rules.get_by_id(rule_id, org_id)
        if not rule:
            raise NotFound("Alert rule not found")
        rule.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def mute(self, rule_id: UUID, org_id: UUID, duration_minutes: int):
        rule = await self.rules.get_by_id(rule_id, org_id)
        if not rule:
            raise NotFound("Alert rule not found")
        rule.is_muted = True
        rule.muted_until = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        await self.db.flush()
        return {"is_muted": True, "muted_until": rule.muted_until}

    async def unmute(self, rule_id: UUID, org_id: UUID):
        rule = await self.rules.get_by_id(rule_id, org_id)
        if not rule:
            raise NotFound("Alert rule not found")
        rule.is_muted = False
        rule.muted_until = None
        await self.db.flush()

    async def toggle(self, rule_id: UUID, org_id: UUID, is_enabled: bool):
        rule = await self.rules.get_by_id(rule_id, org_id)
        if not rule:
            raise NotFound("Alert rule not found")
        rule.is_enabled = is_enabled
        await self.db.flush()


class AlertEventService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.events = AlertEventRepo(db)
        self.rules = AlertRuleRepo(db)

    async def list_events(self, org_id: UUID, params: dict) -> dict:
        time_range = params.get("time_range", "7d")
        range_map = {"24h": 24, "7d": 168, "30d": 720}
        hours = range_map.get(time_range, 168)
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        events, total = await self.events.list_by_org(
            org_id=org_id,
            status=params.get("status"),
            rule_id=params.get("rule_id"),
            start_time=start_time,
            limit=params.get("limit", 20),
            offset=params.get("offset", 0),
        )

        # Enrich with rule name
        items = []
        for e in events:
            rule = await self.rules.get_by_id(e.rule_id, org_id)
            items.append({
                "id": e.id,
                "rule_id": e.rule_id,
                "rule_name": rule.name if rule else "Unknown",
                "severity": rule.severity if rule else "info",
                "status": e.status,
                "triggered_value": e.triggered_value,
                "threshold_value": e.threshold_value,
                "operator": e.operator,
                "fired_at": e.fired_at,
                "acknowledged_at": e.acknowledged_at,
                "acknowledged_by": e.acknowledged_by,
                "resolved_at": e.resolved_at,
            })

        return {
            "items": items,
            "total": total,
            "limit": params.get("limit", 20),
            "offset": params.get("offset", 0),
        }

    async def acknowledge(self, event_id: UUID, user_id: UUID):
        event = await self.events.get_by_id(event_id)
        if not event:
            raise NotFound("Alert event not found")
        event.status = "acknowledged"
        event.acknowledged_at = datetime.now(timezone.utc)
        event.acknowledged_by = user_id
        await self.db.flush()
        return {
            "status": "acknowledged",
            "acknowledged_at": event.acknowledged_at,
            "acknowledged_by": event.acknowledged_by,
        }

    async def resolve(self, event_id: UUID):
        event = await self.events.get_by_id(event_id)
        if not event:
            raise NotFound("Alert event not found")
        event.status = "resolved"
        event.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()
        return {"status": "resolved", "resolved_at": event.resolved_at}
