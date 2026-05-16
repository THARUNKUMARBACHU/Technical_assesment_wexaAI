from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------- Organization ----------

class CreateOrgRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    industry: str | None = None


class UpdateOrgRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    settings: dict | None = None


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    settings: dict = {}
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Members ----------

class MemberOut(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateMemberRequest(BaseModel):
    role: str = Field(..., pattern=r"^(admin|analyst|viewer)$")


# ---------- Invitations ----------

class CreateInvitationRequest(BaseModel):
    email: str = Field(..., max_length=255)
    role: str = Field(..., pattern=r"^(admin|analyst|viewer)$")


class InvitationOut(BaseModel):
    id: UUID
    email: str
    role: str
    invited_by: UUID
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
