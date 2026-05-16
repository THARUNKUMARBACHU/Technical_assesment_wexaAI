from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    def __init__(self, model: type[T], db: AsyncSession):
        self.model = model
        self.db = db

    async def get_by_id(self, id: UUID) -> T | None:
        result = await self.db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_by_id_and_org(self, id: UUID, org_id: UUID) -> T | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.org_id == org_id,
                self.model.deleted_at.is_(None) if hasattr(self.model, "deleted_at") else True,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_org(self, org_id: UUID, limit: int = 50, offset: int = 0) -> list[T]:
        q = select(self.model).where(self.model.org_id == org_id)
        if hasattr(self.model, "deleted_at"):
            q = q.where(self.model.deleted_at.is_(None))
        q = q.order_by(self.model.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def count_by_org(self, org_id: UUID) -> int:
        q = select(func.count()).select_from(self.model).where(self.model.org_id == org_id)
        if hasattr(self.model, "deleted_at"):
            q = q.where(self.model.deleted_at.is_(None))
        result = await self.db.execute(q)
        return result.scalar_one()

    async def create(self, **kwargs) -> T:
        obj = self.model(**kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: T, **kwargs) -> T:
        for key, value in kwargs.items():
            if value is not None:
                setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def soft_delete(self, obj: T) -> None:
        from datetime import datetime, timezone
        obj.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def hard_delete(self, obj: T) -> None:
        await self.db.delete(obj)
        await self.db.flush()
