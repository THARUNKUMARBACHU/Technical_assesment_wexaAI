import type { ApiError } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

// ---------- Token management ----------

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ---------- Fetch wrapper ----------

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  skipAuth?: boolean;
}

class ApiClientError extends Error {
  status: number;
  code: string;
  details: { field: string; message: string }[];

  constructor(status: number, error: ApiError["error"]) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = error.code;
    this.details = error.details ?? [];
  }
}

async function refreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem("refresh_token");
      return null;
    }

    const data = await res.json();
    setAccessToken(data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, params, skipAuth = false, ...init } = options;

  // Build URL with query params
  let url = `${API_BASE}${API_PREFIX}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (!skipAuth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Make request
  let res = await fetch(url, {
    ...init,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...init,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
    }
  }

  // Handle no-content responses
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiClientError(res.status, data.error ?? { code: "UNKNOWN", message: "Unknown error" });
  }

  return data as T;
}

// ---------- Convenience methods ----------

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    apiClient<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "POST", body }),

  patch: <T>(path: string, body?: unknown) =>
    apiClient<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string) =>
    apiClient<T>(path, { method: "DELETE" }),

  upload: <T>(path: string, file: File, fieldName = "file") => {
    const form = new FormData();
    form.append(fieldName, file);
    return apiClient<T>(path, { method: "POST", body: form });
  },
};

export { ApiClientError };
