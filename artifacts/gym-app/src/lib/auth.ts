const TOKEN_KEY = "gymflow_token";
const USER_KEY = "gymflow_user";
const PA_TOKEN_KEY = "pa_token";
const PA_USER_KEY = "pa_user";
const IMPERSONATING_KEY = "admin_impersonating";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  gymId: number;
}

export interface PlatformAdminUser {
  id: number;
  email: string;
  name: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getPaToken(): string | null {
  return localStorage.getItem(PA_TOKEN_KEY);
}

export function getPaUser(): PlatformAdminUser | null {
  const raw = localStorage.getItem(PA_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setPaAuth(token: string, admin: PlatformAdminUser): void {
  localStorage.setItem(PA_TOKEN_KEY, token);
  localStorage.setItem(PA_USER_KEY, JSON.stringify(admin));
}

export function clearPaAuth(): void {
  localStorage.removeItem(PA_TOKEN_KEY);
  localStorage.removeItem(PA_USER_KEY);
}

export function setImpersonating(gymName: string): void {
  localStorage.setItem(IMPERSONATING_KEY, gymName);
}

export function getImpersonating(): string | null {
  return localStorage.getItem(IMPERSONATING_KEY);
}

export function clearImpersonating(): void {
  localStorage.removeItem(IMPERSONATING_KEY);
}
