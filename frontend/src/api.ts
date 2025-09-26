export type Json = Record<string, any>;

const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'auth_email';

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
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
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
  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function buildRag() {
  return api('/api/rag/build', { method: 'POST' });
}

export async function assess(text: string) {
  return api('/api/rag/assess', { method: 'POST', body: JSON.stringify({ text }) });
}
