# API Contracts - Real-Time Analytics Platform

Base URL: `http://localhost:8000/api/v1`
Auth: Bearer JWT in `Authorization` header (except where noted)
Content-Type: `application/json` (except file uploads)

---

## 1. Authentication

### POST /auth/register
Create a new user + organization.

**Request:**
```json
{
  "email": "alice@company.com",
  "password": "SecurePass1!",
  "full_name": "Alice Smith",
  "org_name": "ShopCo"
}
```

**Response: 201**
```json
{
  "user": {
    "id": "uuid",
    "email": "alice@company.com",
    "full_name": "Alice Smith",
    "is_active": true,
    "created_at": "2026-05-16T10:00:00Z"
  },
  "organization": {
    "id": "uuid",
    "name": "ShopCo",
    "slug": "shopco",
    "created_at": "2026-05-16T10:00:00Z"
  },
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer"
}
```

### POST /auth/login
**Request:**
```json
{
  "email": "alice@company.com",
  "password": "SecurePass1!"
}
```

**Response: 200**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "alice@company.com",
    "full_name": "Alice Smith",
    "is_active": true,
    "last_login_at": "2026-05-16T10:00:00Z"
  },
  "organizations": [
    {
      "id": "uuid",
      "name": "ShopCo",
      "slug": "shopco",
      "role": "owner",
      "member_count": 3
    }
  ]
}
```

### POST /auth/refresh
**Request:**
```json
{
  "refresh_token": "eyJhbG..."
}
```

**Response: 200**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer"
}
```

### POST /auth/logout
Revokes the current refresh token.

**Request:**
```json
{
  "refresh_token": "eyJhbG..."
}
```

**Response: 204** No Content

### POST /auth/switch-org
Switch current organization context. Returns new JWT pair scoped to the target org.

**Request:**
```json
{
  "org_id": "uuid"
}
```

**Response: 200**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer",
  "organization": {
    "id": "uuid",
    "name": "ShopCo",
    "slug": "shopco",
    "role": "owner",
    "member_count": 3
  }
}
```

### GET /auth/me
**Response: 200**
```json
{
  "id": "uuid",
  "email": "alice@company.com",
  "full_name": "Alice Smith",
  "is_active": true,
  "last_login_at": "2026-05-16T10:00:00Z",
  "created_at": "2026-05-16T10:00:00Z",
  "current_org": {
    "id": "uuid",
    "name": "ShopCo",
    "slug": "shopco",
    "role": "owner"
  }
}
```

### PATCH /auth/me
**Request:**
```json
{
  "full_name": "Alice Johnson",
  "password": "NewSecurePass2!"
}
```

**Response: 200** (updated user object)

---

## 2. Organizations

### POST /orgs
Create a new organization. Requires auth.

**Request:**
```json
{
  "name": "StartupXYZ",
  "slug": "startupxyz",
  "industry": "saas"
}
```

**Response: 201**
```json
{
  "id": "uuid",
  "name": "StartupXYZ",
  "slug": "startupxyz",
  "settings": {"industry": "saas"},
  "created_at": "2026-05-16T10:00:00Z"
}
```

### GET /orgs
List all orgs the current user belongs to.

**Response: 200**
```json
[
  {
    "id": "uuid",
    "name": "ShopCo",
    "slug": "shopco",
    "role": "owner",
    "member_count": 3,
    "created_at": "2026-05-16T10:00:00Z"
  }
]
```

### GET /orgs/{org_id}
**Response: 200** (single org object with settings)

### PATCH /orgs/{org_id}
**Roles:** owner, admin

**Request:**
```json
{
  "name": "ShopCo Inc.",
  "settings": {"industry": "ecommerce", "timezone": "America/New_York"}
}
```

### DELETE /orgs/{org_id}
**Roles:** owner only. Soft delete.
**Response: 204**

---

## 3. Organization Members

### GET /orgs/{org_id}/members
**Response: 200**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "email": "alice@shopco.com",
    "full_name": "Alice Smith",
    "role": "owner",
    "created_at": "2026-05-16T10:00:00Z"
  }
]
```

