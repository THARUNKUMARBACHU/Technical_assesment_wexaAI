"""
Seed script: populates the database with demo data for testing.
Run from the backend directory:  python seed.py
"""

import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

# Ensure the backend directory is on sys.path so app imports resolve
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.models.auth import Organization, OrgMembership, User
from app.models.ingestion import ApiKey, Event
from app.models.dashboard import Dashboard, Widget
from app.models.alert import AlertRule
from app.utils.security import generate_api_key

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
engine = create_engine(settings.sync_database_url)
Session = sessionmaker(bind=engine)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEMO_EMAIL = "demo@loopboard.io"
DEMO_PASSWORD = "DemoPass123"
DEMO_FULL_NAME = "Demo User"
ORG_NAME = "LoopBoard Demo"
ORG_SLUG = "loopboard-demo"
NUM_EVENTS = 5000
NOW = datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
EVENT_TYPES = ["page_view", "button_click", "api_call", "signup", "purchase", "error"]
PAGES = ["/", "/dashboard", "/settings", "/events", "/alerts", "/docs", "/pricing", "/login"]
REFERRERS = ["https://google.com", "https://twitter.com", "https://github.com", "", "https://hn.algolia.com"]
BUTTONS = ["cta_signup", "nav_dashboard", "export_csv", "create_alert", "add_widget", "share_dashboard"]
API_ENDPOINTS = ["/api/v1/events", "/api/v1/query", "/api/v1/dashboards", "/api/v1/alerts", "/api/v1/users"]
PRODUCTS = ["starter_plan", "pro_plan", "enterprise_plan", "addon_alerts", "addon_exports"]
ERROR_CODES = ["500", "502", "503", "429", "408", "400"]
SOURCES_WEIGHTS = ["api"] * 80 + ["csv"] * 15 + ["webhook"] * 5


def _make_properties(event_type: str) -> tuple[dict, float | None]:
    """Return (properties dict, numeric_value or None) for a given event type."""
    if event_type == "page_view":
        load_time = round(random.uniform(0.2, 4.5), 2)
        return {
            "url": random.choice(PAGES),
            "referrer": random.choice(REFERRERS),
            "browser": random.choice(["Chrome", "Firefox", "Safari", "Edge"]),
        }, load_time

    if event_type == "button_click":
        return {
            "button_id": random.choice(BUTTONS),
            "page": random.choice(PAGES),
        }, None

    if event_type == "api_call":
        response_time = round(random.uniform(10, 800), 1)
        return {
            "endpoint": random.choice(API_ENDPOINTS),
            "method": random.choice(["GET", "POST", "PUT", "DELETE"]),
            "status_code": random.choice([200, 200, 200, 201, 400, 500]),
        }, response_time

    if event_type == "signup":
        return {
            "plan": random.choice(["free", "starter", "pro"]),
            "source": random.choice(["organic", "referral", "ad_campaign"]),
        }, None

    if event_type == "purchase":
        amount = round(random.choice([9.99, 29.99, 49.99, 99.99, 199.99, 499.99]), 2)
        return {
            "product": random.choice(PRODUCTS),
            "amount": amount,
            "currency": "USD",
        }, amount

    if event_type == "error":
        return {
            "error_code": random.choice(ERROR_CODES),
            "endpoint": random.choice(API_ENDPOINTS),
            "message": random.choice([
                "Internal server error",
                "Service unavailable",
                "Rate limit exceeded",
                "Request timeout",
                "Bad request",
            ]),
        }, None

    return {}, None


def _random_timestamp(days_ago: int) -> datetime:
    """Return a random timestamp within the given day-ago bucket."""
    day_start = NOW - timedelta(days=days_ago + 1)
    offset_seconds = random.randint(0, 86399)
    return day_start + timedelta(seconds=offset_seconds)


