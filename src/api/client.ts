import type { ErrorResponse, PaginatedResponse } from './types';
import { authEnabled, getToken } from '../auth/keycloak';
import { getEnv } from '../env';

const BASE_URL = getEnv('VITE_API_BASE_URL');

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ErrorResponse,
  ) {
    super(body.message);
  }
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const raw = `${BASE_URL}/v1/insights${path}`;
  const url = BASE_URL ? new URL(raw) : new URL(raw, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authEnabled) {
    // Live Keycloak access token (kept fresh by initAuth's refresh loop). VITE_AUTH_TOKEN is a
    // static fallback for local testing without a login.
    const token = getToken() || getEnv('VITE_AUTH_TOKEN');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const raw = await res.json().catch(() => ({
      code: 'UNKNOWN',
      message: `HTTP ${res.status}`,
    }));
    // API wraps errors as { error: { code, message } }
    const body = raw.error ?? raw;
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), { headers: authHeaders() });
  const json = await handleResponse(res);
  return json.data !== undefined ? json.data : json;
}

export async function apiGetPaginated<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<PaginatedResponse<T>> {
  const res = await fetch(buildUrl(path, params), { headers: authHeaders() });
  const json = await handleResponse(res);
  const p = json.pagination;
  return {
    data: json.data,
    pagination: p
      ? {
          limit: p.limit ?? 50,
          next_cursor: p.next_cursor ?? p.nextCursor ?? null,
          has_more: p.has_more ?? p.hasMore ?? false,
          total_count: p.total_count ?? p.totalCount ?? undefined,
        }
      : { limit: 50, next_cursor: null, has_more: false },
  };
}

export { buildUrl };
