import { describe, it, expect } from 'vitest';
import { decodeJwt, getPrimaryRole, getRolesFromToken } from './auth';

// Helper to make a dummy JWT without a valid signature
function makeToken(payload: object): string {
  const header = { alg: 'none', typ: 'JWT' };
  const base64 = (obj: object) => btoa(JSON.stringify(obj));
  return `${base64(header)}.${base64(payload)}.`;
}

describe('auth helpers', () => {
  it('decodes JWT payloads safely', () => {
    const token = makeToken({ sub: '123', email: 'user@example.com', roles: ['viewer'] });
    const payload = decodeJwt(token);
    expect(payload?.email).toBe('user@example.com');
    expect(payload?.roles).toEqual(['viewer']);
  });

  it('extracts roles from stored token claims', () => {
    const token = makeToken({ roles: ['editor', 'viewer'] });
    localStorage.setItem('accessToken', token);
    expect(getRolesFromToken()).toEqual(['editor', 'viewer']);
  });

  it('selects highest-priority role as primary', () => {
    const token = makeToken({ roles: ['viewer', 'accountant', 'editor'] });
    localStorage.setItem('accessToken', token);
    // Priority order: admin > accountant > editor > viewer
    expect(getPrimaryRole()).toBe('accountant');
  });

  it('returns null when token is missing or malformed', () => {
    expect(decodeJwt('')).toBeNull();
    // Missing payload segment
    expect(decodeJwt('abc..def')).toBeNull();
  });
});