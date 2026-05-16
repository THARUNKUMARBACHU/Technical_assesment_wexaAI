from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

sync_engine = create_engine(
    settings.database_url_sync,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

SyncSessionLocal = sessionmaker(bind=sync_engine)
