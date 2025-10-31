export type AuthResponse = {
  accessToken: string;
  user: { id: number; email: string; displayName?: string; roles: string[] };
  role: string;
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Login failed');
  }
  const data = (await res.json()) as AuthResponse;
  return data;
}

export function decodeJwt(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch { return null; }
}

export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function getRolesFromToken(): string[] {
  const t = getAccessToken();
  const p = t ? decodeJwt(t) : null;
  return Array.isArray(p?.roles) ? p.roles : [];
}

export function getPrimaryRole(): string {
  const roles = getRolesFromToken();
  const order: Record<string, number> = { admin: 4, accountant: 3, editor: 2, viewer: 1 };
  return roles.sort((a, b) => (order[b] || 0) - (order[a] || 0))[0] || 'viewer';
}