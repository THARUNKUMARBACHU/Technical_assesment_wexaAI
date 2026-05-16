from collections.abc import AsyncGenerator, Callable
from uuid import UUID

from fastapi import Depends, Header, Query
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.exceptions import Forbidden, NotFound, Unauthorized
from app.models.auth import OrgMembership, User
from app.models.ingestion import ApiKey
from app.utils.security import decode_access_token, hash_token


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise Unauthorized("Missing or invalid authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise Unauthorized("Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise Unauthorized("Invalid token payload")

    result = await db.execute(select(User).where(User.id == UUID(user_id), User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise Unauthorized("User not found or inactive")

    # Attach org context from token
    user._org_id = UUID(payload.get("org_id", ""))  # type: ignore[attr-defined]
    user._role = payload.get("role", "viewer")  # type: ignore[attr-defined]
    return user


async def get_current_org_id(user: User = Depends(get_current_user)) -> UUID:
    return user._org_id  # type: ignore[attr-defined]


async def get_current_role(user: User = Depends(get_current_user)) -> str:
    return user._role  # type: ignore[attr-defined]


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory: require_role("owner", "admin")"""
    async def check_role(user: User = Depends(get_current_user)) -> User:
        if user._role not in allowed_roles:  # type: ignore[attr-defined]
            raise Forbidden(f"Role '{user._role}' not allowed. Required: {', '.join(allowed_roles)}")  # type: ignore[attr-defined]
        return user
    return check_role


# ---------- API Key auth (for ingestion endpoints) ----------

async def get_api_key_org(
    x_api_key: str = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    if not x_api_key:
        raise Unauthorized("Missing X-API-Key header")

    key_hash = hash_token(x_api_key)
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.revoked_at.is_(None),
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise Unauthorized("Invalid API key")

    # Check expiration
    from datetime import datetime, timezone
    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise Unauthorized("API key expired")

    # Update last_used_at
    api_key.last_used_at = datetime.now(timezone.utc)

    return api_key.org_id


# ---------- WS auth ----------

async def get_ws_user(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise Unauthorized("Invalid or expired token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise Unauthorized("User not found")

    user._org_id = UUID(payload.get("org_id", ""))  # type: ignore[attr-defined]
    user._role = payload.get("role", "viewer")  # type: ignore[attr-defined]
    return user
