"""
Seed the database with e-commerce analytics data from CSV + build an informative dashboard.

Usage:
    python generate_csv.py          # generates ecommerce_analytics.csv
    python seed_ecommerce.py        # imports CSV + creates dashboard
"""

import csv
import json
import sys
import uuid
from datetime import datetime, timezone

import bcrypt
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

# Ensure app modules are importable
sys.path.insert(0, ".")

from app.config import settings
from app.models.auth import Organization, OrgMembership, User
from app.models.ingestion import ApiKey, Event
from app.models.dashboard import Dashboard, Widget
from app.models.alert import AlertRule
from app.utils.security import generate_api_key

engine = create_engine(
    settings.sync_database_url,
    pool_size=5,
    pool_pre_ping=True,
)
Session = sessionmaker(bind=engine)


def get_or_create_user_org(session):
    """Get or create the demo user and org."""
    email = "demo@loopboard.io"
    user = session.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    ).scalar_one_or_none()

    if user:
        print(f"  Found existing user: {email}")
        # Find their org
        membership = session.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user.id,
                OrgMembership.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        org = session.execute(
            select(Organization).where(Organization.id == membership.org_id)
        ).scalar_one()
        return user, org

    print("  Creating demo user + org...")
    org = Organization(
        id=uuid.uuid4(),
        name="ShopMetrics Demo",
        slug="shopmetrics-demo",
    )
    session.add(org)
    session.flush()

    pw_hash = bcrypt.hashpw("DemoPass123".encode(), bcrypt.gensalt()).decode()
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=pw_hash,
        full_name="Demo User",
    )
    session.add(user)
    session.flush()

    membership = OrgMembership(
        id=uuid.uuid4(),
        user_id=user.id,
        org_id=org.id,
        role="owner",
    )
    session.add(membership)
    session.flush()

    return user, org


