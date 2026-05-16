// ============================================================
// API Contract Types - Frontend/Backend Shared Interface
// ============================================================

// ---------- Common ----------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

// ---------- Auth ----------

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface UserWithOrg extends User {
  current_org: OrgMembership;
}

export type Role = "owner" | "admin" | "analyst" | "viewer";

export interface OrgMembership {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface OrgSummary extends OrgMembership {
  member_count: number;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

// Request types
export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  org_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface SwitchOrgRequest {
  org_id: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  password?: string;
}

// Response types
export interface RegisterResponse extends TokenPair {
  user: User;
  organization: Organization;
}

export interface LoginResponse extends TokenPair {
  user: User;
  organizations: OrgSummary[];
}

export interface SwitchOrgResponse extends TokenPair {
  organization: OrgSummary;
}

// ---------- Organizations ----------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrgRequest {
  name: string;
  slug: string;
  industry?: string;
}

export interface UpdateOrgRequest {
  name?: string;
  settings?: Record<string, unknown>;
}

// ---------- Members ----------

export interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface UpdateMemberRequest {
  role: Role;
}

// ---------- Invitations ----------

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: Role;
}

export interface AcceptInviteRequest {
  full_name: string;
  password: string;
}

// ---------- Events / Ingestion ----------

export interface Event {
  id: string;
  event_type: string;
  event_name: string | null;
  actor_id: string | null;
  properties: Record<string, unknown>;
  numeric_value: number | null;
  source: EventSource;
  timestamp: string;
  received_at: string;
}

export type EventSource = "api" | "csv" | "webhook";

export interface EventIngest {
  event_type: string;
  event_name?: string;
  actor_id?: string;
  properties?: Record<string, unknown>;
  numeric_value?: number;
  timestamp?: string;
}

export interface BatchIngestRequest {
  events: EventIngest[];
}

export interface BatchIngestResponse {
  batch_id: string;
  total_count: number;
  status: "processing";
}

export interface SingleIngestResponse {
  id: string;
  status: "accepted";
  received_at: string;
}

export interface EventsQueryParams {
  event_type?: string;
  actor_id?: string;
  source?: EventSource;
  start_time?: string;
  end_time?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}

export interface EventStats {
  today_count: number;
  events_per_minute: number;
  csv_uploads_this_month: number;
  last_csv_upload: {
    filename: string;
    row_count: number;
  } | null;
  active_api_keys: number;
  sources: {
    api: number;
    csv: number;
    webhook: number;
  };
}

// ---------- API Keys ----------

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // full key, only on creation
}

export type ApiKeyScope = "ingest" | "read";

export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScope[];
  expires_at?: string;
}

// ---------- CSV Uploads ----------

export type CsvUploadStatus =
  | "uploaded"
  | "mapping"
  | "processing"
  | "completed"
  | "failed";

export interface CsvUpload {
  id: string;
  filename: string;
  file_size_bytes: number;
  row_count: number | null;
  status: CsvUploadStatus;
  success_count: number | null;
  error_count: number | null;
  error_summary: { row: number; error: string }[] | null;
  uploaded_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface CsvUploadResponse {
  id: string;
  filename: string;
  file_size_bytes: number;
  row_count: number | null;
  status: "uploaded";
  columns: string[];
  preview_rows: string[][];
  created_at: string;
}

export interface CsvColumnMapping {
  mapping: {
    timestamp: string;
    event_type: string; // column name or "_static:value"
    actor_id?: string;
    numeric_value?: string;
    properties: Record<string, string>; // target_key -> source_column
  };
}

// ---------- Dashboards ----------

export interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
  auto_refresh_seconds: number | null;
  layout: Record<string, unknown>;
  widgets: Widget[];
  created_by: {
    id: string;
    full_name: string;
  };
  updated_at: string;
  created_at: string;
}

export interface DashboardSummary {
  id: string;
  title: string;
  description: string | null;
  widget_count: number;
  is_default: boolean;
  auto_refresh_seconds: number | null;
  created_by: {
    id: string;
    full_name: string;
  };
  updated_at: string;
  created_at: string;
}

export interface CreateDashboardRequest {
  title: string;
  description?: string;
  is_default?: boolean;
  auto_refresh_seconds?: number;
}

export interface UpdateDashboardRequest {
  title?: string;
  description?: string;
  is_default?: boolean;
  auto_refresh_seconds?: number;
}

// ---------- Widgets ----------

export type WidgetType = "line" | "bar" | "pie" | "kpi" | "table";

export type AggregationType = "count" | "sum" | "avg" | "min" | "max";

export type TimeBucket = "minute" | "hour" | "day" | "week" | "month";

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "in";

export interface WidgetFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | string[];
}

export interface WidgetConfig {
  event_type: string;
  aggregation: AggregationType;
  time_bucket: TimeBucket;
  group_by: string | null;
  filters: WidgetFilter[];
}

