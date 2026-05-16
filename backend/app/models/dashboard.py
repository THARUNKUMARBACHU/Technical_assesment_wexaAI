import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Dashboard(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "dashboards"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    auto_refresh_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    widgets: Mapped[list["Widget"]] = relationship(
        back_populates="dashboard", lazy="selectin", cascade="all, delete-orphan"
    )
    shares: Mapped[list["DashboardShare"]] = relationship(
        back_populates="dashboard", lazy="selectin", cascade="all, delete-orphan"
    )


class Widget(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "widgets"

    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    widget_type: Mapped[str] = mapped_column(String(20), nullable=False)  # line, bar, pie, kpi, table
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)  # event_type, aggregation, group_by, filters
    time_range: Mapped[dict] = mapped_column(JSONB, server_default='{"type":"relative","value":"24h"}', nullable=False)
    position: Mapped[dict] = mapped_column(JSONB, nullable=False)  # x, y, w, h

    # Relationships
    dashboard: Mapped["Dashboard"] = relationship(back_populates="widgets")


class DashboardShare(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "dashboard_shares"

    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shared_with_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    share_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    permission: Mapped[str] = mapped_column(String(10), nullable=False, server_default="view")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    dashboard: Mapped["Dashboard"] = relationship(back_populates="shares")
