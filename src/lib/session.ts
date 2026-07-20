// Lightweight signed-cookie session (HMAC-SHA256 via Web Crypto).
// Runs in both Node and Edge (middleware) runtimes — no Buffer, no extra deps.
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'session';
const encoder = new TextEncoder();

export type SessionPayload = { id: string; role: 'admin' | 'lecturer'; name: string };

function b64urlEncode(bytes: Uint8Array): string {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var is not set');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

// Verify a session token. Safe to call from middleware (edge runtime).
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const key = await getKey();
    const sigBytes = b64urlDecode(sig);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes.slice().buffer, encoder.encode(body));
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
}

// Server Component / Server Action only (uses next/headers cookies()).
export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