### PATCH /orgs/{org_id}/members/{membership_id}
**Roles:** owner, admin

**Request:**
```json
{
  "role": "analyst"
}
```

### DELETE /orgs/{org_id}/members/{membership_id}
**Roles:** owner, admin. Cannot remove owner.
**Response: 204**

---

## 4. Invitations

### POST /orgs/{org_id}/invitations
**Roles:** owner, admin

**Request:**
```json
{
  "email": "dave@shopco.com",
  "role": "viewer"
}
```

**Response: 201**
```json
{
  "id": "uuid",
  "email": "dave@shopco.com",
  "role": "viewer",
  "invited_by": "uuid",
  "expires_at": "2026-05-23T10:00:00Z",
  "created_at": "2026-05-16T10:00:00Z"
}
```

### GET /orgs/{org_id}/invitations
**Response: 200** (list of pending invitations)

### DELETE /orgs/{org_id}/invitations/{invitation_id}
Revoke invitation.
**Response: 204**

### POST /auth/accept-invite/{token}
Accept an invitation (may or may not require auth if user already exists).

**Request:**
```json
{
  "full_name": "Dave Wilson",
  "password": "SecurePass1!"
}
```

**Response: 200** (same as login response)

---

## 5. Data Ingestion

### POST /events
Ingest a single event. Auth: API Key (`X-API-Key` header).

**Request:**
```json
{
  "event_type": "purchase",
  "event_name": "Product Purchased",
  "actor_id": "user-8842",
  "properties": {
    "amount": 79.99,
    "product": "Running Shoes",
    "category": "footwear"
  },
  "numeric_value": 79.99,
  "timestamp": "2026-05-16T14:32:01.234Z"
}
```

**Response: 201**
```json
{
  "id": "uuid",
  "status": "accepted",
  "received_at": "2026-05-16T14:32:01.500Z"
}
```

### POST /events/batch
Ingest multiple events (max 1000). Auth: API Key.

**Request:**
```json
{
  "events": [
    {
      "event_type": "purchase",
      "event_name": "Product Purchased",
      "actor_id": "user-8842",
      "properties": {"amount": 79.99},
      "numeric_value": 79.99,
      "timestamp": "2026-05-16T14:32:01.234Z"
    }
  ]
}
```

**Response: 202**
```json
{
  "batch_id": "uuid",
  "total_count": 50,
  "status": "processing"
}
```

### GET /events
Query events. Auth: Bearer JWT.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| event_type | string | - | Filter by type |
| actor_id | string | - | Filter by actor |
| source | string | - | Filter: api, csv, webhook |
| start_time | datetime | -24h | Range start |
| end_time | datetime | now | Range end |
| limit | int | 50 | Max 200 |
| offset | int | 0 | Pagination |
| order | string | desc | asc or desc |

