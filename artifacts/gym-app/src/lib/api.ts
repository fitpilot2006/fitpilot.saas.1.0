import { getToken, getPaToken } from "./auth.js";

const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}, usePA = false): Promise<T> {
  const token = usePA ? getPaToken() : getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, usePA = false) => request<T>(path, { method: "GET" }, usePA),
  post: <T>(path: string, body: unknown, usePA = false) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, usePA),
  patch: <T>(path: string, body: unknown, usePA = false) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, usePA),
  put: <T>(path: string, body: unknown, usePA = false) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, usePA),
  delete: <T>(path: string, usePA = false) => request<T>(path, { method: "DELETE" }, usePA),
};