export interface WidgetTimeRange {
  type: "relative" | "absolute";
  value?: string; // "1h", "6h", "24h", "7d", "30d"
  start?: string; // ISO for absolute
  end?: string;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  title: string;
  widget_type: WidgetType;
  config: WidgetConfig;
  time_range: WidgetTimeRange;
  position: WidgetPosition;
  created_at: string;
  updated_at: string;
}

export interface CreateWidgetRequest {
  title: string;
  widget_type: WidgetType;
  config: WidgetConfig;
  time_range: WidgetTimeRange;
  position: WidgetPosition;
}

export interface UpdateWidgetRequest {
  title?: string;
  config?: Partial<WidgetConfig>;
  time_range?: WidgetTimeRange;
  position?: WidgetPosition;
}

export interface LayoutUpdateRequest {
  layout: { widget_id: string; x: number; y: number; w: number; h: number }[];
}

// ---------- Widget Data Responses ----------

export interface WidgetDataResponse {
  widget_id: string;
  widget_type: WidgetType;
  data: LineChartData | BarChartData | PieChartData | KpiData | TableData;
  meta: WidgetDataMeta;
}

export interface WidgetDataMeta {
  total: number;
  time_range: { start: string; end: string };
  aggregation: AggregationType;
  time_bucket: TimeBucket;
}

export interface LineChartData {
  labels: string[];
  datasets: {
    label: string;
    values: number[];
  }[];
}

export interface BarChartData {
  labels: string[];
  datasets: {
    label: string;
    values: number[];
  }[];
}

export interface PieChartData {
  labels: string[];
  values: number[];
}

export interface KpiData {
  current_value: number;
  previous_value: number;
  change_percent: number;
  change_direction: "up" | "down" | "flat";
}

export interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

// ---------- Dashboard Sharing ----------

export interface DashboardShare {
  id: string;
  share_token: string;
  permission: "view" | "edit";
  expires_at: string | null;
}

export interface CreateShareRequest {
  shared_with_user_id?: string;
  permission: "view" | "edit";
  expires_at?: string;
}

// ---------- Alert Rules ----------

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertOperator = "gt" | "lt" | "eq" | "gte" | "lte";

export type NotificationChannel = "in_app" | "email" | "webhook";

export interface AlertCondition {
  event_type: string;
  metric: AggregationType;
  operator: AlertOperator;
  threshold: number;
  time_window_minutes: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  severity: AlertSeverity;
  is_enabled: boolean;
  is_muted: boolean;
  muted_until: string | null;
  condition: AlertCondition;
  cooldown_minutes: number;
  notification_channels: NotificationChannel[];
  email_recipients: string[];
  webhook_url: string | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRuleRequest {
  name: string;
  description?: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  cooldown_minutes?: number;
  notification_channels: NotificationChannel[];
  email_recipients?: string[];
  webhook_url?: string;
}

export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string;
  severity?: AlertSeverity;
  condition?: AlertCondition;
  cooldown_minutes?: number;
  notification_channels?: NotificationChannel[];
  email_recipients?: string[];
  webhook_url?: string;
}

export interface MuteAlertRequest {
  duration_minutes: number;
}

export interface ToggleAlertRequest {
  is_enabled: boolean;
}

// ---------- Alert Events (History) ----------

export type AlertEventStatus = "firing" | "acknowledged" | "resolved";

export interface AlertEvent {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: AlertSeverity;
  status: AlertEventStatus;
  triggered_value: number;
  threshold_value: number;
  operator: AlertOperator;
  fired_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
}

export interface AlertEventsQueryParams {
  status?: AlertEventStatus | "all";
  rule_id?: string;
  time_range?: "24h" | "7d" | "30d";
  limit?: number;
  offset?: number;
}

// ---------- WebSocket Messages ----------

export type WsMessageType =
  // Dashboard channel
  | "widget_data_update"
  | "subscribe_widgets"
  // Alert channel
  | "alert_fired"
  | "alert_resolved"
  // Events channel
  | "new_event"
  | "set_filters"
  // Common
  | "ping"
  | "pong"
  | "error";

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  timestamp: string;
}

// Specific WS payloads
export interface WsWidgetDataUpdate {
  widget_id: string;
  data: LineChartData | BarChartData | PieChartData | KpiData | TableData;
}

export interface WsSubscribeWidgets {
  widget_ids: string[];
}

export interface WsAlertFired {
  event_id: string;
  rule_id: string;
  rule_name: string;
  severity: AlertSeverity;
  triggered_value: number;
  threshold_value: number;
  fired_at: string;
}

export interface WsAlertResolved {
  event_id: string;
  rule_id: string;
  rule_name: string;
  resolved_at: string;
}

export interface WsNewEvent {
  id: string;
  event_type: string;
  event_name: string | null;
  actor_id: string | null;
  properties: Record<string, unknown>;
  numeric_value: number | null;
  source: EventSource;
  timestamp: string;
}

export interface WsSetFilters {
  event_types?: string[];
  sources?: EventSource[];
}

// ---------- Health ----------

export interface HealthResponse {
  status: "healthy";
}

export interface ReadyResponse {
  status: "ready";
  database: "connected" | "disconnected";
  redis: "connected" | "disconnected";
}
