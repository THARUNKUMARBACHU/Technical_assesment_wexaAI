from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_org_id, get_current_user, get_db, require_role
from app.models.auth import User
from app.repositories.auth import InvitationRepo, MembershipRepo
from app.schemas.orgs import (
    CreateInvitationRequest, CreateOrgRequest, InvitationOut, MemberOut,
    OrganizationOut, UpdateMemberRequest, UpdateOrgRequest,
)
from app.services.auth import InviteService, OrgService

router = APIRouter(prefix="/orgs", tags=["organizations"])


@router.post("", response_model=OrganizationOut, status_code=201)
async def create_org(
    body: CreateOrgRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgService(db)
    org = await svc.create_org(user.id, body.name, body.slug, body.industry)
    return OrganizationOut.model_validate(org)


@router.get("")
async def list_orgs(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.repositories.auth import OrgRepo
    repo = OrgRepo(db)
    return await repo.list_for_user(user.id)


@router.get("/{org_id}", response_model=OrganizationOut)
async def get_org(org_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.repositories.auth import OrgRepo
    repo = OrgRepo(db)
    org = await repo.get_by_id(org_id)
    if not org:
        from app.exceptions import NotFound
        raise NotFound("Organization not found")
    return OrganizationOut.model_validate(org)


@router.patch("/{org_id}", response_model=OrganizationOut)
async def update_org(
    org_id: UUID,
    body: UpdateOrgRequest,
    user: User = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    svc = OrgService(db)
    org = await svc.update_org(org_id, **body.model_dump(exclude_unset=True))
    return OrganizationOut.model_validate(org)


@router.delete("/{org_id}", status_code=204)
async def delete_org(
    org_id: UUID,
    user: User = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.auth import OrgRepo
    from app.exceptions import NotFound
    from datetime import datetime, timezone
    repo = OrgRepo(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise NotFound("Organization not found")
    org.deleted_at = datetime.now(timezone.utc)
    await db.flush()


# ---------- Members ----------

@router.get("/{org_id}/members", response_model=list[MemberOut])
async def list_members(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = MembershipRepo(db)
    members = await repo.list_by_org(org_id)
    return [
        MemberOut(
            id=m.id,
            user_id=m.user_id,
            email=m.user.email,
            full_name=m.user.full_name,
            role=m.role,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.patch("/{org_id}/members/{membership_id}")
async def update_member(
    org_id: UUID,
    membership_id: UUID,
    body: UpdateMemberRequest,
    user: User = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    repo = MembershipRepo(db)
    m = await repo.get_by_id(membership_id)
    if not m or m.org_id != org_id:
        from app.exceptions import NotFound
        raise NotFound("Member not found")
    if m.role == "owner":
        from app.exceptions import Forbidden
        raise Forbidden("Cannot change owner role")
    m.role = body.role
    await db.flush()
    return {"id": m.id, "role": m.role}


@router.delete("/{org_id}/members/{membership_id}", status_code=204)
async def remove_member(
    org_id: UUID,
    membership_id: UUID,
    user: User = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    repo = MembershipRepo(db)
    m = await repo.get_by_id(membership_id)
    if not m or m.org_id != org_id:
        from app.exceptions import NotFound
        raise NotFound("Member not found")
    if m.role == "owner":
        from app.exceptions import Forbidden
        raise Forbidden("Cannot remove owner")
    from datetime import datetime, timezone
    m.deleted_at = datetime.now(timezone.utc)
    await db.flush()


# ---------- Invitations ----------

@router.post("/{org_id}/invitations", response_model=InvitationOut, status_code=201)
async def create_invitation(
    org_id: UUID,
    body: CreateInvitationRequest,
    user: User = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    svc = InviteService(db)
    inv = await svc.create_invitation(org_id, body.email, body.role, user.id)
    return InvitationOut.model_validate(inv)


@router.get("/{org_id}/invitations", response_model=list[InvitationOut])
async def list_invitations(
    org_id: UUID,
    user: User = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    repo = InvitationRepo(db)
    return [InvitationOut.model_validate(i) for i in await repo.list_pending(org_id)]


@router.delete("/{org_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    org_id: UUID,
    invitation_id: UUID,
    user: User = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    repo = InvitationRepo(db)
    inv = await repo.get_by_id(invitation_id)
    if not inv or inv.org_id != org_id:
        from app.exceptions import NotFound
        raise NotFound("Invitation not found")
    await db.delete(inv)
    await db.flush()
