/**
 * Query Key Factory
 *
 * Centralized query key definitions for TanStack Query.
 * Ensures consistent cache keys across the app.
 *
 * Pattern: [module, scope, ...params]
 */

export const queryKeys = {
  // ---- Auth ----
  auth: {
    me: () => ["auth", "me"] as const,
    orgs: () => ["auth", "orgs"] as const,
  },

  // ---- Organizations ----
  orgs: {
    list: () => ["orgs", "list"] as const,
    detail: (orgId: string) => ["orgs", "detail", orgId] as const,
    members: (orgId: string) => ["orgs", "members", orgId] as const,
    invitations: (orgId: string) => ["orgs", "invitations", orgId] as const,
  },

  // ---- Events ----
  events: {
    list: (params?: Record<string, unknown>) =>
      ["events", "list", params ?? {}] as const,
    stats: () => ["events", "stats"] as const,
  },

  // ---- API Keys ----
  apiKeys: {
    list: () => ["api-keys", "list"] as const,
  },

  // ---- CSV Uploads ----
  csvUploads: {
    list: () => ["csv-uploads", "list"] as const,
    detail: (uploadId: string) => ["csv-uploads", "detail", uploadId] as const,
  },

  // ---- Dashboards ----
  dashboards: {
    list: (filter?: string) => ["dashboards", "list", filter ?? "all"] as const,
    detail: (dashboardId: string) =>
      ["dashboards", "detail", dashboardId] as const,
  },

  // ---- Widgets ----
  widgets: {
    data: (dashboardId: string, widgetId: string, timeRange?: string) =>
      ["widgets", "data", dashboardId, widgetId, timeRange ?? "default"] as const,
  },

  // ---- Alert Rules ----
  alerts: {
    rules: (status?: string) => ["alerts", "rules", status ?? "all"] as const,
    ruleDetail: (ruleId: string) =>
      ["alerts", "rules", "detail", ruleId] as const,
    events: (params?: Record<string, unknown>) =>
      ["alerts", "events", params ?? {}] as const,
  },
} as const;
