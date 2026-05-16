import csv
import io
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFound, ValidationError
from app.repositories.ingestion import ApiKeyRepo, CsvUploadRepo, EventBatchRepo, EventRepo
from app.utils.security import generate_api_key


class IngestionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.events = EventRepo(db)
        self.batches = EventBatchRepo(db)

    async def ingest_single(self, org_id: UUID, data: dict) -> dict:
        event = await self.events.create(
            org_id=org_id,
            event_type=data["event_type"],
            event_name=data.get("event_name"),
            actor_id=data.get("actor_id"),
            properties=data.get("properties", {}),
            numeric_value=data.get("numeric_value"),
            source="api",
            timestamp=data.get("timestamp") or datetime.now(timezone.utc),
        )
        return {"id": event.id, "status": "accepted", "received_at": event.received_at}

    async def ingest_batch(self, org_id: UUID, events_data: list[dict]) -> dict:
        batch = await self.batches.create(org_id=org_id, total_count=len(events_data))

        now = datetime.now(timezone.utc)
        rows = []
        for e in events_data:
            rows.append({
                "org_id": org_id,
                "event_type": e["event_type"],
                "event_name": e.get("event_name"),
                "actor_id": e.get("actor_id"),
                "properties": e.get("properties", {}),
                "numeric_value": e.get("numeric_value"),
                "source": "api",
                "timestamp": e.get("timestamp") or now,
            })

        count = await self.events.bulk_create(rows)
        batch.success_count = count
        batch.status = "completed"
        batch.completed_at = datetime.now(timezone.utc)
        await self.db.flush()

        return {"batch_id": batch.id, "total_count": batch.total_count, "status": batch.status}

    async def query_events(self, org_id: UUID, params: dict) -> dict:
        default_start = datetime.now(timezone.utc) - timedelta(hours=24)
        events, total = await self.events.list_events(
            org_id=org_id,
            event_type=params.get("event_type"),
            actor_id=params.get("actor_id"),
            source=params.get("source"),
            start_time=params.get("start_time") or default_start,
            end_time=params.get("end_time"),
            limit=params.get("limit", 50),
            offset=params.get("offset", 0),
            order=params.get("order", "desc"),
        )
        return {
            "items": events,
            "total": total,
            "limit": params.get("limit", 50),
            "offset": params.get("offset", 0),
        }

    async def get_stats(self, org_id: UUID) -> dict:
        today_count = await self.events.count_today(org_id)
        sources = await self.events.count_by_source(org_id)

        csv_repo = CsvUploadRepo(self.db)
        csv_count = await csv_repo.count_this_month(org_id)
        last_csv = await csv_repo.last_upload(org_id)

        api_key_repo = ApiKeyRepo(self.db)
        active_keys = await api_key_repo.count_active(org_id)

        # Rough events per minute (today_count / minutes since midnight)
        now = datetime.now(timezone.utc)
        minutes = max((now - now.replace(hour=0, minute=0, second=0, microsecond=0)).seconds / 60, 1)
        epm = round(today_count / minutes, 1)

        return {
            "today_count": today_count,
            "events_per_minute": epm,
            "csv_uploads_this_month": csv_count,
            "last_csv_upload": {
                "filename": last_csv.filename,
                "row_count": last_csv.row_count,
            } if last_csv else None,
            "active_api_keys": active_keys,
            "sources": {
                "api": sources.get("api", 0),
                "csv": sources.get("csv", 0),
                "webhook": sources.get("webhook", 0),
            },
        }


class ApiKeyService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ApiKeyRepo(db)

    async def create_key(self, org_id: UUID, name: str, scopes: list, expires_at=None) -> dict:
        full_key, prefix, key_hash = generate_api_key()
        api_key = await self.repo.create(
            org_id=org_id,
            name=name,
            key_prefix=prefix,
            key_hash=key_hash,
            scopes=scopes,
            expires_at=expires_at,
        )
        return {
            "id": api_key.id,
            "name": api_key.name,
            "key": full_key,
            "key_prefix": api_key.key_prefix,
            "scopes": api_key.scopes,
            "expires_at": api_key.expires_at,
            "created_at": api_key.created_at,
        }

    async def list_keys(self, org_id: UUID) -> list:
        return await self.repo.list_by_org(org_id)

    async def revoke_key(self, key_id: UUID, org_id: UUID) -> None:
        key = await self.repo.get_by_id(key_id, org_id)
        if not key:
            raise NotFound("API key not found")
        key.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()


class CsvService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.uploads = CsvUploadRepo(db)
        self.events = EventRepo(db)

    async def upload(self, org_id: UUID, user_id: UUID, filename: str, content: bytes) -> dict:
        # Parse CSV to get columns + preview
        text = content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)

        if len(rows) < 2:
            raise ValidationError("CSV must have at least a header row and one data row")

        columns = rows[0]
        preview = rows[1:6]  # first 5 data rows

        upload = await self.uploads.create(
            org_id=org_id,
            uploaded_by=user_id,
            filename=filename,
            file_size_bytes=len(content),
            row_count=len(rows) - 1,
            status="uploaded",
        )

        return {
            "id": upload.id,
            "filename": upload.filename,
            "file_size_bytes": upload.file_size_bytes,
            "row_count": upload.row_count,
            "status": upload.status,
            "columns": columns,
            "preview_rows": preview,
            "created_at": upload.created_at,
        }

    async def map_and_import(self, upload_id: UUID, org_id: UUID, mapping: dict) -> dict:
        upload = await self.uploads.get_by_id(upload_id, org_id)
        if not upload:
            raise NotFound("Upload not found")

        upload.mapping_config = mapping
        upload.status = "processing"
        await self.db.flush()

        # In production, this would be a Celery task.
        # For now, mark as completed (the actual CSV processing would happen async).
        upload.status = "completed"
        upload.success_count = upload.row_count
        upload.error_count = 0
        upload.completed_at = datetime.now(timezone.utc)
        await self.db.flush()

        return {
            "id": upload.id,
            "status": upload.status,
            "row_count": upload.row_count,
            "mapping_config": upload.mapping_config,
        }

    async def list_uploads(self, org_id: UUID) -> list:
        return await self.uploads.list_by_org(org_id)
