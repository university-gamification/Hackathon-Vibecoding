export type Json = Record<string, any>;

const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'auth_email';

export class ApiError extends Error {
  status: number;
  url: string;
  body: string;
  constructor(message: string, status: number, url: string, body: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/**
 * Store or remove the authentication token in localStorage.
 *
 * @param token - The token to store under the auth key; if `null`, the stored token is removed
 */
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setEmail(email: string | null) {
  if (email) localStorage.setItem(EMAIL_KEY, email);
  else localStorage.removeItem(EMAIL_KEY);
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function logout() {
  setToken(null);
  setEmail(null);
}

/**
 * Send an HTTP request to the specified path and return the parsed JSON response.
 *
 * Adds a `Content-Type: application/json` header, automatically includes `Authorization: Bearer <token>` when a token is stored, and parses the response body as JSON.
 *
 * @param path - Request URL or path
 * @param options - Optional fetch RequestInit to customize the request
 * @returns The parsed JSON response object, or an empty object if the response has no body or cannot be parsed
 * @throws ApiError when the HTTP response status is not ok; the error carries `status`, `url`, and `body` (response text)
 */
export async function api(path: string, options?: RequestInit) {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };
  if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    ...options,
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status, path, text || '');
  }
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

export async function register(email: string, password: string) {
  return api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data?.access_token) setToken(data.access_token);
  if (email) setEmail(email);
  return data;
}

export async function listFiles() {
  return api('/api/files');
}

export async function uploadFiles(files: File[]) {
  const token = getToken();
  const form = new FormData();
  for (const f of files) form.append('files', f, f.name);
  const path = '/api/files/upload';
  const res = await fetch(path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(`Request failed (${res.status})`, res.status, path, text || '');
  }
  return res.json();
}

export async function buildRag() {
  return api('/api/rag/build', { method: 'POST' });
}

export async function assess(text: string) {
  return api('/api/rag/assess', { method: 'POST', body: JSON.stringify({ text }) });
}
