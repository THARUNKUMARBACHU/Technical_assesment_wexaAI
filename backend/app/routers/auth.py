from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.auth import User
from app.schemas.auth import (
    LoginRequest, LoginResponse, RefreshRequest, RegisterRequest, RegisterResponse,
    SwitchOrgRequest, SwitchOrgResponse, TokenPairOut, UpdateProfileRequest,
    UserOut, UserWithOrgOut, OrgMembershipOut,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.register(body.email, body.password, body.full_name, body.org_name)
    return RegisterResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type="bearer",
        user=UserOut.model_validate(result["user"]),
        organization=result["organization"],
    )


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.login(body.email, body.password)
    return LoginResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type="bearer",
        user=UserOut.model_validate(result["user"]),
        organizations=result["organizations"],
    )


@router.post("/refresh", response_model=TokenPairOut)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    result = await svc.refresh(body.refresh_token)
    return TokenPairOut(**result)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    await svc.logout(body.refresh_token)


@router.post("/switch-org", response_model=SwitchOrgResponse)
async def switch_org(
    body: SwitchOrgRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = AuthService(db)
    result = await svc.switch_org(user.id, body.org_id)
    return SwitchOrgResponse(**result)


@router.get("/me", response_model=UserWithOrgOut)
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.auth import OrgRepo
    org = await OrgRepo(db).get_by_id(user._org_id)  # type: ignore[attr-defined]
    return UserWithOrgOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        current_org=OrgMembershipOut(
            id=user._org_id,  # type: ignore[attr-defined]
            name=org.name if org else "",
            slug=org.slug if org else "",
            role=user._role,  # type: ignore[attr-defined]
        ),
    )


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name:
        user.full_name = body.full_name
    if body.password:
        from app.utils.security import hash_password
        user.password_hash = hash_password(body.password)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)
