from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.auth import AcceptInviteRequest
from app.services.auth import AuthService, InviteService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/accept-invite/{token}")
async def accept_invite(
    token: str,
    body: AcceptInviteRequest,
    db: AsyncSession = Depends(get_db),
):
    invite_svc = InviteService(db)
    result = await invite_svc.accept_invitation(token, body.full_name, body.password)

    # Now log them in
    auth_svc = AuthService(db)
    tokens = await auth_svc._create_tokens(result["user"].id, result["org_id"], result["role"])
    return {
        "user": result["user"],
        **tokens,
    }
