from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_org_id, get_current_user, get_db, require_role
from app.models.auth import User
from app.schemas.ingestion import CsvColumnMapping, CsvUploadOut
from app.services.ingestion import CsvService

router = APIRouter(prefix="/csv", tags=["csv-uploads"])


@router.post("/upload", status_code=201)
async def upload_csv(
    file: UploadFile = File(...),
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB
        from app.exceptions import ValidationError
        raise ValidationError("File size exceeds 50MB limit")

    svc = CsvService(db)
    return await svc.upload(org_id, user.id, file.filename or "upload.csv", content)


@router.post("/{upload_id}/map", status_code=202)
async def map_csv_columns(
    upload_id: UUID,
    body: CsvColumnMapping,
    user: User = Depends(require_role("owner", "admin", "analyst")),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CsvService(db)
    return await svc.map_and_import(upload_id, org_id, body.mapping)


@router.get("/uploads", response_model=list[CsvUploadOut])
async def list_uploads(
    user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CsvService(db)
    uploads = await svc.list_uploads(org_id)
    return [CsvUploadOut.model_validate(u) for u in uploads]
