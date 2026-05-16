# LoopBoard Analytics - Real-Time Analytics & Reporting Platform

A production-grade **Real-Time Analytics & Reporting Platform** (lightweight Mixpanel/Metabase) that enables organizations to ingest data from multiple sources, visualize metrics through customizable dashboards, set up threshold-based alerts, and receive real-time updates via WebSockets.

**Live Demo:**
- Frontend: [https://technical-assesment-wexa-ai.vercel.app](https://technical-assesment-wexa-ai.vercel.app)
- Backend API: [https://loopboard-api.onrender.com](https://loopboard-api.onrender.com)
- API Docs: [https://loopboard-api.onrender.com/docs](https://loopboard-api.onrender.com/docs)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Design](#database-design)
5. [RBAC & Authentication](#rbac--authentication)
6. [User Journey & Flow Diagrams](#user-journey--flow-diagrams)
7. [Real-Time WebSocket System](#real-time-websocket-system)
8. [Module Breakdown](#module-breakdown)
9. [Setup & Installation](#setup--installation)
10. [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  Next.js 16 + React 19 + TypeScript + Tailwind + Shadcn/UI         │
│  Zustand (state) │ TanStack Query (cache) │ Recharts (charts)       │
└────────┬───────────────────┬───────────────────┬────────────────────┘
         │ REST API          │ WebSocket          │ Public Share
         │ (JWT Auth)        │ (JWT Query Param)  │ (Token-based)
         ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + Python)                       │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │
│  │  Auth &   │  │ Data     │  │ Dashboard │  │ Alerts &         │   │
│  │  Multi-   │  │ Ingestion│  │ & Widget  │  │ Notifications    │   │
│  │  Tenancy  │  │ Engine   │  │ Builder   │  │ Engine           │   │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └───────┬──────────┘   │
│       │              │              │                │              │
│  ┌────▼──────────────▼──────────────▼────────────────▼──────────┐   │
│  │              Repository Layer (org-isolated queries)          │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │         SQLAlchemy 2.0 Async ORM + Alembic Migrations        │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  PostgreSQL  │   │    Redis     │   │  Celery Workers   │
│  (Primary DB)│   │  (Pub/Sub +  │   │  (Background Jobs │
│              │   │   Caching)   │   │   + Alert Eval)   │
└──────────────┘   └──────────────┘   └──────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Async everywhere** | FastAPI + asyncpg + SQLAlchemy async for non-blocking I/O |
| **Repository pattern** | All DB access via repos with automatic org_id isolation |
| **Soft deletes** | `deleted_at` column preserves audit trail, filtered in queries |
| **JWT + Refresh tokens** | 15-min access tokens + 7-day refresh for security/UX balance |
| **JSONB for flexibility** | Widget configs, alert conditions, event properties stored as JSONB |
| **Append-only events** | Events table never updated/deleted; optimized for time-series queries |
| **Redis Pub/Sub** | Cross-process WebSocket broadcasting for horizontal scaling |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Framework** | FastAPI | 0.115+ |
| **Language** | Python | 3.11+ |
| **ORM** | SQLAlchemy (async) | 2.0+ |
| **Migrations** | Alembic | 1.14+ |
| **Database** | PostgreSQL | 16 |
| **Cache / Pub-Sub** | Redis | 7 |
| **Task Queue** | Celery | 5.4+ |
| **Auth** | python-jose (JWT) + passlib (bcrypt) | — |
| **Rate Limiting** | SlowAPI | 0.1.9+ |
| **Frontend Framework** | Next.js (App Router) | 16 |
| **UI Library** | React | 19 |
| **Language** | TypeScript | 5 |
| **Styling** | Tailwind CSS + Shadcn/UI | 4 |
| **State Management** | Zustand | 5 |
| **Data Fetching** | TanStack React Query | 5 |
| **Charts** | Recharts | 3.8+ |
| **Grid Layout** | react-grid-layout | 2.2+ |
| **Forms** | react-hook-form + Zod | 7.75+ / 4.4+ |

---

## Project Structure

```
Technical_assesment_wexaAI/
├── backend/
│   ├── app/
│   │   ├── celery_app/            # Celery config + background tasks
│   │   │   ├── __init__.py        # Celery instance
│   │   │   ├── sync_db.py         # Sync DB session for Celery
│   │   │   └── tasks/
│   │   │       ├── alerts.py      # Alert evaluation (periodic)
│   │   │       ├── csv_processing.py
│   │   │       └── maintenance.py # Token cleanup, data purge
│   │   ├── middleware/            # Custom middleware
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── base.py            # Base, TimestampMixin, SoftDeleteMixin
│   │   │   ├── auth.py            # User, Organization, Membership, RefreshToken, Invitation
│   │   │   ├── ingestion.py       # ApiKey, Event, EventBatch, CsvUpload
│   │   │   ├── dashboard.py       # Dashboard, Widget, DashboardShare
│   │   │   └── alert.py           # AlertRule, AlertEvent, NotificationLog
│   │   ├── repositories/          # Data access layer (org-scoped)
│   │   │   ├── base.py            # Generic BaseRepository[T]
│   │   │   ├── auth.py            # UserRepo, OrgRepo, MembershipRepo, etc.
│   │   │   ├── ingestion.py       # EventRepo, ApiKeyRepo, CsvUploadRepo
│   │   │   ├── dashboard.py       # DashboardRepo, WidgetRepo, ShareRepo
│   │   │   └── alert.py           # AlertRuleRepo, AlertEventRepo
│   │   ├── routers/               # API route handlers
│   │   │   ├── auth.py            # Register, Login, Refresh, Logout, Me
│   │   │   ├── invite.py          # Accept invitation endpoints
│   │   │   ├── orgs.py            # Org CRUD, Members, Invitations
│   │   │   ├── ingestion.py       # Event ingestion (single + batch)
│   │   │   ├── api_keys.py        # API key management
│   │   │   ├── csv_uploads.py     # CSV upload + column mapping
│   │   │   ├── dashboards.py      # Dashboard CRUD, Widgets, Data, Share
│   │   │   ├── alerts.py          # Alert rules CRUD, Events, Acknowledge
│   │   │   ├── shared.py          # Public shared dashboard access
│   │   │   ├── ws.py              # WebSocket endpoints
│   │   │   └── health.py          # Health check
│   │   ├── schemas/               # Pydantic request/response models
│   │   ├── services/              # Business logic layer
│   │   │   ├── auth.py            # AuthService, OrgService, InviteService
│   │   │   ├── ingestion.py       # IngestionService, ApiKeyService, CsvService
│   │   │   ├── dashboard.py       # DashboardService, WidgetService, ShareService
│   │   │   ├── alert.py           # AlertRuleService, AlertEventService
│   │   │   ├── realtime.py        # Redis Pub/Sub WebSocket manager
│   │   │   └── email.py           # SMTP email service
│   │   ├── utils/
│   │   │   └── security.py        # JWT, bcrypt, API key generation
│   │   ├── config.py              # Pydantic BaseSettings
│   │   ├── database.py            # Async engine + session factory
│   │   ├── dependencies.py        # FastAPI dependencies (auth, RBAC, DB)
│   │   ├── exceptions.py          # Custom exception hierarchy
│   │   ├── exception_handlers.py  # Centralized error handling
│   │   └── main.py                # App factory + middleware + router registration
│   ├── alembic/                   # Database migration scripts
│   ├── requirements.txt
│   ├── Procfile                   # Render deployment
│   ├── build.sh                   # Build script (pip install + migrate)
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/            # Auth route group
│   │   │   │   ├── login/         # Login page
│   │   │   │   ├── signup/        # Registration page
│   │   │   │   └── invite/[token] # Invitation acceptance
│   │   │   ├── (platform)/        # Protected route group
│   │   │   │   ├── dashboards/    # Dashboard list + builder
│   │   │   │   ├── alerts/        # Alert rules + history
│   │   │   │   ├── data/          # Data management
│   │   │   │   │   ├── api-keys/  # API key management
│   │   │   │   │   ├── upload/    # CSV upload
│   │   │   │   │   └── live/      # Real-time event stream
│   │   │   │   └── settings/      # Org + profile settings
│   │   │   └── shared/[shareToken]# Public shared dashboards
│   │   ├── components/
│   │   │   ├── ui/                # Shadcn/UI primitives
│   │   │   ├── charts/            # Recharts wrappers (line, bar, pie, KPI)
│   │   │   ├── dashboards/        # Dashboard builder components
│   │   │   └── alerts/            # Alert management components
│   │   ├── lib/
│   │   │   ├── api-client.ts      # Fetch wrapper with auth interceptor
│   │   │   ├── ws-client.ts       # WebSocket client with reconnect
│   │   │   ├── query-keys.ts      # TanStack Query key factory
│   │   │   └── utils.ts           # Helpers (cn, formatters)
│   │   └── stores/                # Zustand state stores
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml             # Local dev (Postgres + Redis)
├── render.yaml                    # Production deployment blueprint
└── sample_data/
    └── health_events.csv          # Sample CSV for testing
```

---

## Database Design

### Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   organizations  │       │      users       │       │  refresh_tokens  │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID, PK)    │       │ id (UUID, PK)    │       │ id (UUID, PK)    │
│ name             │       │ email (unique)   │       │ user_id (FK)     │
│ slug (unique)    │       │ password_hash    │       │ token_hash       │
│ settings (JSONB) │       │ full_name        │       │ expires_at       │
│ created_at       │       │ is_active        │       │ revoked_at       │
│ updated_at       │       │ last_login_at    │       │ created_at       │
│ deleted_at       │       │ created_at       │       └────────┬─────────┘
└────────┬─────────┘       │ updated_at       │                │
         │                 │ deleted_at       │                │
         │                 └────────┬─────────┘                │
         │                          │                          │
         │    ┌─────────────────────┼──────────────────────────┘
         │    │                     │
         ▼    ▼                     │
┌──────────────────┐                │
│   memberships    │                │
├──────────────────┤                │
│ id (UUID, PK)    │                │
│ user_id (FK) ────┼────────────────┘
│ org_id (FK)      │
│ role             │  ← owner | admin | analyst | viewer
│ created_at       │
│ updated_at       │
│ deleted_at       │
└──────────────────┘
  UNIQUE(user_id, org_id)

┌──────────────────┐       ┌──────────────────┐
│   invitations    │       │    api_keys      │
├──────────────────┤       ├──────────────────┤
│ id (UUID, PK)    │       │ id (UUID, PK)    │
│ org_id (FK)      │       │ org_id (FK)      │
│ email            │       │ name             │
│ role             │       │ key_prefix       │
│ invited_by (FK)  │       │ key_hash (unique)│
│ token_hash       │       │ scopes (JSONB)   │
│ expires_at       │       │ last_used_at     │
│ accepted_at      │       │ expires_at       │
│ created_at       │       │ revoked_at       │
└──────────────────┘       │ created_at       │
                           └──────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        events (append-only)                      │
├──────────────────────────────────────────────────────────────────┤
│ id (UUID, PK)                                                    │
│ org_id (FK)              ← tenant isolation                      │
│ event_type (indexed)     ← e.g., "patient_visit", "billing"     │
│ event_name               ← human-readable label                  │
│ actor_id (indexed)       ← who performed the action              │
│ properties (JSONB)       ← flexible key-value pairs              │
│ numeric_value            ← aggregatable metric                   │
│ source                   ← api | csv | webhook                   │
│ timestamp (indexed)      ← when the event occurred               │
│ received_at              ← when the server received it           │
│ created_at                                                       │
├──────────────────────────────────────────────────────────────────┤
│ INDEX: (org_id, timestamp)                                       │
│ INDEX: (org_id, event_type, timestamp)                           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  event_batches   │       │   csv_uploads    │
├──────────────────┤       ├──────────────────┤
│ id (UUID, PK)    │       │ id (UUID, PK)    │
│ org_id (FK)      │       │ org_id (FK)      │
│ total_count      │       │ uploaded_by (FK) │
│ success_count    │       │ filename         │
│ error_count      │       │ file_size_bytes  │
│ status           │       │ row_count        │
│ errors (JSONB)   │       │ status           │
│ created_at       │       │ mapping_config   │
│ completed_at     │       │ error_summary    │
└──────────────────┘       │ created_at       │
                           │ completed_at     │
                           └──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   dashboards     │       │     widgets      │       │ dashboard_shares │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID, PK)    │──┐    │ id (UUID, PK)    │       │ id (UUID, PK)    │
│ org_id (FK)      │  │    │ dashboard_id(FK) │◄──┐   │ dashboard_id(FK) │
│ created_by (FK)  │  │    │ org_id (FK)      │   │   │ share_token      │
│ title            │  │    │ title            │   │   │ permission       │
│ description      │  ├───►│ widget_type      │   │   │ expires_at       │
│ layout (JSONB)   │  │    │ config (JSONB)   │   │   │ created_at       │
│ is_default       │  │    │ time_range(JSONB)│   │   └──────────────────┘
│ auto_refresh_sec │  │    │ position (JSONB) │   │
│ created_at       │  │    │ created_at       │   │
│ updated_at       │  │    │ updated_at       │   │
│ deleted_at       │  │    │ deleted_at       │   │
└──────────────────┘  │    └──────────────────┘   │
                      └───────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   alert_rules    │       │  alert_events    │       │ notification_logs│
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (UUID, PK)    │──┐    │ id (UUID, PK)    │──┐    │ id (UUID, PK)    │
│ org_id (FK)      │  │    │ rule_id (FK)     │◄─┘    │ alert_event_id   │
│ created_by (FK)  │  │    │ org_id (FK)      │       │ channel          │
│ name             │  │    │ status           │       │ status           │
│ description      │  │    │ triggered_value  │       │ error_message    │
│ severity         │  │    │ threshold_value  │       │ sent_at          │
│ is_enabled       │  │    │ operator         │       └──────────────────┘
│ is_muted         │  │    │ fired_at         │
│ condition (JSONB)│  │    │ acknowledged_at  │
│ cooldown_minutes │  │    │ acknowledged_by  │
│ notification_    │  │    │ resolved_at      │
│   channels(JSONB)│  │    │ created_at       │
│ email_recipients │  │    └──────────────────┘
│ webhook_url      │  │
│ last_triggered_at│  │
│ created_at       │  │
│ updated_at       │  │
│ deleted_at       │  │
└──────────────────┘  │
                      └──── condition schema:
                            {
                              "event_type": "patient_visit",
                              "metric": "count",
                              "operator": ">",
                              "threshold": 100,
                              "time_window_minutes": 60
                            }
```

### Design Highlights

- **Multi-tenancy**: Every table includes `org_id` for complete data isolation
- **Soft deletes**: `deleted_at` column on mutable entities; filtered at repository level
- **Append-only events**: The `events` table never updates or deletes rows; composite indexes on `(org_id, timestamp)` and `(org_id, event_type, timestamp)` optimize time-series queries
- **JSONB flexibility**: Widget configs, alert conditions, and event properties use JSONB for schema-free extensibility
- **UUID primary keys**: All entities use UUID v4 for distributed-safe IDs

---

## RBAC & Authentication

### Authentication Flow

```
┌──────────┐    POST /auth/register     ┌──────────┐
│  Client  │ ─────────────────────────► │  Server  │
│          │    {email, password, name}  │          │
│          │ ◄───────────────────────── │          │
│          │    {access_token,           │          │
│          │     refresh_token, user}    │          │
└──────────┘                            └──────────┘

┌──────────┐    POST /auth/login        ┌──────────┐
│  Client  │ ─────────────────────────► │  Server  │
│          │    {email, password}        │          │
│          │ ◄───────────────────────── │          │
│          │    {access_token (15min),   │          │
│          │     refresh_token (7d)}     │          │
└──────────┘                            └──────────┘

┌──────────┐    POST /auth/refresh      ┌──────────┐
│  Client  │ ─────────────────────────► │  Server  │
│          │    {refresh_token}          │          │
│          │ ◄───────────────────────── │          │
│          │    {new_access_token,       │          │
│          │     new_refresh_token}      │          │
└──────────┘    (old token revoked)     └──────────┘
```

### JWT Token Payload

```json
{
  "sub": "user-uuid",
  "org_id": "org-uuid",
  "role": "admin",
  "exp": 1716000000
}
```

- **Access Token**: 15-minute expiry, contains user ID + org context + role
- **Refresh Token**: 7-day expiry, SHA-256 hashed in DB, rotated on each use
- **API Key Auth**: Separate auth path for ingestion endpoints via `X-API-Key` header

### Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RBAC Permission Matrix                          │
├──────────────────┬─────────┬─────────┬─────────┬──────────────────────┤
│ Action           │ Owner   │ Admin   │ Analyst │ Viewer               │
├──────────────────┼─────────┼─────────┼─────────┼──────────────────────┤
│ View dashboards  │   ✅    │   ✅    │   ✅    │   ✅                 │
│ View events      │   ✅    │   ✅    │   ✅    │   ✅                 │
│ View alerts      │   ✅    │   ✅    │   ✅    │   ✅                 │
│ View members     │   ✅    │   ✅    │   ✅    │   ✅                 │
├──────────────────┼─────────┼─────────┼─────────┼──────────────────────┤
│ Create dashboard │   ✅    │   ✅    │   ✅    │   ❌                 │
│ Edit dashboard   │   ✅    │   ✅    │   ✅    │   ❌                 │
│ Create alerts    │   ✅    │   ✅    │   ✅    │   ❌                 │
│ Upload CSV       │   ✅    │   ✅    │   ✅    │   ❌                 │
├──────────────────┼─────────┼─────────┼─────────┼──────────────────────┤
│ Manage API keys  │   ✅    │   ✅    │   ❌    │   ❌                 │
│ Invite members   │   ✅    │   ✅    │   ❌    │   ❌                 │
│ Update members   │   ✅    │   ✅    │   ❌    │   ❌                 │
│ Remove members   │   ✅    │   ✅    │   ❌    │   ❌                 │
├──────────────────┼─────────┼─────────┼─────────┼──────────────────────┤
│ Update org       │   ✅    │   ✅    │   ❌    │   ❌                 │
│ Delete org       │   ✅    │   ❌    │   ❌    │   ❌                 │
│ Change owner     │   ❌    │   ❌    │   ❌    │   ❌ (immutable)    │
└──────────────────┴─────────┴─────────┴─────────┴──────────────────────┘
```

### Implementation

```python
# Dependency factory pattern in dependencies.py
def require_role(*allowed_roles: str) -> Callable:
    async def check_role(user: User = Depends(get_current_user)) -> User:
        if user._role not in allowed_roles:
            raise Forbidden(f"Role '{user._role}' not allowed")
        return user
    return check_role

# Usage in router
@router.post("/dashboards", status_code=201)
async def create_dashboard(
    body: CreateDashboardRequest,
    user: User = Depends(require_role("owner", "admin", "analyst")),  # ← RBAC
    org_id: UUID = Depends(get_current_org_id),                       # ← Multi-tenancy
    db: AsyncSession = Depends(get_db),
): ...
```

### Invitation Flow

```
┌────────┐         ┌────────┐         ┌──────────────┐       ┌────────┐
│ Admin  │         │ Server │         │ Email (SMTP) │       │ Invitee│
└───┬────┘         └───┬────┘         └──────┬───────┘       └───┬────┘
    │ POST /orgs/      │                     │                   │
    │ {org}/invitations│                     │                   │
    │ {email, role}    │                     │                   │
    ├──────────────────►                     │                   │
    │                  │ Generate token       │                   │
    │                  │ Hash + store in DB   │                   │
    │                  │ ────────────────►    │                   │
    │                  │      Send email      │                   │
    │                  │      with link       │                   │
    │ 201 Created      │                     │ Email with link   │
    │◄─────────────────┤                     ├──────────────────►│
    │                  │                     │                   │
    │                  │ POST /auth/accept-invite/{token}        │
    │                  │◄───────────────────────────────────────┤
    │                  │ Create user + membership                │
    │                  │ Mark invitation accepted                 │
    │                  │────────────────────────────────────────►│
    │                  │ {access_token, refresh_token}           │
```

---

## User Journey & Flow Diagrams

### 1. Registration & Onboarding

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  Sign Up  │────►│  Create   │────►│  Generate │────►│ Dashboard │
│  Page     │     │  Org      │     │  API Key  │     │  Builder  │
│           │     │           │     │  (Data    │     │           │
│ email +   │     │ name +    │     │   page)   │     │ Create    │
│ password  │     │ slug      │     │           │     │ first     │
│ + name    │     │           │     │           │     │ dashboard │
└───────────┘     └───────────┘     └───────────┘     └───────────┘
```

### 2. Data Ingestion Pipeline

```
                    ┌─────────────────────┐
                    │   Data Sources      │
                    └──────┬──────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ REST API │    │ CSV      │    │ Batch    │
   │ (single) │    │ Upload   │    │ API      │
   │          │    │          │    │          │
   │ POST     │    │ POST     │    │ POST     │
   │ /events  │    │ /csv/    │    │ /events/ │
   │          │    │  upload  │    │  batch   │
   │ X-API-Key│    │ + map    │    │ X-API-Key│
   └────┬─────┘    └────┬─────┘    └────┬─────┘
        │               │               │
        ▼               ▼               ▼
   ┌──────────────────────────────────────────┐
   │         Events Table (PostgreSQL)         │
   │  Indexed: (org_id, timestamp)             │
   │  Indexed: (org_id, event_type, timestamp) │
   └──────────────────────┬───────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ Dashboard  │ │  Alert     │ │ WebSocket  │
    │ Widgets    │ │  Evaluator │ │ Broadcast  │
    │ (queries)  │ │ (Celery)   │ │ (Redis)    │
    └────────────┘ └────────────┘ └────────────┘
```

### 3. Dashboard Builder Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dashboard Builder Page                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Toolbar: [Time Range ▼] [Auto-refresh ▼] [+ Add Widget] │   │
│  │          [Save] [Share] [Duplicate]                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │   KPI Card          │  │   Line Chart        │              │
│  │   ┌───────────┐     │  │   ╭─────────╮       │              │
│  │   │  1,247    │     │  │  ╱           ╲      │              │
│  │   │ Total     │     │  │╱              ╲╱    │              │
│  │   │ Events    │     │  │                     │              │
│  │   └───────────┘     │  │  [Drag to resize]   │              │
│  │  [Drag to move]     │  └─────────────────────┘              │
│  └─────────────────────┘                                        │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │   Bar Chart         │  │   Pie Chart         │              │
│  │   ▌▌▌               │  │      ╱ ╲            │              │
│  │   ███               │  │    ╱ 45% ╲          │              │
│  │   ████              │  │   │  30%  │         │              │
│  │   ██                │  │    ╲ 25% ╱          │              │
│  │                     │  │      ╲ ╱            │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  Widget Types: line | bar | pie | kpi | table                   │
│  Config: event_type, aggregation (count/sum/avg), group_by,     │
│          filters, time_range                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Alert Lifecycle

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  Create    │    │  Evaluate  │    │   Fire     │    │  Resolve   │
│  Rule      │───►│  (Celery   │───►│  Alert     │───►│  Alert     │
│            │    │   60s beat)│    │  Event     │    │            │
│ event_type │    │            │    │            │    │ Manual or  │
│ metric     │    │ Query      │    │ Notify via │    │ auto       │
│ operator   │    │ events in  │    │ - in_app   │    │            │
│ threshold  │    │ time window│    │ - email    │    │            │
│ severity   │    │            │    │ - webhook  │    │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
                                           │
                     Status Flow:          │
                     firing ──► acknowledged ──► resolved
```

### 5. Complete User Journey Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  SIGN UP ──► CREATE ORG ──► INVITE ──────────────────────────────┐  │
│                │            TEAM                                 │  │
│                ▼            MEMBERS                               │  │
│          GENERATE                                                │  │
│          API KEY ◄────────────────────────────────────────────┐  │  │
│                │                                              │  │  │
│    ┌───────────┼───────────────┐                              │  │  │
│    ▼           ▼               ▼                              │  │  │
│  INGEST     UPLOAD CSV    BATCH INGEST                        │  │  │
│  VIA API    ┌──────────┐  VIA API                             │  │  │
│             │ Upload   │                                      │  │  │
│             │ Map cols │                                      │  │  │
│             │ Import   │                                      │  │  │
│             └──────────┘                                      │  │  │
│    │           │               │                              │  │  │
│    └───────────┼───────────────┘                              │  │  │
│                ▼                                              │  │  │
│        ┌───────────────┐                                      │  │  │
│        │ EVENTS TABLE  │                                      │  │  │
│        └───────┬───────┘                                      │  │  │
│                │                                              │  │  │
│    ┌───────────┼───────────────┐                              │  │  │
│    ▼           ▼               ▼                              │  │  │
│  CREATE     SET UP          LIVE                              │  │  │
│  DASHBOARD  ALERTS          EVENT                             │  │  │
│    │           │            STREAM                             │  │  │
│    ▼           ▼            (WebSocket)                        │  │  │
│  ADD        THRESHOLD                                         │  │  │
│  WIDGETS    TRIGGERS                                          │  │  │
│  (line/bar/ (count > N in                                     │  │  │
│   pie/kpi/   time window)                                     │  │  │
│   table)       │                                              │  │  │
│    │           ▼                                              │  │  │
│    ▼        ALERT                                             │  │  │
│  SHARE      FIRES ──► NOTIFY ──► ACKNOWLEDGE ──► RESOLVE     │  │  │
│  DASHBOARD                                                    │  │  │
│  (public link)                                                │  │  │
│                                                               │  │  │
│  SETTINGS: Manage team, update org, update profile            │  │  │
│                                                               │  │  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Real-Time WebSocket System

### Architecture

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Browser  │      │ Browser  │      │ Browser  │
│ Tab 1    │      │ Tab 2    │      │ Tab 3    │
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │ WS              │ WS              │ WS
     ▼                 ▼                 ▼
┌────────────────────────────────────────────────┐
│              FastAPI WebSocket                  │
│         ConnectionManager (per-process)         │
└────────────────────┬───────────────────────────┘
                     │ Pub/Sub
                     ▼
              ┌──────────────┐
              │    Redis     │
              │  Pub/Sub     │
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Worker 1 │ │ Worker 2 │ │ Celery   │
   │ (WS)     │ │ (WS)     │ │ (publish)│
   └──────────┘ └──────────┘ └──────────┘
```

### WebSocket Endpoints

| Endpoint | Channel Pattern | Purpose |
|----------|----------------|---------|
| `/ws/dashboards/{id}` | `dashboard:{id}` | Live widget data updates |
| `/ws/alerts` | `alerts:{org_id}` | Real-time alert notifications |
| `/ws/events` | `events:{org_id}` | Live event stream |

**Authentication**: JWT token passed as `?token=<jwt>` query parameter.

**Reconnection**: Client implements exponential backoff with automatic reconnection.

---

## Module Breakdown

### Module 1: Multi-Tenant Authentication (Must-Have)
- JWT-based auth with 15-min access + 7-day refresh tokens
- Organization creation with automatic owner membership
- Email-based invitations with secure hashed tokens (7-day expiry)
- Role-based access control: owner → admin → analyst → viewer
- Org switching without re-login (switch-org endpoint)
- Profile management (name, email updates)

### Module 2: Data Ingestion Engine (Must-Have)
- **Single event API**: `POST /events` with API key auth
- **Batch ingestion**: Up to 1000 events per request
- **CSV upload**: File upload → column preview → mapping → import
- **API key management**: Create, list, revoke keys with scopes
- **Event querying**: Filter by type, actor, source, time range
- **Statistics dashboard**: Today's count, events/min, source breakdown

### Module 3: Dashboard & Visualization (Must-Have)
- **Dashboard CRUD**: Create, update, delete, duplicate dashboards
- **Widget types**: Line chart, Bar chart, Pie chart, KPI card, Data table
- **Drag-and-drop grid**: react-grid-layout for widget positioning
- **Widget configuration**: Event type, aggregation (count/sum/avg), group_by, filters
- **Time range controls**: Relative (1h, 24h, 7d, 30d) and custom ranges
- **Auto-refresh**: Configurable per dashboard
- **Public sharing**: Token-based share links with optional expiry

### Module 4: Alerting & Notifications (Should-Have)
- **Rule builder**: Define conditions (metric + operator + threshold + time window)
- **Severity levels**: Critical, Warning, Info
- **Notification channels**: In-app, Email (SMTP), Webhook
- **Alert lifecycle**: Firing → Acknowledged → Resolved
- **Cooldown periods**: Prevent alert storms (configurable per rule)
- **Mute/unmute**: Temporarily silence alerts
- **History**: Full audit trail of alert events

### Module 5: Real-Time Updates (Should-Have)
- **WebSocket connections**: Dashboard updates, alert notifications, event stream
- **Redis Pub/Sub**: Cross-process message broadcasting
- **Live event viewer**: Real-time event stream with filtering
- **Graceful fallback**: Works without Redis (local-only broadcast)
- **Auto-reconnection**: Exponential backoff on connection loss

---

## Setup & Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 16
- Redis 7

### Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/THARUNKUMARBACHU/Technical_assesment_wexaAI.git
cd Technical_assesment_wexaAI

# 2. Start PostgreSQL + Redis
docker-compose up -d

# 3. Setup backend
cd backend
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Setup frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Backend Environment Variables

```bash
# .env
DATABASE_URL=postgresql://analytics:analytics_dev_pass@localhost:5432/analytics_platform
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your-secret-key-here    # Generate: openssl rand -hex 32
CORS_ORIGINS=["http://localhost:3000"]
FRONTEND_URL=http://localhost:3000

# Optional: SMTP for invitation emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Frontend Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Running Celery Worker (for alert evaluation)

```bash
cd backend
celery -A app.celery_app worker --loglevel=info --concurrency=2
```

---

## Deployment

### Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│                  (Frontend - Next.js)                        │
│            Auto-deploy from main branch                      │
│            NEXT_PUBLIC_API_URL → Render backend              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS API calls
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        Render                                │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ Web Service   │  │ Worker        │  │ Redis          │   │
│  │ (gunicorn +   │  │ (Celery)      │  │ (Pub/Sub +     │   │
│  │  uvicorn)     │  │               │  │  Broker)       │   │
│  │ 2 workers     │  │ concurrency=2 │  │                │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────────┘   │
│          │                  │                                │
│          └────────┬─────────┘                                │
│                   ▼                                          │
│          ┌───────────────┐                                   │
│          │ PostgreSQL    │                                    │
│          │ (Managed DB)  │                                    │
│          └───────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### Deploy to Render

The project includes `render.yaml` for one-click deploy:

1. Connect your GitHub repo to Render
2. Render auto-detects `render.yaml` and creates:
   - **Web service**: FastAPI backend with gunicorn
   - **Worker**: Celery for background tasks
   - **Redis**: For Pub/Sub and Celery broker
   - **PostgreSQL**: Managed database
3. Set environment variables: `CORS_ORIGINS`, `FRONTEND_URL`, `JWT_SECRET_KEY`

### Deploy Frontend to Vercel

1. Import the GitHub repo in Vercel
2. Set root directory to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL` = your Render backend URL
4. Deploy — Vercel auto-detects Next.js

---

## Testing the Platform

### 1. Register & Create Organization
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "Pass123!", "full_name": "Admin User", "org_name": "My Hospital", "org_slug": "my-hospital"}'
```

### 2. Generate API Key
```bash
curl -X POST http://localhost:8000/api/v1/api-keys \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Ingestion Key", "scopes": ["ingest"]}'
```

### 3. Ingest Events
```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "patient_visit", "event_name": "ER Visit", "actor_id": "patient_001", "numeric_value": 1, "properties": {"department": "ER", "severity": "high"}}'
```

### 4. Upload CSV
Use the included `sample_data/health_events.csv` — upload via the UI at `/data/upload`, map columns, and the events appear in your dashboards.

### 5. Create Dashboard
Via UI: Navigate to `/dashboards` → "New Dashboard" → Add widgets (line, bar, pie, KPI) → Configure event_type, aggregation, time range → Save.

### 6. Set Up Alert
Via UI: Navigate to `/alerts` → "New Rule" → Set condition (e.g., patient_visit count > 50 in 60 minutes) → Choose severity and notification channels → Save.

---

## Author

**Tharun Kumar Bachu**
- GitHub: [@THARUNKUMARBACHU](https://github.com/THARUNKUMARBACHU)

Built as a technical assessment for the Full Stack Python Developer role at Wexa AI.
