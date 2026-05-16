from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import Invitation, OrgMembership, Organization, RefreshToken, User


class UserRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_last_login(self, user: User) -> None:
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()


class OrgRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, org_id: UUID) -> Organization | None:
        result = await self.db.execute(
            select(Organization).where(Organization.id == org_id, Organization.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Organization | None:
        result = await self.db.execute(
            select(Organization).where(Organization.slug == slug, Organization.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Organization:
        org = Organization(**kwargs)
        self.db.add(org)
        await self.db.flush()
        await self.db.refresh(org)
        return org

    async def update(self, org: Organization, **kwargs) -> Organization:
        for k, v in kwargs.items():
            if v is not None:
                setattr(org, k, v)
        await self.db.flush()
        await self.db.refresh(org)
        return org

    async def list_for_user(self, user_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(
                Organization.id,
                Organization.name,
                Organization.slug,
                OrgMembership.role,
                Organization.created_at,
                func.count(OrgMembership.id).over(partition_by=Organization.id).label("member_count"),
            )
            .join(OrgMembership, OrgMembership.org_id == Organization.id)
            .where(
                OrgMembership.user_id == user_id,
                OrgMembership.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
            )
        )
        rows = result.all()
        seen = set()
        orgs = []
        for row in rows:
            if row.id not in seen:
                seen.add(row.id)
                orgs.append({
                    "id": row.id,
                    "name": row.name,
                    "slug": row.slug,
                    "role": row.role,
                    "member_count": row.member_count,
                    "created_at": row.created_at,
                })
        return orgs


class MembershipRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id: UUID, org_id: UUID) -> OrgMembership | None:
        result = await self.db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user_id,
                OrgMembership.org_id == org_id,
                OrgMembership.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, membership_id: UUID) -> OrgMembership | None:
        result = await self.db.execute(
            select(OrgMembership).where(
                OrgMembership.id == membership_id,
                OrgMembership.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_org(self, org_id: UUID) -> list[OrgMembership]:
        result = await self.db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def create(self, **kwargs) -> OrgMembership:
        m = OrgMembership(**kwargs)
        self.db.add(m)
        await self.db.flush()
        await self.db.refresh(m)
        return m

    async def member_count(self, org_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.deleted_at.is_(None),
            )
        )
        return result.scalar_one()


class RefreshTokenRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, token_hash: str, expires_at: datetime) -> RefreshToken:
        rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.db.add(rt)
        await self.db.flush()
        return rt

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, rt: RefreshToken) -> None:
        rt.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        for rt in result.scalars().all():
            rt.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()


class InvitationRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Invitation:
        inv = Invitation(**kwargs)
        self.db.add(inv)
        await self.db.flush()
        await self.db.refresh(inv)
        return inv

    async def get_by_token_hash(self, token_hash: str) -> Invitation | None:
        result = await self.db.execute(
            select(Invitation).where(
                Invitation.token_hash == token_hash,
                Invitation.accepted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_pending(self, org_id: UUID) -> list[Invitation]:
        result = await self.db.execute(
            select(Invitation).where(
                Invitation.org_id == org_id,
                Invitation.accepted_at.is_(None),
            ).order_by(Invitation.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, invitation_id: UUID) -> Invitation | None:
        result = await self.db.execute(
            select(Invitation).where(Invitation.id == invitation_id)
        )
        return result.scalar_one_or_none()
