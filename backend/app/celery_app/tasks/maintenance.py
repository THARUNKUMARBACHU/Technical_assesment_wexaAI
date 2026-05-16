import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, delete, or_

from app.celery_app import celery
from app.celery_app.sync_db import SyncSessionLocal
from app.models.auth import RefreshToken

logger = logging.getLogger(__name__)


@celery.task(name="app.celery_app.tasks.maintenance.cleanup_expired_tokens", bind=True, max_retries=3)
def cleanup_expired_tokens(self):
    """
    Delete refresh tokens that are:
    - Expired (expires_at < now), OR
    - Revoked more than 30 days ago (revoked_at is not null and older than 30 days)
    """
    logger.info("Starting expired token cleanup")
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    try:
        session = SyncSessionLocal()
        try:
            result = session.execute(
                delete(RefreshToken).where(
                    or_(
                        RefreshToken.expires_at < now,
                        and_(
                            RefreshToken.revoked_at.isnot(None),
                            RefreshToken.revoked_at < thirty_days_ago,
                        ),
                    )
                )
            )
            deleted_count = result.rowcount
            session.commit()
            logger.info("Cleaned up %d expired/revoked refresh tokens", deleted_count)
            return {"deleted": deleted_count, "cleaned_at": now.isoformat()}
        except Exception as exc:
            session.rollback()
            logger.error("Token cleanup failed: %s", exc)
            raise self.retry(exc=exc, countdown=60)
        finally:
            session.close()
    except Exception as exc:
        logger.error("Token cleanup task error: %s", exc)
        raise


@celery.task(name="app.celery_app.tasks.maintenance.purge_old_events", bind=True)
def purge_old_events(self, retention_days: int = 90):
    """
    Purge events older than the retention period.
    Currently only logs - does not actually delete events.
    Enable deletion when retention policy is confirmed.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=retention_days)
    logger.info(
        "purge_old_events called with retention_days=%d (cutoff=%s). "
        "This is a dry-run: no events will be deleted. "
        "Enable actual deletion when retention policy is finalized.",
        retention_days,
        cutoff.isoformat(),
    )
    return {
        "status": "dry_run",
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
        "message": "No events deleted. Enable deletion when retention policy is confirmed.",
    }
