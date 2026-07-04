export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (!init?.body) {
    delete headers['content-type'];
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    headers,
    ...init
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // response is not JSON, ignore
    }
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `API request failed: ${response.status}`;
    throw new ApiError(response.status, body, message);
  }

  return body as T;
}

export function fetchApi<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function postApi<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
}

export function putApi<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteApi<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE', body: undefined });
}
