// API client for the Express backend. Handles the { success, data, error }
// envelope, attaches the access token, and transparently refreshes it once
// on 401 before giving up.

import type { ListMeta } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

const ACCESS_KEY = "smartpos.accessToken";
const REFRESH_KEY = "smartpos.refreshToken";

export interface ApiErrorBody {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(public status: number, public error: ApiErrorBody) {
    super(error.message);
    this.name = "ApiRequestError";
  }
}

export const tokenStore = {
  get access() {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: ListMeta;
  error?: ApiErrorBody;
}

async function rawRequest<T>(path: string, init: RequestInit): Promise<Envelope<T>> {
  const res = await fetch(`${API_URL}${path}`, init);
  let body: Envelope<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiRequestError(res.status, {
      code: "BAD_RESPONSE",
      message: `Unexpected response from server (${res.status})`,
    });
  }
  if (!res.ok || !body.success) {
    throw new ApiRequestError(res.status, body.error ?? { code: "UNKNOWN", message: "Request failed" });
  }
  return body;
}

// Single-flight refresh so concurrent 401s trigger only one refresh call.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = tokenStore.refresh;
      if (!refresh) return false;
      try {
        const body = await rawRequest<{ accessToken: string; refreshToken: string }>(
          "/auth/refresh",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: refresh }),
          }
        );
        tokenStore.set(body.data.accessToken, body.data.refreshToken);
        return true;
      } catch {
        tokenStore.clear();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export interface ApiResult<T> {
  data: T;
  meta?: ListMeta;
  message?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const envelope = await rawRequest<T>(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { data: envelope.data, meta: envelope.meta, message: envelope.message };
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401 && !retried && tokenStore.refresh) {
      if (await tryRefresh()) {
        return request<T>(method, path, body, true);
      }
      // Refresh failed — force re-login
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    throw e;
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
