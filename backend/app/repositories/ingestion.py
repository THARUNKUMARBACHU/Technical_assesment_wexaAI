from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import ApiKey, CsvUpload, Event, EventBatch


class EventRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Event:
        event = Event(**kwargs)
        self.db.add(event)
        await self.db.flush()
        return event

    async def bulk_create(self, events: list[dict]) -> int:
        objs = [Event(**e) for e in events]
        self.db.add_all(objs)
        await self.db.flush()
        return len(objs)

    async def list_events(
        self,
        org_id: UUID,
        event_type: str | None = None,
        actor_id: str | None = None,
        source: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
        order: str = "desc",
    ) -> tuple[list[Event], int]:
        conditions = [Event.org_id == org_id]
        if event_type:
            conditions.append(Event.event_type == event_type)
        if actor_id:
            conditions.append(Event.actor_id == actor_id)
        if source:
            conditions.append(Event.source == source)
        if start_time:
            conditions.append(Event.timestamp >= start_time)
        if end_time:
            conditions.append(Event.timestamp <= end_time)

        where = and_(*conditions)

        # Count
        count_q = select(func.count()).select_from(Event).where(where)
        total = (await self.db.execute(count_q)).scalar_one()

        # Fetch
        q = select(Event).where(where)
        if order == "asc":
            q = q.order_by(Event.timestamp.asc())
        else:
            q = q.order_by(Event.timestamp.desc())
        q = q.limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def count_today(self, org_id: UUID) -> int:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count()).select_from(Event).where(
                Event.org_id == org_id,
                Event.timestamp >= today_start,
            )
        )
        return result.scalar_one()

    async def count_by_source(self, org_id: UUID) -> dict[str, int]:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(Event.source, func.count()).where(
                Event.org_id == org_id,
                Event.timestamp >= today_start,
            ).group_by(Event.source)
        )
        return {row[0]: row[1] for row in result.all()}

    async def aggregate(
        self,
        org_id: UUID,
        event_type: str,
        aggregation: str,
        time_bucket: str,
        start_time: datetime,
        end_time: datetime,
        group_by: str | None = None,
        filters: list | None = None,
    ) -> list[dict]:
        """Dynamic aggregation query for widget data."""
        bucket_fn = {
            "minute": func.date_trunc("minute", Event.timestamp),
            "hour": func.date_trunc("hour", Event.timestamp),
            "day": func.date_trunc("day", Event.timestamp),
            "week": func.date_trunc("week", Event.timestamp),
            "month": func.date_trunc("month", Event.timestamp),
        }
        bucket = bucket_fn.get(time_bucket, bucket_fn["hour"])

        agg_fn = {
            "count": func.count(),
            "sum": func.coalesce(func.sum(Event.numeric_value), 0),
            "avg": func.coalesce(func.avg(Event.numeric_value), 0),
            "min": func.coalesce(func.min(Event.numeric_value), 0),
            "max": func.coalesce(func.max(Event.numeric_value), 0),
        }
        agg = agg_fn.get(aggregation, agg_fn["count"])

        conditions = [
            Event.org_id == org_id,
            Event.event_type == event_type,
            Event.timestamp >= start_time,
            Event.timestamp <= end_time,
        ]

        if filters:
            for f in filters:
                field = f.get("field", "")
                op = f.get("operator", "eq")
                val = f.get("value")
                if field.startswith("properties."):
                    json_path = field.removeprefix("properties.")
                    col = Event.properties[json_path].astext
                else:
                    col = getattr(Event, field, None)
                    if col is None:
                        continue
                if op == "eq":
                    conditions.append(col == str(val))
                elif op == "neq":
                    conditions.append(col != str(val))
                elif op == "gt":
                    conditions.append(col > str(val))
                elif op == "lt":
                    conditions.append(col < str(val))

        where = and_(*conditions)

        if group_by and group_by != "none":
            if group_by.startswith("properties."):
                json_path = group_by.removeprefix("properties.")
                group_col = Event.properties[json_path].astext.label("group_key")
            else:
                group_col = getattr(Event, group_by).label("group_key")

            q = (
                select(bucket.label("bucket"), group_col, agg.label("value"))
                .where(where)
                .group_by("bucket", "group_key")
                .order_by("bucket")
            )
        else:
            q = (
                select(bucket.label("bucket"), agg.label("value"))
                .where(where)
                .group_by("bucket")
                .order_by("bucket")
            )

        result = await self.db.execute(q)
        return [dict(row._mapping) for row in result.all()]


class ApiKeyRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> ApiKey:
        key = ApiKey(**kwargs)
        self.db.add(key)
        await self.db.flush()
        await self.db.refresh(key)
        return key

    async def list_by_org(self, org_id: UUID) -> list[ApiKey]:
        result = await self.db.execute(
            select(ApiKey).where(
                ApiKey.org_id == org_id,
                ApiKey.revoked_at.is_(None),
            ).order_by(ApiKey.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, key_id: UUID, org_id: UUID) -> ApiKey | None:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == org_id)
        )
        return result.scalar_one_or_none()

    async def count_active(self, org_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(ApiKey).where(
                ApiKey.org_id == org_id,
                ApiKey.revoked_at.is_(None),
            )
        )
        return result.scalar_one()


class EventBatchRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> EventBatch:
        batch = EventBatch(**kwargs)
        self.db.add(batch)
        await self.db.flush()
        await self.db.refresh(batch)
        return batch


class CsvUploadRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> CsvUpload:
        upload = CsvUpload(**kwargs)
        self.db.add(upload)
        await self.db.flush()
        await self.db.refresh(upload)
        return upload

    async def get_by_id(self, upload_id: UUID, org_id: UUID) -> CsvUpload | None:
        result = await self.db.execute(
            select(CsvUpload).where(CsvUpload.id == upload_id, CsvUpload.org_id == org_id)
        )
        return result.scalar_one_or_none()

    async def list_by_org(self, org_id: UUID) -> list[CsvUpload]:
        result = await self.db.execute(
            select(CsvUpload).where(CsvUpload.org_id == org_id).order_by(CsvUpload.created_at.desc())
        )
        return list(result.scalars().all())

    async def count_this_month(self, org_id: UUID) -> int:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count()).select_from(CsvUpload).where(
                CsvUpload.org_id == org_id,
                CsvUpload.created_at >= month_start,
            )
        )
        return result.scalar_one()

    async def last_upload(self, org_id: UUID) -> CsvUpload | None:
        result = await self.db.execute(
            select(CsvUpload).where(
                CsvUpload.org_id == org_id,
                CsvUpload.status == "completed",
            ).order_by(CsvUpload.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()
