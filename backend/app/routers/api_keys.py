from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_org_id, get_db, require_role
from app.models.auth import User
from app.schemas.ingestion import ApiKeyOut, CreateApiKeyRequest
from app.services.ingestion import ApiKeyService

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.post("", status_code=201)
async def create_api_key(
    body: CreateApiKeyRequest,
    user: User = Depends(require_role("owner", "admin")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = ApiKeyService(db)
    return await svc.create_key(org_id, body.name, body.scopes, body.expires_at)


@router.get("", response_model=list[ApiKeyOut])
async def list_api_keys(
    user: User = Depends(require_role("owner", "admin")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = ApiKeyService(db)
    keys = await svc.list_keys(org_id)
    return [ApiKeyOut.model_validate(k) for k in keys]


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: UUID,
    user: User = Depends(require_role("owner", "admin")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = ApiKeyService(db)
    await svc.revoke_key(key_id, org_id)
