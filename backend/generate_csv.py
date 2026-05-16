"""Generate a realistic e-commerce analytics CSV for dashboard demos."""

import csv
import json
import random
from datetime import datetime, timedelta, timezone

random.seed(42)
now = datetime.now(timezone.utc)

DAYS = 30

# --- Catalogs ---
products = [
    {"id": "PRD-001", "name": "Wireless Headphones", "category": "Electronics", "price": 79.99},
    {"id": "PRD-002", "name": "Running Shoes", "category": "Footwear", "price": 129.99},
    {"id": "PRD-003", "name": "Coffee Maker", "category": "Kitchen", "price": 49.99},
    {"id": "PRD-004", "name": "Yoga Mat", "category": "Fitness", "price": 34.99},
    {"id": "PRD-005", "name": "Laptop Stand", "category": "Electronics", "price": 59.99},
    {"id": "PRD-006", "name": "Water Bottle", "category": "Fitness", "price": 24.99},
    {"id": "PRD-007", "name": "Backpack", "category": "Accessories", "price": 89.99},
    {"id": "PRD-008", "name": "Desk Lamp", "category": "Electronics", "price": 44.99},
    {"id": "PRD-009", "name": "Protein Powder", "category": "Fitness", "price": 39.99},
    {"id": "PRD-010", "name": "Bluetooth Speaker", "category": "Electronics", "price": 69.99},
]

pages = [
    "/home", "/products", "/products/electronics", "/products/fitness",
    "/products/kitchen", "/cart", "/checkout", "/account", "/search",
    "/deals", "/about", "/contact",
]

utm_sources = ["google", "facebook", "instagram", "email", "twitter", "organic", "referral", "tiktok"]
utm_campaigns = ["summer_sale", "back_to_school", "flash_deal", "loyalty_program", "new_arrivals", "weekend_promo"]
devices = ["desktop", "mobile", "tablet"]
browsers = ["Chrome", "Safari", "Firefox", "Edge"]
countries = ["US", "UK", "CA", "DE", "FR", "AU", "IN", "JP", "BR", "MX"]
error_types = ["payment_failed", "out_of_stock", "timeout", "validation_error", "auth_error", "rate_limit"]
error_pages = ["/checkout", "/cart", "/api/payment", "/api/inventory", "/login", "/api/search"]
search_queries = [
    "headphones", "running shoes", "yoga", "laptop", "gift ideas", "sale",
    "wireless", "coffee", "backpack", "fitness", "speaker", "desk", "protein",
]
users = [f"user_{i:04d}" for i in range(1, 201)]

# Hour weights: peak during business hours + evening
hour_weights = [1, 1, 1, 1, 1, 2, 4, 8, 12, 14, 15, 14, 13, 14, 15, 14, 12, 10, 9, 8, 6, 4, 3, 2]

# Event type weights
event_types = [
    "page_view", "product_view", "add_to_cart", "remove_from_cart",
    "checkout_start", "purchase", "signup", "login", "search",
    "campaign_click", "error", "review_submit",
]
event_weights = [25, 18, 12, 4, 8, 6, 3, 8, 7, 5, 3, 1]