**Response: 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "event_type": "purchase",
      "event_name": "Product Purchased",
      "actor_id": "user-8842",
      "properties": {"amount": 79.99, "product": "Running Shoes"},
      "numeric_value": 79.99,
      "source": "api",
      "timestamp": "2026-05-16T14:32:01.234Z",
      "received_at": "2026-05-16T14:32:01.500Z"
    }
  ],
  "total": 1247,
  "limit": 50,
  "offset": 0
}
```

### GET /events/stats
Aggregated event statistics for the Data Sources overview page.

**Response: 200**
```json
{
  "today_count": 24531,
  "events_per_minute": 142,
  "csv_uploads_this_month": 3,
  "last_csv_upload": {
    "filename": "sales_q1.csv",
    "row_count": 1523
  },
  "active_api_keys": 3,
  "sources": {
    "api": 20100,
    "csv": 3500,
    "webhook": 931
  }
}
```

---

## 6. API Keys

### POST /api-keys
**Roles:** owner, admin

**Request:**
```json
{
  "name": "Production Backend",
  "scopes": ["ingest"],
  "expires_at": "2027-05-16T00:00:00Z"
}
```

**Response: 201**
```json
{
  "id": "uuid",
  "name": "Production Backend",
  "key": "ak_live_7f3d8a2b1c4e5f6g7h8i9j0k...",
  "key_prefix": "ak_live_7f3d",
  "scopes": ["ingest"],
  "expires_at": "2027-05-16T00:00:00Z",
  "created_at": "2026-05-16T10:00:00Z"
}
```
> The full `key` is ONLY returned on creation. Store it securely.

### GET /api-keys
**Response: 200**
```json
[
  {
    "id": "uuid",
    "name": "Production Backend",
    "key_prefix": "ak_live_7f3d",
    "scopes": ["ingest"],
    "last_used_at": "2026-05-16T14:30:00Z",
    "expires_at": "2027-05-16T00:00:00Z",
    "created_at": "2026-05-16T10:00:00Z"
  }
]
```

### DELETE /api-keys/{key_id}
Revoke an API key. Soft delete (sets `revoked_at`).
**Response: 204**

---

## 7. CSV Uploads

### POST /csv/upload
Multipart form upload. Auth: Bearer JWT.
**Roles:** owner, admin, analyst

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| file | File | CSV/TSV file (max 50MB) |

**Response: 201**
```json
{
  "id": "uuid",
  "filename": "sales_q1_2026.csv",
  "file_size_bytes": 245000,
  "row_count": null,
  "status": "uploaded",
  "columns": ["date", "product", "amount", "customer_id", "region"],
  "preview_rows": [
    ["2026-01-15", "Running Shoes", "79.99", "user-123", "US"],
    ["2026-01-15", "T-Shirt", "29.99", "user-456", "EU"]
  ],
  "created_at": "2026-05-16T10:00:00Z"
}
```

### POST /csv/{upload_id}/map
Submit column mapping and start import.

**Request:**
```json
{
  "mapping": {
    "timestamp": "date",
    "event_type": "_static:purchase",
    "actor_id": "customer_id",
    "numeric_value": "amount",
    "properties": {
      "product": "product",
      "region": "region"
    }
  }
}
```

**Response: 202**
```json
{
  "id": "uuid",
  "status": "processing",
  "row_count": 1523,
  "mapping_config": { ... }
}
```

### GET /csv/uploads
**Response: 200**
```json
[
  {
    "id": "uuid",
    "filename": "sales_q1_2026.csv",
    "file_size_bytes": 245000,
    "row_count": 1523,
    "status": "completed",
    "success_count": 1520,
    "error_count": 3,
    "error_summary": [
      {"row": 45, "error": "Invalid timestamp format"},
      {"row": 892, "error": "Missing required field: amount"}
    ],
    "uploaded_by": "uuid",
    "created_at": "2026-05-16T10:00:00Z",
    "completed_at": "2026-05-16T10:02:30Z"
  }
]
```

---

## 8. Dashboards

### GET /dashboards
**Query Params:** `filter` (all | mine | shared), `search` (string)

**Response: 200**
```json
[
  {
    "id": "uuid",
    "title": "Sales Dashboard",
    "description": "Track sales metrics",
    "widget_count": 4,
    "is_default": false,
    "auto_refresh_seconds": 60,
    "created_by": {
      "id": "uuid",
      "full_name": "Alice Smith"
    },
    "updated_at": "2026-05-16T12:00:00Z",
    "created_at": "2026-05-10T10:00:00Z"
  }
]
```

### POST /dashboards
**Roles:** owner, admin, analyst

**Request:**
```json
{
  "title": "Sales Dashboard",
  "description": "Track sales metrics",
  "is_default": false,
  "auto_refresh_seconds": 60
}
```

**Response: 201** (full dashboard object with empty widgets array)

### GET /dashboards/{dashboard_id}
Full dashboard with all widgets.

**Response: 200**
```json
{
  "id": "uuid",
  "title": "Sales Dashboard",
  "description": "Track sales metrics",
  "is_default": false,
  "auto_refresh_seconds": 60,
  "layout": {},
  "widgets": [
    {
      "id": "uuid",
      "title": "Purchases per Hour",
      "widget_type": "line",
      "config": {
        "event_type": "purchase",
        "aggregation": "count",
        "time_bucket": "hour",
        "group_by": null,
        "filters": []
      },
      "time_range": {
        "type": "relative",
        "value": "24h"
      },
      "position": {"x": 0, "y": 0, "w": 6, "h": 4}
    }
  ],
  "created_by": {
    "id": "uuid",
    "full_name": "Alice Smith"
  },
  "updated_at": "2026-05-16T12:00:00Z",
  "created_at": "2026-05-10T10:00:00Z"
}
```

### PATCH /dashboards/{dashboard_id}
**Request:**
```json
{
  "title": "Sales Dashboard v2",
  "auto_refresh_seconds": 30
}
```

### DELETE /dashboards/{dashboard_id}
**Roles:** owner, admin, or creator
**Response: 204**

### POST /dashboards/{dashboard_id}/duplicate
**Response: 201** (new dashboard object, all widgets cloned)

---

## 9. Widgets

### POST /dashboards/{dashboard_id}/widgets
**Request:**
```json
{
  "title": "Purchases per Hour",
  "widget_type": "line",
  "config": {
    "event_type": "purchase",
    "aggregation": "count",
    "time_bucket": "hour",
    "group_by": null,
    "filters": [
      {"field": "properties.region", "operator": "eq", "value": "US"}
    ]
  },
  "time_range": {"type": "relative", "value": "24h"},
  "position": {"x": 0, "y": 0, "w": 6, "h": 4}
}
```

**Response: 201** (widget object)

### PATCH /dashboards/{dashboard_id}/widgets/{widget_id}
Partial update (config, position, title, etc).

### DELETE /dashboards/{dashboard_id}/widgets/{widget_id}
**Response: 204**

### PATCH /dashboards/{dashboard_id}/layout
Bulk update all widget positions (after drag-and-drop).

**Request:**
```json
{
  "layout": [
    {"widget_id": "uuid", "x": 0, "y": 0, "w": 6, "h": 4},
    {"widget_id": "uuid", "x": 6, "y": 0, "w": 6, "h": 4}
  ]
}
```

**Response: 200**

### GET /dashboards/{dashboard_id}/widgets/{widget_id}/data
Execute the widget's query and return chart data.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| time_range | string | Override: 1h, 6h, 24h, 7d, 30d |
| start_time | datetime | Custom range start |
| end_time | datetime | Custom range end |

**Response: 200**
```json
{
  "widget_id": "uuid",
  "widget_type": "line",
  "data": {
    "labels": ["00:00", "01:00", "02:00", "03:00"],
    "datasets": [
      {
        "label": "purchase",
        "values": [45, 52, 38, 67]
      }
    ]
  },
  "meta": {
    "total": 202,
    "time_range": {"start": "...", "end": "..."},
    "aggregation": "count",
    "time_bucket": "hour"
  }
}
```

**KPI widget data:**
```json
{
  "widget_id": "uuid",
  "widget_type": "kpi",
  "data": {
    "current_value": 12450,
    "previous_value": 11085,
    "change_percent": 12.3,
    "change_direction": "up"
  },
  "meta": { ... }
}
```

**Table widget data:**
```json
{
  "widget_id": "uuid",
  "widget_type": "table",
  "data": {
    "columns": ["product", "sales", "revenue"],
    "rows": [
      {"product": "Running Shoes", "sales": 142, "revenue": 8520},
      {"product": "T-Shirts", "sales": 98, "revenue": 2940}
    ]
  },
  "meta": { ... }
}
```

**Pie widget data:**
```json
{
  "widget_id": "uuid",
  "widget_type": "pie",
  "data": {
    "labels": ["US", "EU", "APAC"],
    "values": [45, 30, 25]
  },
  "meta": { ... }
}
```

---

## 10. Dashboard Sharing

### POST /dashboards/{dashboard_id}/share
**Roles:** owner, admin, or dashboard creator

**Request:**
```json
{
  "shared_with_user_id": "uuid",
  "permission": "view",
  "expires_at": "2026-06-16T00:00:00Z"
}
```

**Response: 201**
```json
{
  "id": "uuid",
  "share_token": "abc123def456",
  "permission": "view",
  "expires_at": "2026-06-16T00:00:00Z"
}
```

### GET /shared/{share_token}
Public access (no auth required). Returns dashboard + widget data.

**Response: 200** (same as GET /dashboards/{id} but read-only)

---

## 11. Alert Rules

### GET /alerts/rules
**Query Params:** `status` (all | active | triggered | muted)

**Response: 200**
```json
[
  {
    "id": "uuid",
    "name": "High Error Rate",
    "description": "Alert when error count exceeds safe threshold",
    "severity": "critical",
    "is_enabled": true,
    "is_muted": false,
    "muted_until": null,
    "condition": {
      "event_type": "error",
      "metric": "count",
      "operator": "gt",
      "threshold": 50,
      "time_window_minutes": 10
    },
    "cooldown_minutes": 15,
    "notification_channels": ["in_app", "email", "webhook"],
    "email_recipients": ["alice@shopco.com", "bob@shopco.com"],
    "webhook_url": "https://hooks.slack.com/services/T00/B00/xxx",
    "last_triggered_at": "2026-05-16T12:05:00Z",
    "created_at": "2026-05-10T10:00:00Z"
  }
]
```

### POST /alerts/rules
**Roles:** owner, admin, analyst

**Request:**
```json
{
  "name": "High Error Rate",
  "description": "Alert when error count exceeds safe threshold",
  "severity": "critical",
  "condition": {
    "event_type": "error",
    "metric": "count",
    "operator": "gt",
    "threshold": 50,
    "time_window_minutes": 10
  },
  "cooldown_minutes": 15,
  "notification_channels": ["in_app", "email", "webhook"],
  "email_recipients": ["alice@shopco.com", "bob@shopco.com"],
  "webhook_url": "https://hooks.slack.com/services/T00/B00/xxx"
}
```

**Response: 201** (full rule object)

### PATCH /alerts/rules/{rule_id}
Partial update (name, condition, channels, etc).

### DELETE /alerts/rules/{rule_id}
**Response: 204**

### POST /alerts/rules/{rule_id}/mute
**Request:**
```json
{
  "duration_minutes": 60
}
```

**Response: 200**
```json
{
  "is_muted": true,
  "muted_until": "2026-05-16T15:00:00Z"
}
```

### POST /alerts/rules/{rule_id}/unmute
**Response: 200**

### PATCH /alerts/rules/{rule_id}/toggle
**Request:**
```json
{
  "is_enabled": false
}
```

---

## 12. Alert Events (History)

### GET /alerts/events
**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | all | firing, acknowledged, resolved |
| rule_id | uuid | - | Filter by rule |
| time_range | string | 7d | 24h, 7d, 30d |
| limit | int | 20 | Max 100 |
| offset | int | 0 | Pagination |

**Response: 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "rule_id": "uuid",
      "rule_name": "High Error Rate",
      "severity": "critical",
      "status": "firing",
      "triggered_value": 73,
      "threshold_value": 50,
      "operator": "gt",
      "fired_at": "2026-05-16T14:05:00Z",
      "acknowledged_at": null,
      "acknowledged_by": null,
      "resolved_at": null
    }
  ],
  "total": 12,
  "limit": 20,
  "offset": 0
}
```

