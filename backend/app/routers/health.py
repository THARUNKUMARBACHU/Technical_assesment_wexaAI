from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "healthy"}


@router.get("/health/ready")
async def health_ready(db: AsyncSession = Depends(get_db)):
    db_status = "disconnected"
    redis_status = "disconnected"

    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass

    try:
        from app.config import settings
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        redis_status = "connected"
        await r.aclose()
    except Exception:
        pass

    status = "ready" if db_status == "connected" else "not_ready"
    return {"status": status, "database": db_status, "redis": redis_status}
