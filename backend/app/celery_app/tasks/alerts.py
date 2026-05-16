import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

import redis
from sqlalchemy import and_, func, select

from app.celery_app import celery
from app.celery_app.sync_db import SyncSessionLocal
from app.config import settings
from app.models.alert import AlertEvent, AlertRule
from app.models.ingestion import Event

logger = logging.getLogger(__name__)

OPERATOR_MAP = {
    ">": lambda a, b: a > b,
    "<": lambda a, b: a < b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
}


def _get_redis_client():
    return redis.from_url(settings.redis_url, decode_responses=True)


def _compute_metric(session, org_id, event_type: str, metric: str, since: datetime) -> float | None:
    """Compute the aggregated metric value for matching events within the time window."""
    conditions = [
        Event.org_id == org_id,
        Event.event_type == event_type,
        Event.timestamp >= since,
    ]

    if metric == "count":
        q = select(func.count()).select_from(Event).where(and_(*conditions))
    elif metric == "sum":
        q = select(func.coalesce(func.sum(Event.numeric_value), 0.0)).select_from(Event).where(and_(*conditions))
    elif metric == "avg":
        q = select(func.avg(Event.numeric_value)).select_from(Event).where(and_(*conditions))
    else:
        logger.warning("Unsupported metric: %s", metric)
        return None

    result = session.execute(q).scalar()
    return float(result) if result is not None else 0.0


def _cooldown_passed(rule: AlertRule, now: datetime) -> bool:
    """Check if enough time has passed since the last trigger."""
    if rule.last_triggered_at is None:
        return True
    cooldown_delta = timedelta(minutes=rule.cooldown_minutes)
    return now >= rule.last_triggered_at + cooldown_delta


@celery.task(name="app.celery_app.tasks.alerts.evaluate_alert_rules", bind=True, max_retries=3)
def evaluate_alert_rules(self):
    """Periodic task: evaluate all enabled alert rules and fire alerts when thresholds are breached."""
    logger.info("Starting alert rule evaluation")
    now = datetime.now(timezone.utc)
    fired_count = 0

    try:
        session = SyncSessionLocal()
        try:
            # Fetch all enabled, non-deleted rules (not muted or mute expired)
            rules = session.execute(
                select(AlertRule).where(
                    AlertRule.is_enabled.is_(True),
                    AlertRule.deleted_at.is_(None),
                    (AlertRule.is_muted.is_(False)) | (AlertRule.muted_until < now),
                )
            ).scalars().all()

            logger.info("Found %d enabled alert rules to evaluate", len(rules))

            redis_client = _get_redis_client()

            for rule in rules:
                try:
                    condition = rule.condition
                    event_type = condition.get("event_type")
                    metric = condition.get("metric", "count")
                    operator = condition.get("operator", ">")
                    threshold = float(condition.get("threshold", 0))
                    window_minutes = int(condition.get("time_window_minutes", 5))

                    if not event_type:
                        logger.warning("Rule %s has no event_type in condition, skipping", rule.id)
                        continue

                    if operator not in OPERATOR_MAP:
                        logger.warning("Rule %s has unsupported operator '%s', skipping", rule.id, operator)
                        continue

                    # Check cooldown
                    if not _cooldown_passed(rule, now):
                        logger.debug("Rule %s still in cooldown, skipping", rule.id)
                        continue

                    since = now - timedelta(minutes=window_minutes)
                    value = _compute_metric(session, rule.org_id, event_type, metric, since)

                    if value is None:
                        continue

                    # Evaluate the condition
                    op_fn = OPERATOR_MAP[operator]
                    if op_fn(value, threshold):
                        # Threshold breached - create an AlertEvent
                        alert_event = AlertEvent(
                            id=uuid.uuid4(),
                            rule_id=rule.id,
                            org_id=rule.org_id,
                            status="firing",
                            triggered_value=value,
                            threshold_value=threshold,
                            operator=operator,
                            fired_at=now,
                            created_at=now,
                        )
                        session.add(alert_event)

                        # Update last_triggered_at on the rule
                        rule.last_triggered_at = now

                        session.commit()

                        fired_count += 1
                        logger.info(
                            "Alert fired for rule '%s' (id=%s): %s %s %s (value=%s, threshold=%s)",
                            rule.name, rule.id, metric, operator, threshold, value, threshold,
                        )

                        # Publish to Redis pub/sub for WebSocket delivery
                        try:
                            channel = f"ws:alerts:{rule.org_id}"
                            payload = json.dumps({
                                "type": "alert_fired",
                                "alert_event_id": str(alert_event.id),
                                "rule_id": str(rule.id),
                                "rule_name": rule.name,
                                "severity": rule.severity,
                                "org_id": str(rule.org_id),
                                "triggered_value": value,
                                "threshold_value": threshold,
                                "operator": operator,
                                "metric": metric,
                                "event_type": event_type,
                                "fired_at": now.isoformat(),
                            })
                            redis_client.publish(channel, payload)
                            logger.info("Published alert to Redis channel %s", channel)
                        except Exception as pub_err:
                            logger.error("Failed to publish alert to Redis: %s", pub_err)

                except Exception as rule_err:
                    logger.error("Error evaluating rule %s: %s", rule.id, rule_err)
                    session.rollback()
                    continue

        finally:
            session.close()

    except Exception as exc:
        logger.error("Alert evaluation failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)

    logger.info("Alert evaluation complete. %d alerts fired.", fired_count)
    return {"fired": fired_count, "evaluated_at": now.isoformat()}