def _distribute_events(total: int, days: int = 30) -> list[int]:
    """
    Distribute `total` events across `days`, with:
    - higher density for recent days
    - lower density on weekends
    - spikes on days 3 and 7
    """
    weights = []
    for d in range(days):
        # Base weight: more recent = more events  (linear ramp)
        w = (days - d) / days
        # Weekend reduction
        day_dt = NOW - timedelta(days=d)
        if day_dt.weekday() >= 5:  # Sat/Sun
            w *= 0.5
        # Spikes
        if d == 3:
            w *= 3.0
        elif d == 7:
            w *= 2.5
        weights.append(max(w, 0.1))

    total_weight = sum(weights)
    counts = [max(1, int(total * w / total_weight)) for w in weights]

    # Adjust to hit exact total
    diff = total - sum(counts)
    for i in range(abs(diff)):
        idx = i % days
        counts[idx] += 1 if diff > 0 else -1
    return counts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def seed():
    session = Session()
    try:
        # ------------------------------------------------------------------
        # 1. Demo user + org
        # ------------------------------------------------------------------
        print("Checking for existing demo user...")
        existing_user = session.execute(
            select(User).where(User.email == DEMO_EMAIL)
        ).scalar_one_or_none()

        if existing_user:
            print(f"  User '{DEMO_EMAIL}' already exists -- skipping user/org creation.")
            user = existing_user
            # Grab the org via membership
            membership = session.execute(
                select(OrgMembership).where(OrgMembership.user_id == user.id)
            ).scalar_one_or_none()
            org_id = membership.org_id if membership else None
            if org_id is None:
                print("  ERROR: existing user has no org membership. Aborting.")
                return
        else:
            print("Creating demo org...")
            org = Organization(
                id=uuid.uuid4(),
                name=ORG_NAME,
                slug=ORG_SLUG,
                settings={},
            )
            session.add(org)
            session.flush()
            org_id = org.id

            print("Creating demo user...")
            password_hash = bcrypt.hashpw(
                DEMO_PASSWORD.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")
            user = User(
                id=uuid.uuid4(),
                email=DEMO_EMAIL,
                password_hash=password_hash,
                full_name=DEMO_FULL_NAME,
                is_active=True,
            )
            session.add(user)
            session.flush()

            print("Creating org membership (owner)...")
            membership = OrgMembership(
                id=uuid.uuid4(),
                user_id=user.id,
                org_id=org_id,
                role="owner",
            )
            session.add(membership)
            session.flush()

        # ------------------------------------------------------------------
        # 2. API key
        # ------------------------------------------------------------------
        print("Creating demo API key...")
        full_key, key_prefix, key_hash = generate_api_key()
        api_key = ApiKey(
            id=uuid.uuid4(),
            org_id=org_id,
            name="Demo Ingestion Key",
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=["ingest"],
        )
        session.add(api_key)
        session.flush()

        # ------------------------------------------------------------------
        # 3. Events
        # ------------------------------------------------------------------
        print(f"Generating {NUM_EVENTS} events over the last 30 days...")
        distribution = _distribute_events(NUM_EVENTS, 30)
        events = []
        for days_ago, count in enumerate(distribution):
            for _ in range(count):
                etype = random.choices(
                    EVENT_TYPES,
                    weights=[35, 20, 20, 5, 10, 10],
                    k=1,
                )[0]
                props, numeric = _make_properties(etype)
                actor = f"user_{random.randint(1, 50):03d}"
                ts = _random_timestamp(days_ago)
                events.append(Event(
                    id=uuid.uuid4(),
                    org_id=org_id,
                    event_type=etype,
                    actor_id=actor,
                    properties=props,
                    numeric_value=numeric,
                    source=random.choice(SOURCES_WEIGHTS),
                    timestamp=ts,
                ))

        session.add_all(events)
        session.flush()
        print(f"  {len(events)} events created.")

        # ------------------------------------------------------------------
        # 4. Dashboard + widgets
        # ------------------------------------------------------------------
        print("Creating demo dashboard...")
        dashboard = Dashboard(
            id=uuid.uuid4(),
            org_id=org_id,
            created_by=user.id,
            title="Demo Dashboard",
            description="Auto-generated demo dashboard with sample widgets.",
            layout={},
            is_default=True,
        )
        session.add(dashboard)
        session.flush()

        widget_defs = [
            {
                "title": "Events Over Time",
                "widget_type": "line",
                "config": {"event_type": "page_view", "aggregation": "count", "time_bucket": "1h"},
                "position": {"x": 0, "y": 0, "w": 8, "h": 4},
            },
            {
                "title": "Events by Type",
                "widget_type": "pie",
                "config": {"aggregation": "count", "group_by": "event_type"},
                "position": {"x": 8, "y": 0, "w": 4, "h": 4},
            },
            {
                "title": "Revenue",
                "widget_type": "kpi",
                "config": {"event_type": "purchase", "aggregation": "sum"},
                "position": {"x": 0, "y": 4, "w": 4, "h": 2},
            },
            {
                "title": "Error Rate",
                "widget_type": "bar",
                "config": {"event_type": "error", "aggregation": "count", "time_bucket": "1d"},
                "position": {"x": 4, "y": 4, "w": 8, "h": 3},
            },
            {
                "title": "Top Pages",
                "widget_type": "table",
                "config": {"event_type": "page_view", "aggregation": "count", "group_by": "properties.url"},
                "position": {"x": 0, "y": 6, "w": 12, "h": 4},
            },
        ]

        for wdef in widget_defs:
            w = Widget(
                id=uuid.uuid4(),
                dashboard_id=dashboard.id,
                org_id=org_id,
                title=wdef["title"],
                widget_type=wdef["widget_type"],
                config=wdef["config"],
                time_range={"type": "relative", "value": "30d"},
                position=wdef["position"],
            )
            session.add(w)

        session.flush()
        print(f"  Dashboard created with {len(widget_defs)} widgets.")

        # ------------------------------------------------------------------
        # 5. Alert rules
        # ------------------------------------------------------------------
        print("Creating alert rules...")
        alert_rules = [
            AlertRule(
                id=uuid.uuid4(),
                org_id=org_id,
                created_by=user.id,
                name="High Error Rate",
                description="Fires when error count exceeds 10 in a 5-minute window.",
                severity="critical",
                is_enabled=True,
                condition={
                    "event_type": "error",
                    "metric": "count",
                    "operator": ">",
                    "threshold": 10,
                    "time_window_minutes": 5,
                },
                notification_channels=["in_app", "email"],
                email_recipients=[DEMO_EMAIL],
            ),
            AlertRule(
                id=uuid.uuid4(),
                org_id=org_id,
                created_by=user.id,
                name="Revenue Spike",
                description="Fires when purchase sum exceeds $500 in a 60-minute window.",
                severity="info",
                is_enabled=True,
                condition={
                    "event_type": "purchase",
                    "metric": "sum",
                    "operator": ">",
                    "threshold": 500,
                    "time_window_minutes": 60,
                },
                notification_channels=["in_app"],
                email_recipients=[],
            ),
        ]
        session.add_all(alert_rules)
        session.flush()
        print(f"  {len(alert_rules)} alert rules created.")

        # ------------------------------------------------------------------
        # Commit everything
        # ------------------------------------------------------------------
        session.commit()

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        print("\n" + "=" * 60)
        print("  SEED COMPLETE")
        print("=" * 60)
        print(f"  Email:      {DEMO_EMAIL}")
        print(f"  Password:   {DEMO_PASSWORD}")
        print(f"  API Key:    {full_key}")
        print(f"  Org:        {ORG_NAME} ({ORG_SLUG})")
        print(f"  Events:     {len(events)}")
        print(f"  Dashboard:  Demo Dashboard ({len(widget_defs)} widgets)")
        print(f"  Alerts:     {len(alert_rules)} rules")
        print("=" * 60)

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