def generate_event(ts: datetime) -> dict:
    actor = random.choice(users)
    device = random.choices(devices, weights=[50, 40, 10])[0]
    browser = random.choices(browsers, weights=[60, 20, 10, 10])[0]
    country = random.choices(countries, weights=[30, 12, 8, 8, 7, 6, 10, 5, 8, 6])[0]
    event_type = random.choices(event_types, weights=event_weights)[0]

    props = {"device": device, "browser": browser, "country": country}
    numeric_value = ""

    if event_type == "page_view":
        props["url"] = random.choice(pages)
        props["referrer"] = random.choice(["direct", "google.com", "facebook.com", "email", ""])
        numeric_value = round(random.uniform(0.3, 4.5), 2)

    elif event_type == "product_view":
        prod = random.choice(products)
        props.update(product_id=prod["id"], product_name=prod["name"], category=prod["category"], price=prod["price"])
        numeric_value = prod["price"]

    elif event_type == "add_to_cart":
        prod = random.choice(products)
        qty = random.randint(1, 3)
        props.update(product_id=prod["id"], product_name=prod["name"], category=prod["category"], quantity=qty)
        numeric_value = round(prod["price"] * qty, 2)

    elif event_type == "remove_from_cart":
        prod = random.choice(products)
        props.update(product_id=prod["id"], product_name=prod["name"])

    elif event_type == "checkout_start":
        items = random.randint(1, 5)
        total = round(random.uniform(30, 400), 2)
        props.update(cart_items=items, cart_total=total)
        numeric_value = total

    elif event_type == "purchase":
        total = round(random.uniform(25, 350), 2)
        props.update(
            order_id=f"ORD-{random.randint(10000, 99999)}",
            items_count=random.randint(1, 4),
            payment_method=random.choice(["credit_card", "paypal", "apple_pay", "google_pay"]),
            currency="USD",
        )
        numeric_value = total
        if random.random() < 0.6:
            props["utm_source"] = random.choice(utm_sources)
            props["utm_campaign"] = random.choice(utm_campaigns)

    elif event_type == "signup":
        props["method"] = random.choice(["email", "google", "facebook", "apple"])
        if random.random() < 0.7:
            props["utm_source"] = random.choice(utm_sources)

    elif event_type == "login":
        props["method"] = random.choice(["email", "google", "facebook", "apple", "sso"])

    elif event_type == "search":
        results = random.randint(0, 45)
        props.update(query=random.choice(search_queries), results_count=results)
        numeric_value = results

    elif event_type == "campaign_click":
        props.update(
            utm_source=random.choice(utm_sources),
            utm_campaign=random.choice(utm_campaigns),
            landing_page=random.choice(["/deals", "/products", "/home", "/products/electronics"]),
        )

    elif event_type == "error":
        props.update(
            error_type=random.choice(error_types),
            error_page=random.choice(error_pages),
            status_code=random.choice([400, 403, 404, 500, 502, 503]),
        )
        numeric_value = props["status_code"]

    elif event_type == "review_submit":
        prod = random.choice(products)
        rating = random.choices([1, 2, 3, 4, 5], weights=[3, 5, 10, 30, 52])[0]
        props.update(product_id=prod["id"], product_name=prod["name"], rating=rating)
        numeric_value = rating

    source = random.choices(["api", "webhook", "csv"], weights=[70, 20, 10])[0]

    return {
        "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
        "event_type": event_type,
        "event_name": event_type.replace("_", " ").title(),
        "actor_id": actor,
        "numeric_value": numeric_value,
        "source": source,
        "properties": json.dumps(props),
    }


def main():
    rows = []
    target = 8000

    for _ in range(target + 2000):  # generate extra to account for weekend drops
        day_offset = random.choices(range(DAYS), weights=[DAYS - d + random.uniform(0, 5) for d in range(DAYS)])[0]
        hour = random.choices(range(24), weights=hour_weights)[0]
        ts = now - timedelta(
            days=day_offset,
            hours=random.randint(0, 23) - hour,
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59),
        )

        # Weekend dip
        if ts.weekday() >= 5 and random.random() < 0.35:
            continue

        # Spike on day 3 and day 10 ago (marketing campaign effect)
        if day_offset in (3, 10) and random.random() < 0.3:
            rows.append(generate_event(ts))  # extra event for spike

        rows.append(generate_event(ts))

        if len(rows) >= target:
            break

    rows.sort(key=lambda r: r["timestamp"])

    filename = "ecommerce_analytics.csv"
    fieldnames = ["timestamp", "event_type", "event_name", "actor_id", "numeric_value", "source", "properties"]

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Created {filename} with {len(rows)} rows")

    # Print event type breakdown
    from collections import Counter
    counts = Counter(r["event_type"] for r in rows)
    print("\nEvent breakdown:")
    for et, c in counts.most_common():
        print(f"  {et:20s} {c:5d}")


if __name__ == "__main__":
    main()
