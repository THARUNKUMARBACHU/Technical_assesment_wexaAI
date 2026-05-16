"""
Seed the database with Finance analytics data + build a Finance dashboard.

Usage:
    cd backend
    python seed_finance.py
"""

import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, ".")

from app.config import settings
from app.models.auth import Organization, OrgMembership, User
from app.models.ingestion import Event
from app.models.dashboard import Dashboard, Widget

engine = create_engine(settings.sync_database_url, pool_size=5, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

random.seed(42)

# --- Finance event data ---

CATEGORIES = ["Salary", "Freelance", "Investments", "Subscriptions", "Food & Dining",
              "Transportation", "Utilities", "Entertainment", "Healthcare", "Shopping"]

INCOME_CATEGORIES = ["Salary", "Freelance", "Investments"]
EXPENSE_CATEGORIES = ["Subscriptions", "Food & Dining", "Transportation",
                      "Utilities", "Entertainment", "Healthcare", "Shopping"]

PAYMENT_METHODS = ["Credit Card", "Debit Card", "Bank Transfer", "Cash", "PayPal"]

DEPARTMENTS = ["Engineering", "Marketing", "Sales", "Operations", "HR"]

VENDORS = {
    "Subscriptions": ["AWS", "Slack", "Figma", "GitHub", "Notion"],
    "Food & Dining": ["Team Lunch", "Coffee", "Catering"],
    "Transportation": ["Uber Business", "Fleet Fuel", "Parking"],
    "Utilities": ["Electric Co.", "Internet ISP", "Phone Plan"],
    "Entertainment": ["Team Outing", "Conference", "Workshop"],
    "Healthcare": ["Insurance Premium", "Wellness Program"],
    "Shopping": ["Office Supplies", "Equipment", "Software License"],
}


def get_user_and_org(session):
    """Find the first available user + org."""
    membership = session.execute(
        select(OrgMembership).where(OrgMembership.deleted_at.is_(None)).limit(1)
    ).scalar_one_or_none()

    if not membership:
        raise RuntimeError("No user/org found. Run seed_ecommerce.py first.")

    user = session.execute(select(User).where(User.id == membership.user_id)).scalar_one()
    org = session.execute(select(Organization).where(Organization.id == membership.org_id)).scalar_one()
    return user, org


def generate_finance_events(org_id: uuid.UUID) -> list[Event]:
    """Generate 30 days of realistic finance events."""
    events = []
    now = datetime.now(timezone.utc)

    for day_offset in range(30, 0, -1):
        day = now - timedelta(days=day_offset)

        # Daily revenue (income events)
        if day.weekday() < 5:  # Weekdays only
            # Main salary (once per 15 days)
            if day_offset in (15, 30):
                for dept in DEPARTMENTS:
                    amount = round(random.uniform(8000, 15000), 2)
                    events.append(Event(
                        id=uuid.uuid4(), org_id=org_id,
                        event_type="income",
                        event_name="salary_payment",
                        properties={"category": "Salary", "department": dept,
                                    "description": f"{dept} Payroll"},
                        numeric_value=amount,
                        source="seed",
                        timestamp=day.replace(hour=9, minute=0),
                    ))

            # Freelance income (random days)
            if random.random() < 0.3:
                amount = round(random.uniform(500, 3000), 2)
                events.append(Event(
                    id=uuid.uuid4(), org_id=org_id,
                    event_type="income",
                    event_name="freelance_payment",
                    properties={"category": "Freelance", "client": random.choice(["Client A", "Client B", "Client C"]),
                                "description": "Consulting fee"},
                    numeric_value=amount,
                    source="seed",
                    timestamp=day.replace(hour=random.randint(10, 16)),
                ))

            # Investment returns (weekly)
            if day.weekday() == 4:
                amount = round(random.uniform(200, 1500), 2)
                events.append(Event(
                    id=uuid.uuid4(), org_id=org_id,
                    event_type="income",
                    event_name="investment_return",
                    properties={"category": "Investments", "type": random.choice(["Dividend", "Interest", "Capital Gain"])},
                    numeric_value=amount,
                    source="seed",
                    timestamp=day.replace(hour=16),
                ))

        # Daily expenses (2-5 per day)
        num_expenses = random.randint(2, 5)
        for _ in range(num_expenses):
            cat = random.choice(EXPENSE_CATEGORIES)
            vendor = random.choice(VENDORS.get(cat, ["General"]))
            method = random.choice(PAYMENT_METHODS)
            dept = random.choice(DEPARTMENTS)

            amount_ranges = {
                "Subscriptions": (10, 200), "Food & Dining": (15, 80),
                "Transportation": (10, 60), "Utilities": (50, 300),
                "Entertainment": (20, 150), "Healthcare": (30, 500),
                "Shopping": (20, 250),
            }
            lo, hi = amount_ranges.get(cat, (10, 100))
            amount = round(random.uniform(lo, hi), 2)

            events.append(Event(
                id=uuid.uuid4(), org_id=org_id,
                event_type="expense",
                event_name=f"{cat.lower().replace(' & ', '_').replace(' ', '_')}",
                properties={
                    "category": cat, "vendor": vendor,
                    "payment_method": method, "department": dept,
                    "description": f"{vendor} - {cat}",
                },
                numeric_value=amount,
                source="seed",
                timestamp=day.replace(hour=random.randint(8, 18), minute=random.randint(0, 59)),
            ))

        # Invoice events (1-2 per day on weekdays)
        if day.weekday() < 5:
            for _ in range(random.randint(1, 2)):
                status = random.choices(["paid", "pending", "overdue"], weights=[0.6, 0.3, 0.1])[0]
                amount = round(random.uniform(500, 5000), 2)
                events.append(Event(
                    id=uuid.uuid4(), org_id=org_id,
                    event_type="invoice",
                    event_name=f"invoice_{status}",
                    properties={
                        "status": status,
                        "client": random.choice(["Acme Corp", "TechStart Inc", "Global Ltd", "Nova Solutions", "Peak Digital"]),
                        "department": random.choice(DEPARTMENTS),
                    },
                    numeric_value=amount,
                    source="seed",
                    timestamp=day.replace(hour=random.randint(9, 17)),
                ))

        # Budget tracking (weekly on Monday)
        if day.weekday() == 0:
            for dept in DEPARTMENTS:
                budget = round(random.uniform(5000, 20000), 2)
                spent = round(budget * random.uniform(0.5, 1.1), 2)
                events.append(Event(
                    id=uuid.uuid4(), org_id=org_id,
                    event_type="budget",
                    event_name="budget_update",
                    properties={
                        "department": dept,
                        "allocated": budget,
                        "status": "over" if spent > budget else "under",
                    },
                    numeric_value=spent,
                    source="seed",
                    timestamp=day.replace(hour=8),
                ))

    return events


def create_finance_dashboard(session, org_id: uuid.UUID, user_id: uuid.UUID):
    """Create a clean Finance analytics dashboard."""
    # Remove old finance dashboard if exists
    existing = session.execute(
        select(Dashboard).where(
            Dashboard.org_id == org_id,
            Dashboard.title == "Finance Overview",
            Dashboard.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if existing:
        existing.deleted_at = datetime.now(timezone.utc)
        session.flush()

    dashboard = Dashboard(
        id=uuid.uuid4(),
        org_id=org_id,
        created_by=user_id,
        title="Finance Overview",
        description="Track income, expenses, invoices, and departmental budgets at a glance.",
        is_default=False,
        auto_refresh_seconds=60,
    )
    session.add(dashboard)
    session.flush()

    widgets = [
        # Row 1: KPI cards
        {
            "title": "Total Income",
            "widget_type": "kpi",
            "config": {"event_type": "income", "aggregation": "sum"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 0, "w": 4, "h": 2},
        },
        {
            "title": "Total Expenses",
            "widget_type": "kpi",
            "config": {"event_type": "expense", "aggregation": "sum"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 4, "y": 0, "w": 4, "h": 2},
        },
        {
            "title": "Invoices Issued",
            "widget_type": "kpi",
            "config": {"event_type": "invoice", "aggregation": "count"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 8, "y": 0, "w": 4, "h": 2},
        },
        # Row 2: Income vs Expenses trend + Expense breakdown
        {
            "title": "Income Trend",
            "widget_type": "line",
            "config": {"event_type": "income", "aggregation": "sum", "time_bucket": "day"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 2, "w": 8, "h": 4},
        },
        {
            "title": "Expenses by Category",
            "widget_type": "pie",
            "config": {"event_type": "expense", "aggregation": "sum", "group_by": "properties.category"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 8, "y": 2, "w": 4, "h": 4},
        },
        # Row 3: Expense trend + Payment methods
        {
            "title": "Daily Expenses",
            "widget_type": "bar",
            "config": {"event_type": "expense", "aggregation": "sum", "time_bucket": "day"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 6, "w": 8, "h": 4},
        },
        {
            "title": "Payment Methods",
            "widget_type": "pie",
            "config": {"event_type": "expense", "aggregation": "count", "group_by": "properties.payment_method"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 8, "y": 6, "w": 4, "h": 4},
        },
        # Row 4: Top vendors table + Department spending
        {
            "title": "Top Vendors",
            "widget_type": "table",
            "config": {"event_type": "expense", "aggregation": "sum", "group_by": "properties.vendor"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 0, "y": 10, "w": 6, "h": 4},
        },
        {
            "title": "Spending by Department",
            "widget_type": "bar",
            "config": {"event_type": "expense", "aggregation": "sum", "group_by": "properties.department"},
            "time_range": {"type": "relative", "value": "30d"},
            "position": {"x": 6, "y": 10, "w": 6, "h": 4},
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


def main():
    print("=" * 60)
    print("  FINANCE DASHBOARD SEED")
    print("=" * 60)

    session = Session()
    try:
        print("\n[1/3] Finding user & org...")
        user, org = get_user_and_org(session)
        print(f"  User: {user.email}, Org: {org.name}")

        print("\n[2/3] Generating finance events...")
        events = generate_finance_events(org.id)
        batch_size = 500
        for i in range(0, len(events), batch_size):
            session.add_all(events[i:i + batch_size])
            session.flush()
        print(f"  Created {len(events)} events")

        print("\n[3/3] Building Finance dashboard...")
        dashboard = create_finance_dashboard(session, org.id, user.id)

        session.commit()

        print("\n" + "=" * 60)
        print("  SEED COMPLETE")
        print("=" * 60)
        print(f"  Dashboard:  {dashboard.title} (9 widgets)")
        print(f"  Events:     {len(events)}")
        print("=" * 60)

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
