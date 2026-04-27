import type {
  AnalyticsField,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  CurrentUser,
  DetailQueryRequest,
  FieldValuesResponse,
  LoginResponse,
  RatingRow,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      typeof errorPayload?.detail === "string"
        ? errorPayload.detail
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function login(loginValue: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginValue, password }),
  });
}

export function getMe(token: string): Promise<CurrentUser> {
  return request<CurrentUser>("/auth/me", {}, token);
}

export function getAnalyticsFields(token: string): Promise<AnalyticsField[]> {
  return request<AnalyticsField[]>("/analytics/fields", {}, token);
}

export function getFieldValues(
  token: string,
  fieldId: string,
): Promise<FieldValuesResponse> {
  return request<FieldValuesResponse>(
    `/analytics/fields/${encodeURIComponent(fieldId)}/values`,
    {},
    token,
  );
}

export function runAnalyticsQuery(
  token: string,
  payload: AnalyticsQueryRequest,
): Promise<AnalyticsQueryResponse> {
  return request<AnalyticsQueryResponse>(
    "/analytics/summary",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function runDetailQuery(
  token: string,
  payload: DetailQueryRequest,
): Promise<AnalyticsQueryResponse> {
  return request<AnalyticsQueryResponse>(
    "/analytics/detail",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function exportAnalyticsQuery(
  token: string,
  payload: AnalyticsQueryRequest,
): Promise<Blob> {
  return requestBlob(
    "/analytics/summary/export/xlsx",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function exportDetailQuery(
  token: string,
  payload: DetailQueryRequest,
): Promise<Blob> {
  return requestBlob(
    "/analytics/detail/export/xlsx",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function getRating(token: string): Promise<{ rows: RatingRow[] }> {
  return request<{ rows: RatingRow[] }>(
    "/analytics/rating",
    {
      method: "POST",
      body: JSON.stringify({ limit: 100 }),
    },
    token,
  );
}

export function exportRating(token: string): Promise<Blob> {
  return requestBlob(
    "/analytics/rating/export/xlsx",
    {
      method: "POST",
      body: JSON.stringify({ limit: 100 }),
    },
    token,
  );
}

async function requestBlob(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      typeof errorPayload?.detail === "string"
        ? errorPayload.detail
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.blob();
}
