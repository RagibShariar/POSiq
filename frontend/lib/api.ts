// Thin fetch wrapper for the Express API. All requests go through here so
// auth headers and the standard { success, data, error } envelope are handled
// in one place.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export interface ApiErrorBody {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(public status: number, public error: ApiErrorBody) {
    super(error.message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new ApiRequestError(res.status, body.error ?? {
      code: "UNKNOWN",
      message: "Request failed",
    });
  }
  return body.data as T;
}
