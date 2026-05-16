import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import Conflict, NotFound, Unauthorized, ValidationError
from app.repositories.auth import (
    InvitationRepo, MembershipRepo, OrgRepo, RefreshTokenRepo, UserRepo,
)
from app.utils.security import (
    create_access_token, create_refresh_token, generate_token,
    hash_password, hash_token, verify_password,
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepo(db)
        self.orgs = OrgRepo(db)
        self.memberships = MembershipRepo(db)
        self.refresh_tokens = RefreshTokenRepo(db)
        self.invitations = InvitationRepo(db)

    async def register(self, email: str, password: str, full_name: str, org_name: str) -> dict:
        existing = await self.users.get_by_email(email)
        if existing:
            raise Conflict("Email already registered")

        user = await self.users.create(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
        )

        slug = re.sub(r"[^a-z0-9-]", "", org_name.lower().replace(" ", "-"))
        existing_org = await self.orgs.get_by_slug(slug)
        if existing_org:
            slug = f"{slug}-{str(user.id)[:8]}"

        org = await self.orgs.create(name=org_name, slug=slug)
        await self.memberships.create(user_id=user.id, org_id=org.id, role="owner")

        tokens = await self._create_tokens(user.id, org.id, "owner")
        return {
            "user": user,
            "organization": org,
            **tokens,
        }

    async def login(self, email: str, password: str) -> dict:
        user = await self.users.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise Unauthorized("Invalid email or password")
        if not user.is_active:
            raise Unauthorized("Account is disabled")

        await self.users.update_last_login(user)
        orgs = await self.orgs.list_for_user(user.id)

        if not orgs:
            raise Unauthorized("User has no organizations")

        first_org = orgs[0]
        tokens = await self._create_tokens(user.id, first_org["id"], first_org["role"])

        return {
            "user": user,
            "organizations": orgs,
            **tokens,
        }

    async def refresh(self, refresh_token_raw: str) -> dict:
        token_hash = hash_token(refresh_token_raw)
        rt = await self.refresh_tokens.get_by_hash(token_hash)
        if not rt:
            raise Unauthorized("Invalid refresh token")
        if rt.expires_at < datetime.now(timezone.utc):
            raise Unauthorized("Refresh token expired")

        # Revoke old token (rotation)
        await self.refresh_tokens.revoke(rt)

        user = await self.users.get_by_id(rt.user_id)
        if not user:
            raise Unauthorized("User not found")

        orgs = await self.orgs.list_for_user(user.id)
        if not orgs:
            raise Unauthorized("No organizations")

        first_org = orgs[0]
        tokens = await self._create_tokens(user.id, first_org["id"], first_org["role"])
        return tokens

    async def logout(self, refresh_token_raw: str) -> None:
        token_hash = hash_token(refresh_token_raw)
        rt = await self.refresh_tokens.get_by_hash(token_hash)
        if rt:
            await self.refresh_tokens.revoke(rt)

    async def switch_org(self, user_id: UUID, org_id: UUID) -> dict:
        membership = await self.memberships.get(user_id, org_id)
        if not membership:
            raise NotFound("Not a member of this organization")

        org = await self.orgs.get_by_id(org_id)
        if not org:
            raise NotFound("Organization not found")

        member_count = await self.memberships.member_count(org_id)
        tokens = await self._create_tokens(user_id, org_id, membership.role)

        return {
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "role": membership.role,
                "member_count": member_count,
                "created_at": org.created_at,
            },
            **tokens,
        }

    async def _create_tokens(self, user_id: UUID, org_id: UUID, role: str) -> dict:
        access_token = create_access_token(str(user_id), str(org_id), role)
        raw_refresh, token_hash, expires_at = create_refresh_token(str(user_id))
        await self.refresh_tokens.create(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        return {
            "access_token": access_token,
            "refresh_token": raw_refresh,
            "token_type": "bearer",
        }


class OrgService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.orgs = OrgRepo(db)
        self.memberships = MembershipRepo(db)

    async def create_org(self, user_id: UUID, name: str, slug: str, industry: str | None = None) -> dict:
        existing = await self.orgs.get_by_slug(slug)
        if existing:
            raise Conflict("Slug already taken")

        settings = {}
        if industry:
            settings["industry"] = industry

        org = await self.orgs.create(name=name, slug=slug, settings=settings)
        await self.memberships.create(user_id=user_id, org_id=org.id, role="owner")
        return org

    async def update_org(self, org_id: UUID, **kwargs):
        org = await self.orgs.get_by_id(org_id)
        if not org:
            raise NotFound("Organization not found")
        return await self.orgs.update(org, **kwargs)


class InviteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.invitations = InvitationRepo(db)
        self.memberships = MembershipRepo(db)
        self.users = UserRepo(db)

    async def create_invitation(self, org_id: UUID, email: str, role: str, invited_by: UUID) -> dict:
        raw_token, token_hash = generate_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        invitation = await self.invitations.create(
            org_id=org_id,
            email=email,
            role=role,
            invited_by=invited_by,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        # Attach raw token for response (not stored)
        invitation._raw_token = raw_token  # type: ignore[attr-defined]
        return invitation

    async def accept_invitation(self, token: str, full_name: str, password: str) -> dict:
        token_hash = hash_token(token)
        invitation = await self.invitations.get_by_token_hash(token_hash)
        if not invitation:
            raise NotFound("Invalid or expired invitation")
        if invitation.expires_at < datetime.now(timezone.utc):
            raise Unauthorized("Invitation expired")

        # Check if user exists
        user = await self.users.get_by_email(invitation.email)
        if not user:
            user = await self.users.create(
                email=invitation.email,
                password_hash=hash_password(password),
                full_name=full_name,
            )

        # Create membership
        existing = await self.memberships.get(user.id, invitation.org_id)
        if not existing:
            await self.memberships.create(
                user_id=user.id,
                org_id=invitation.org_id,
                role=invitation.role,
            )

        invitation.accepted_at = datetime.now(timezone.utc)
        await self.db.flush()

        return {"user": user, "org_id": invitation.org_id, "role": invitation.role}

    async def accept_invitation_authenticated(self, token: str, user_id: UUID) -> dict:
        """Accept an invitation for an already-authenticated user."""
        token_hash = hash_token(token)
        invitation = await self.invitations.get_by_token_hash(token_hash)
        if not invitation:
            raise NotFound("Invalid or expired invitation")
        if invitation.expires_at < datetime.now(timezone.utc):
            raise Unauthorized("Invitation expired")

        user = await self.users.get_by_id(user_id)
        if not user:
            raise NotFound("User not found")

        # Verify the invitation email matches (or allow any logged-in user)
        # For flexibility, allow any authenticated user to accept
        existing = await self.memberships.get(user.id, invitation.org_id)
        if not existing:
            await self.memberships.create(
                user_id=user.id,
                org_id=invitation.org_id,
                role=invitation.role,
            )

        invitation.accepted_at = datetime.now(timezone.utc)
        await self.db.flush()

        return {"user": user, "org_id": invitation.org_id, "role": invitation.role}