def import_csv_events(session, org_id: uuid.UUID, csv_path: str) -> int:
    """Import events from the CSV file."""
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"  Importing {len(rows)} events from {csv_path}...")

    batch = []
    for i, row in enumerate(rows):
        props = {}
        try:
            props = json.loads(row["properties"])
        except (json.JSONDecodeError, KeyError):
            pass

        nv = None
        if row.get("numeric_value") and row["numeric_value"] != "":
            try:
                nv = float(row["numeric_value"])
            except ValueError:
                pass

        event = Event(
            id=uuid.uuid4(),
            org_id=org_id,
            event_type=row["event_type"],
            event_name=row.get("event_name", ""),
            actor_id=row.get("actor_id", ""),
            properties=props,
            numeric_value=nv,
            source=row.get("source", "csv"),
            timestamp=datetime.strptime(row["timestamp"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc),
        )
        batch.append(event)

        if len(batch) >= 500:
            session.add_all(batch)
            session.flush()
            batch = []

    if batch:
        session.add_all(batch)
        session.flush()

    return len(rows)


def create_dashboard(session, org_id: uuid.UUID, user_id: uuid.UUID):
    """Create an informative e-commerce analytics dashboard."""
    # Delete existing demo dashboards
    existing = session.execute(
        select(Dashboard).where(
            Dashboard.org_id == org_id,
            Dashboard.title == "E-Commerce Analytics",
            Dashboard.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing:
        print("  Removing old dashboard...")
        existing.deleted_at = datetime.now(timezone.utc)
        session.flush()

    print("  Creating E-Commerce Analytics dashboard...")
    dashboard = Dashboard(
        id=uuid.uuid4(),
        org_id=org_id,
        created_by=user_id,
        title="E-Commerce Analytics",
        description="Comprehensive e-commerce performance dashboard tracking revenue, user engagement, conversion funnel, and error rates across all channels.",
        is_default=True,
        auto_refresh_seconds=30,
    )
    session.add(dashboard)
    session.flush()

    widgets = [
        # Row 1: KPIs across the top
        {
            "title": "Total Revenue (30d)",
            "widget_type": "kpi",
            "config": {
                "event_type": "purchase",
                "aggregation": "sum",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 0, "w": 3, "h": 2},
        },
        {
            "title": "Total Orders",
            "widget_type": "kpi",
            "config": {
                "event_type": "purchase",
                "aggregation": "count",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 3, "y": 0, "w": 3, "h": 2},
        },
        {
            "title": "Avg Order Value",
            "widget_type": "kpi",
            "config": {
                "event_type": "purchase",
                "aggregation": "avg",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 6, "y": 0, "w": 3, "h": 2},
        },
        {
            "title": "Error Count",
            "widget_type": "kpi",
            "config": {
                "event_type": "error",
                "aggregation": "count",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "7d"},
            "position": {"x": 9, "y": 0, "w": 3, "h": 2},
        },
        # Row 2: Revenue trend + Traffic by device
        {
            "title": "Revenue Over Time",
            "widget_type": "line",
            "config": {
                "event_type": "purchase",
                "aggregation": "sum",
                "time_bucket": "1d",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 2, "w": 8, "h": 4},
        },
        {
            "title": "Traffic by Device",
            "widget_type": "pie",
            "config": {
                "event_type": "page_view",
                "aggregation": "count",
                "group_by": "properties.device",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 8, "y": 2, "w": 4, "h": 4},
        },
        # Row 3: Events by type + Errors over time
        {
            "title": "Events by Type",
            "widget_type": "bar",
            "config": {
                "event_type": "*",
                "aggregation": "count",
                "group_by": "event_type",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "7d"},
            "position": {"x": 0, "y": 6, "w": 6, "h": 4},
        },
        {
            "title": "Errors Over Time",
            "widget_type": "line",
            "config": {
                "event_type": "error",
                "aggregation": "count",
                "time_bucket": "1d",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "14d"},
            "position": {"x": 6, "y": 6, "w": 6, "h": 4},
        },
        # Row 4: Conversion funnel + Top products + Geography
        {
            "title": "Top Products by Revenue",
            "widget_type": "table",
            "config": {
                "event_type": "purchase",
                "aggregation": "sum",
                "group_by": "properties.product_name",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 10, "w": 6, "h": 4},
        },
        {
            "title": "Sales by Country",
            "widget_type": "pie",
            "config": {
                "event_type": "purchase",
                "aggregation": "count",
                "group_by": "properties.country",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 6, "y": 10, "w": 3, "h": 4},
        },
        {
            "title": "Traffic Sources",
            "widget_type": "pie",
            "config": {
                "event_type": "campaign_click",
                "aggregation": "count",
                "group_by": "properties.utm_source",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 9, "y": 10, "w": 3, "h": 4},
        },
        # Row 5: Signups trend + Search queries
        {
            "title": "New Signups Over Time",
            "widget_type": "bar",
            "config": {
                "event_type": "signup",
                "aggregation": "count",
                "time_bucket": "1d",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 14, "w": 6, "h": 3},
        },
        {
            "title": "Popular Search Queries",
            "widget_type": "table",
            "config": {
                "event_type": "search",
                "aggregation": "count",
                "group_by": "properties.query",
                "filters": {},
            },
            "time_range": {"type": "relative", "value": "7d"},
            "position": {"x": 6, "y": 14, "w": 6, "h": 3},
        },
    ]

    for w in widgets:
        widget = Widget(
            id=uuid.uuid4(),
            dashboard_id=dashboard.id,
            org_id=org_id,
            title=w["title"],
            widget_type=w["widget_type"],
            config=w["config"],
            time_range=w["time_range"],
            position=w["position"],
        )
        session.add(widget)

    session.flush()
    print(f"  Created dashboard with {len(widgets)} widgets")
    return dashboard


def create_alert_rules(session, org_id: uuid.UUID, user_id: uuid.UUID):
    """Create meaningful alert rules."""
    rules = [
        {
            "name": "High Error Rate",
            "description": "Fires when more than 15 errors occur in a 10-minute window. Indicates potential system issues.",
            "severity": "critical",
            "condition": {
                "event_type": "error",
                "metric": "count",
                "operator": ">",
                "threshold": 15,
                "time_window_minutes": 10,
            },
            "cooldown_minutes": 30,
            "notification_channels": ["in_app", "email"],
            "email_recipients": ["ops@shopmetrics.io"],
        },
        {
            "name": "Revenue Drop Alert",
            "description": "Fires when hourly revenue drops below $50. May indicate checkout issues.",
            "severity": "warning",
            "condition": {
                "event_type": "purchase",
                "metric": "sum",
                "operator": "<",
                "threshold": 50,
                "time_window_minutes": 60,
            },
            "cooldown_minutes": 60,
            "notification_channels": ["in_app"],
            "email_recipients": [],
        },
        {
            "name": "Cart Abandonment Spike",
            "description": "Fires when cart removals exceed 20 in 30 minutes, suggesting UX or pricing issues.",
            "severity": "warning",
            "condition": {
                "event_type": "remove_from_cart",
                "metric": "count",
                "operator": ">",
                "threshold": 20,
                "time_window_minutes": 30,
            },
            "cooldown_minutes": 60,
            "notification_channels": ["in_app"],
            "email_recipients": [],
        },
        {
            "name": "Signup Surge",
            "description": "Fires when signups exceed 10 in 15 minutes. Likely a successful campaign.",
            "severity": "info",
            "condition": {
                "event_type": "signup",
                "metric": "count",
                "operator": ">",
                "threshold": 10,
                "time_window_minutes": 15,
            },
            "cooldown_minutes": 30,
            "notification_channels": ["in_app"],
            "email_recipients": [],
        },
    ]

    for r in rules:
        rule = AlertRule(
            id=uuid.uuid4(),
            org_id=org_id,
            created_by=user_id,
            name=r["name"],
            description=r["description"],
            severity=r["severity"],
            condition=r["condition"],
            cooldown_minutes=r["cooldown_minutes"],
            notification_channels=r["notification_channels"],
            email_recipients=r["email_recipients"],
        )
        session.add(rule)

    session.flush()
    print(f"  Created {len(rules)} alert rules")


def main():
    csv_path = "ecommerce_analytics.csv"

    print("=" * 60)
    print("  E-COMMERCE ANALYTICS SEED")
    print("=" * 60)

    session = Session()
    try:
        # 1. User + Org
        print("\n[1/5] Setting up user & org...")
        user, org = get_or_create_user_org(session)

        # 2. API Key
        print("\n[2/5] Creating API key...")
        full_key, prefix, key_hash = generate_api_key()
        api_key = ApiKey(
            id=uuid.uuid4(),
            org_id=org.id,
            name="E-Commerce Ingestion Key",
            key_prefix=prefix,
            key_hash=key_hash,
            scopes=["ingest", "read"],
        )
        session.add(api_key)
        session.flush()

        # 3. Import CSV
        print(f"\n[3/5] Importing CSV data from {csv_path}...")
        count = import_csv_events(session, org.id, csv_path)

        # 4. Dashboard
        print("\n[4/5] Building dashboard...")
        dashboard = create_dashboard(session, org.id, user.id)

        # 5. Alert rules
        print("\n[5/5] Creating alert rules...")
        create_alert_rules(session, org.id, user.id)

        session.commit()

        print("\n" + "=" * 60)
        print("  SEED COMPLETE")
        print("=" * 60)
        print(f"  Email:      demo@loopboard.io")
        print(f"  Password:   DemoPass123")
        print(f"  API Key:    {full_key}")
        print(f"  Org:        {org.name} ({org.slug})")
        print(f"  Events:     {count}")
        print(f"  Dashboard:  {dashboard.title} (13 widgets)")
        print(f"  Alerts:     4 rules")
        print("=" * 60)

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
