from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import AlertEvent, AlertRule


class AlertRuleRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> AlertRule:
        rule = AlertRule(**kwargs)
        self.db.add(rule)
        await self.db.flush()
        await self.db.refresh(rule)
        return rule

    async def get_by_id(self, rule_id: UUID, org_id: UUID) -> AlertRule | None:
        result = await self.db.execute(
            select(AlertRule).where(
                AlertRule.id == rule_id,
                AlertRule.org_id == org_id,
                AlertRule.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_org(self, org_id: UUID, status: str | None = None) -> list[AlertRule]:
        q = select(AlertRule).where(AlertRule.org_id == org_id, AlertRule.deleted_at.is_(None))
        if status == "active":
            q = q.where(AlertRule.is_enabled.is_(True), AlertRule.is_muted.is_(False))
        elif status == "muted":
            q = q.where(AlertRule.is_muted.is_(True))
        q = q.order_by(AlertRule.created_at.desc())
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def list_enabled(self) -> list[AlertRule]:
        """All enabled, non-muted rules across all orgs (for Celery beat evaluation)."""
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(AlertRule).where(
                AlertRule.is_enabled.is_(True),
                AlertRule.deleted_at.is_(None),
                # Not muted, or mute has expired
                (AlertRule.is_muted.is_(False)) | (AlertRule.muted_until < now),
            )
        )
        return list(result.scalars().all())

    async def update(self, rule: AlertRule, **kwargs) -> AlertRule:
        for k, v in kwargs.items():
            if v is not None:
                setattr(rule, k, v)
        await self.db.flush()
        await self.db.refresh(rule)
        return rule


class AlertEventRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> AlertEvent:
        event = AlertEvent(**kwargs)
        self.db.add(event)
        await self.db.flush()
        await self.db.refresh(event)
        return event

    async def get_by_id(self, event_id: UUID) -> AlertEvent | None:
        result = await self.db.execute(
            select(AlertEvent).where(AlertEvent.id == event_id)
        )
        return result.scalar_one_or_none()

    async def list_by_org(
        self,
        org_id: UUID,
        status: str | None = None,
        rule_id: UUID | None = None,
        start_time: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[AlertEvent], int]:
        conditions = [AlertEvent.org_id == org_id]
        if status and status != "all":
            conditions.append(AlertEvent.status == status)
        if rule_id:
            conditions.append(AlertEvent.rule_id == rule_id)
        if start_time:
            conditions.append(AlertEvent.fired_at >= start_time)

        where = and_(*conditions)

        count_q = select(func.count()).select_from(AlertEvent).where(where)
        total = (await self.db.execute(count_q)).scalar_one()

        q = select(AlertEvent).where(where).order_by(AlertEvent.fired_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total