### PATCH /alerts/events/{event_id}/acknowledge
**Response: 200**
```json
{
  "status": "acknowledged",
  "acknowledged_at": "2026-05-16T14:10:00Z",
  "acknowledged_by": "uuid"
}
```

### PATCH /alerts/events/{event_id}/resolve
**Response: 200**
```json
{
  "status": "resolved",
  "resolved_at": "2026-05-16T14:15:00Z"
}
```

---

## 13. WebSocket Messages

### Connection
```
ws://localhost:8000/ws/dashboards/{dashboard_id}?token={jwt}
ws://localhost:8000/ws/alerts?token={jwt}
ws://localhost:8000/ws/events?token={jwt}
```

### Message Format (all channels)
```json
{
  "type": "string",
  "payload": {},
  "timestamp": "2026-05-16T14:32:01Z"
}
```

### Dashboard Channel Messages

**Server -> Client: widget_data_update**
```json
{
  "type": "widget_data_update",
  "payload": {
    "widget_id": "uuid",
    "data": { ... }
  },
  "timestamp": "2026-05-16T14:32:01Z"
}
```

**Client -> Server: subscribe_widgets**
```json
{
  "type": "subscribe_widgets",
  "payload": {
    "widget_ids": ["uuid", "uuid"]
  }
}
```

