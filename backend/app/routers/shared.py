from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.dashboard import DashboardOut
from app.services.dashboard import ShareService

router = APIRouter(prefix="/shared", tags=["shared"])


@router.get("/{share_token}")
async def get_shared_dashboard(share_token: str, db: AsyncSession = Depends(get_db)):
    svc = ShareService(db)
    dashboard = await svc.get_shared_dashboard(share_token)
    return DashboardOut.model_validate(dashboard)
