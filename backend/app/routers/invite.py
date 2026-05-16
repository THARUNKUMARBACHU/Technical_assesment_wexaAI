from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.auth import User
from app.schemas.auth import AcceptInviteRequest
from app.services.auth import AuthService, InviteService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/accept-invite/{token}")
async def accept_invite(
    token: str,
    body: AcceptInviteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Accept invite as a new user (creates account)."""
    invite_svc = InviteService(db)
    result = await invite_svc.accept_invitation(token, body.full_name, body.password)

    auth_svc = AuthService(db)
    tokens = await auth_svc._create_tokens(result["user"].id, result["org_id"], result["role"])
    return {
        "user": result["user"],
        **tokens,
    }


@router.post("/accept-invite-authenticated/{token}")
async def accept_invite_authenticated(
    token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept invite as an already logged-in user (just joins the org)."""
    invite_svc = InviteService(db)
    result = await invite_svc.accept_invitation_authenticated(token, user.id)

    auth_svc = AuthService(db)
    tokens = await auth_svc._create_tokens(result["user"].id, result["org_id"], result["role"])
    return {
        "user": result["user"],
        **tokens,
    }