### Alerts Channel Messages

**Server -> Client: alert_fired**
```json
{
  "type": "alert_fired",
  "payload": {
    "event_id": "uuid",
    "rule_id": "uuid",
    "rule_name": "High Error Rate",
    "severity": "critical",
    "triggered_value": 73,
    "threshold_value": 50,
    "fired_at": "2026-05-16T14:05:00Z"
  },
  "timestamp": "2026-05-16T14:05:00Z"
}
```

**Server -> Client: alert_resolved**
```json
{
  "type": "alert_resolved",
  "payload": {
    "event_id": "uuid",
    "rule_id": "uuid",
    "rule_name": "High Error Rate",
    "resolved_at": "2026-05-16T14:30:00Z"
  },
  "timestamp": "2026-05-16T14:30:00Z"
}
```

### Events Channel Messages

**Server -> Client: new_event**
```json
{
  "type": "new_event",
  "payload": {
    "id": "uuid",
    "event_type": "purchase",
    "event_name": "Product Purchased",
    "actor_id": "user-8842",
    "properties": {"amount": 79.99, "product": "Running Shoes"},
    "numeric_value": 79.99,
    "source": "api",
    "timestamp": "2026-05-16T14:32:01.234Z"
  },
  "timestamp": "2026-05-16T14:32:01Z"
}
```

**Client -> Server: set_filters**
```json
{
  "type": "set_filters",
  "payload": {
    "event_types": ["purchase", "error"],
    "sources": ["api"]
  }
}
```

### Heartbeat (all channels)
**Client -> Server (every 30s):**
```json
{"type": "ping"}
```
**Server -> Client:**
```json
{"type": "pong"}
```

---

## 14. Health Checks

### GET /health
No auth required.
**Response: 200**
```json
{"status": "healthy"}
```

### GET /health/ready
Checks DB + Redis connectivity. No auth.
**Response: 200**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      {"field": "email", "message": "Invalid email format"}
    ]
  }
}
```

**Error Codes:**
| HTTP | Code | Description |
|------|------|-------------|
| 400 | VALIDATION_ERROR | Request body validation failed |
| 401 | UNAUTHORIZED | Missing or expired token |
| 403 | FORBIDDEN | Insufficient role permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Duplicate resource (email, slug) |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Unexpected server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /events (API Key) | 100/second per key |
| POST /events/batch | 10/second per key |
| All other endpoints | 60/minute per user |

Rate limit headers on every response:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1716300060
```
