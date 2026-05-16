from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_api_key_org, get_current_org_id, get_current_user, get_db
from app.models.auth import User
from app.schemas.ingestion import (
    BatchIngestRequest, BatchIngestResponse, EventIn, EventOut,
    EventsQueryParams, EventStats, SingleIngestResponse,
)
from app.services.ingestion import IngestionService

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=SingleIngestResponse, status_code=201)
async def ingest_single(
    body: EventIn,
    org_id: UUID = Depends(get_api_key_org),
    db: AsyncSession = Depends(get_db),
):
    svc = IngestionService(db)
    result = await svc.ingest_single(org_id, body.model_dump())
    return result


@router.post("/batch", response_model=BatchIngestResponse, status_code=202)
async def ingest_batch(
    body: BatchIngestRequest,
    org_id: UUID = Depends(get_api_key_org),
    db: AsyncSession = Depends(get_db),
):
    svc = IngestionService(db)
    result = await svc.ingest_batch(org_id, [e.model_dump() for e in body.events])
    return result


@router.get("")
async def list_events(
    event_type: str | None = None,
    actor_id: str | None = None,
    source: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    svc = IngestionService(db)
    params = {
        "event_type": event_type,
        "actor_id": actor_id,
        "source": source,
        "start_time": datetime.fromisoformat(start_time) if start_time else None,
        "end_time": datetime.fromisoformat(end_time) if end_time else None,
        "limit": limit,
        "offset": offset,
        "order": order,
    }
    result = await svc.query_events(org_id, params)
    # Serialize events
    result["items"] = [EventOut.model_validate(e) for e in result["items"]]
    return result


@router.get("/stats", response_model=EventStats)
async def event_stats(
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = IngestionService(db)
    return await svc.get_stats(org_id)
