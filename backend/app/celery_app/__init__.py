from celery import Celery
from app.config import settings

celery = Celery(
    "analytics_platform",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Beat schedule
    beat_schedule={
        "evaluate-alert-rules": {
            "task": "app.celery_app.tasks.alerts.evaluate_alert_rules",
            "schedule": 60.0,  # every 60 seconds
        },
        "cleanup-expired-tokens": {
            "task": "app.celery_app.tasks.maintenance.cleanup_expired_tokens",
            "schedule": 86400.0,  # daily
        },
    },
)

celery.autodiscover_tasks(["app.celery_app.tasks"])
