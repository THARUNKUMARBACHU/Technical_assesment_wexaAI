from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Request Schemas ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    org_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class SwitchOrgRequest(BaseModel):
    org_id: UUID


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=8, max_length=128)


class AcceptInviteRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


# ---------- Response Schemas ----------

class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgMembershipOut(BaseModel):
    id: UUID
    name: str
    slug: str
    role: str

    model_config = {"from_attributes": True}


class OrgSummaryOut(OrgMembershipOut):
    member_count: int
    created_at: datetime


class UserWithOrgOut(UserOut):
    current_org: OrgMembershipOut


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(TokenPairOut):
    user: UserOut
    organization: "OrganizationOut"


class LoginResponse(TokenPairOut):
    user: UserOut
    organizations: list[OrgSummaryOut]


class SwitchOrgResponse(TokenPairOut):
    organization: OrgSummaryOut


# Forward reference
from app.schemas.orgs import OrganizationOut  # noqa: E402

RegisterResponse.model_rebuild()
