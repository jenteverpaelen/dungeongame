// Account helpers for the login screens: the session token kept between visits, the same input rules the server
// enforces (server/src/accounts.ts) so mistakes are caught before a round trip, and the server's account mode.

import type { AccountMode } from '@shared/protocol';

const TOKEN_KEY = 'hearthfall.token';
const USER_KEY = 'hearthfall.user';

/** Mirrors server/src/accounts.ts. The server stays the authority; these only save a round trip. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function saveToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable: the player simply logs in again */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
/** Last account name typed, so the login form is prefilled. Never the password. */
export function lastUsername(): string {
  try { return localStorage.getItem(USER_KEY) ?? ''; } catch { return ''; }
}
export function rememberUsername(name: string): void {
  try { localStorage.setItem(USER_KEY, name); } catch { /* ignore */ }
}

/** Why a username or password cannot be sent, or null when it looks fine. */
export function usernameProblem(name: string): string | null {
  return USERNAME_RE.test(name.trim().toLowerCase()) ? null : 'Usernames are 3–20 letters, numbers or underscores.';
}
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

/** Reads the server's public config. Any failure (old server, offline) means "no accounts": name-only login as before. */
export async function fetchAccountMode(): Promise<AccountMode> {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (!r.ok) return 'off';
    const body = (await r.json()) as { accounts?: unknown };
    return body.accounts === 'optional' || body.accounts === 'required' ? body.accounts : 'off';
  } catch {
    return 'off';
  }
}
