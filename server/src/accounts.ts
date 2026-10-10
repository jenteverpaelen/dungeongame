// Accounts: a username and password (scrypt) with one-time recovery codes. Characters are linked to an account;
// character names stay unique per server. Nothing here knows about the simulation: the session consults the store
// before a character is loaded. Everything is plain files under DATA_DIR/accounts so backups and inspection stay easy.
//
// Threat model for v1 (a private or friends server): stolen or guessed passwords, enumeration of usernames,
// brute force, replay of an old session token, path tricks in usernames, and two registrations racing for a name.
// Out of scope until an independent review: email verification, device management, passkeys, third-party sign-in.

import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const RECOVERY_CODES = 8;
export const MAX_CHARACTERS_PER_ACCOUNT = 10;
const TOKEN_TTL_MS = 30 * 24 * 3600_000;
const MAX_TOKENS_PER_ACCOUNT = 5;
const USER_FAILURES = 5, USER_WINDOW_MS = 15 * 60_000, USER_LOCK_MS = 15 * 60_000;
const IP_FAILURES = 25, IP_WINDOW_MS = 15 * 60_000, IP_LOCK_MS = 15 * 60_000;
const REGISTRATIONS_PER_IP = 5, REGISTRATION_WINDOW_MS = 3600_000;
const MAX_TRACKED_FAILURES = 5000;
const KDF = { N: 1 << 15, r: 8, p: 1, keylen: 64 } as const;
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'system', 'server', 'gm', 'moderator', 'mod', 'support', 'owner', 'null', 'undefined',
  'con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);
const GENERIC_LOGIN_ERROR = 'Wrong username or password.';

export interface AccountRecord {
  version: 1;
  username: string;
  createdAt: string;
  kdf: { N: number; r: number; p: number; keylen: number };
  salt: string;
  hash: string;
  /** SHA-256 of each unused recovery code (normalised); a used code is removed. */
  recovery: string[];
  characters: string[];
}
export type AuthResult<T = object> = ({ ok: true } & T) | { ok: false; err: string };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = (password: string, salt: Buffer, kdf: { N: number; r: number; p: number; keylen: number } = KDF) =>
  new Promise<Buffer>((resolve, reject) => nodeScrypt(password, salt, kdf.keylen,
    { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 128 * kdf.N * kdf.r * 2 }, (error, key) => (error ? reject(error) : resolve(key))));

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRecoveryCode(): string {
  let code = '';
  for (const byte of randomBytes(12)) code += BASE32[byte % BASE32.length];
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}
const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

interface Failure { count: number; first: number; lockedUntil: number }

export class AccountStore {
  private accounts = new Map<string, AccountRecord>();
  private owners = new Map<string, string>();
  private tokens = new Map<string, { username: string; expires: number }>();
  private failures = new Map<string, Failure>();
  private registrations = new Map<string, number[]>();
  private queues = new Map<string, Promise<unknown>>();
  private dummy: { salt: Buffer; hash: Buffer } | null = null;

  constructor(readonly dir = path.join(DATA_DIR, 'accounts'), private readonly now: () => number = Date.now) {}

  /** Loads every account file; unreadable or malformed ones are reported and skipped, never trusted. */
  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    this.accounts.clear();
    this.owners.clear();
    for (const file of await fs.readdir(this.dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const record = JSON.parse(await fs.readFile(path.join(this.dir, file), 'utf8')) as AccountRecord;
        if (!this.validRecord(record) || `${record.username}.json` !== file) throw new Error('invalid record');
        this.accounts.set(record.username, record);
        for (const id of record.characters) this.owners.set(id, record.username);
      } catch (error) {
        console.error(`[accounts] skipped ${file}:`, error instanceof Error ? error.message : error);
      }
    }
    const salt = randomBytes(16);
    this.dummy = { salt, hash: await derive('hearthfall-dummy-password', salt) };
  }

  private validRecord(r: AccountRecord): boolean {
    return !!r && r.version === 1 && typeof r.username === 'string' && USERNAME_RE.test(r.username)
      && typeof r.salt === 'string' && typeof r.hash === 'string' && Array.isArray(r.recovery) && Array.isArray(r.characters)
      && !!r.kdf && r.kdf.N === KDF.N && r.kdf.r === KDF.r && r.kdf.p === KDF.p && r.kdf.keylen === KDF.keylen;
  }

  // ───────────── helpers ─────────────

  normaliseUsername(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const name = raw.trim().toLowerCase();
    return USERNAME_RE.test(name) && !RESERVED.has(name) ? name : null;
  }
  passwordError(password: unknown, username = ''): string | null {
    if (typeof password !== 'string') return 'Enter a password.';
    if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
    if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
    if (new Set(password).size < 4) return 'Use a password with more variety.';
    if (username && password.toLowerCase().includes(username)) return 'Do not include your username in your password.';
    return null;
  }

  private async write(record: AccountRecord): Promise<void> {
    const file = path.join(this.dir, `${record.username}.json`);
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(record), { flush: true });
      await fs.rename(tmp, file);
    } catch (error) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  /** Read-modify-write one account behind a per-account queue, so two sessions can never lose each other's update. */
  private mutate(username: string, change: (current: AccountRecord) => AccountRecord | string): Promise<AuthResult<{ record: AccountRecord }>> {
    const previous = this.queues.get(username) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(async (): Promise<AuthResult<{ record: AccountRecord }>> => {
      const current = this.accounts.get(username);
      if (!current) return { ok: false, err: 'Unknown account.' };
      const next = change(current);
      if (typeof next === 'string') return { ok: false, err: next };
      await this.write(next);
      this.accounts.set(username, next);
      return { ok: true, record: next };
    });
    this.queues.set(username, run);
    return run;
  }

  private blockedFor(key: string, windowMs: number): number {
    const f = this.failures.get(key), t = this.now();
    if (!f) return 0;
    if (f.lockedUntil > t) return f.lockedUntil - t;
    if (t - f.first > windowMs) this.failures.delete(key);
    return 0;
  }
  private recordFailure(key: string, limit: number, windowMs: number, lockMs: number): void {
    const t = this.now();
    if (this.failures.size > MAX_TRACKED_FAILURES) {
      for (const [k, f] of this.failures) if (f.lockedUntil <= t && t - f.first > windowMs) this.failures.delete(k);
    }
    let f = this.failures.get(key);
    if (!f || t - f.first > windowMs) f = { count: 0, first: t, lockedUntil: 0 };
    f.count++;
    if (f.count >= limit) f.lockedUntil = t + lockMs;
    this.failures.set(key, f);
  }
  private lockMessage(ms: number): string {
    return `Too many attempts. Try again in ${Math.max(1, Math.ceil(ms / 60_000))} minute(s).`;
  }
  private failBoth(username: string | null, ip: string): void {
    if (username) this.recordFailure(`u:${username}`, USER_FAILURES, USER_WINDOW_MS, USER_LOCK_MS);
    if (ip) this.recordFailure(`i:${ip}`, IP_FAILURES, IP_WINDOW_MS, IP_LOCK_MS);
  }
  private waitFor(username: string | null, ip: string): number {
    return Math.max(username ? this.blockedFor(`u:${username}`, USER_WINDOW_MS) : 0, ip ? this.blockedFor(`i:${ip}`, IP_WINDOW_MS) : 0);
  }

  /** Compares against a real hash even when the user is unknown, so timing does not reveal which usernames exist. */
  private async verify(record: AccountRecord | undefined, password: string): Promise<boolean> {
    if (!record) {
      const d = this.dummy ?? { salt: Buffer.alloc(16), hash: Buffer.alloc(KDF.keylen) };
      timingSafeEqual(d.hash, await derive(password, d.salt));
      return false;
    }
    const expected = Buffer.from(record.hash, 'base64');
    const actual = await derive(password, Buffer.from(record.salt, 'base64'), record.kdf);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private async hashNew(password: string): Promise<{ salt: string; hash: string }> {
    const salt = randomBytes(16);
    return { salt: salt.toString('base64'), hash: (await derive(password, salt)).toString('base64') };
  }

  // ───────────── registration, login, recovery ─────────────

  async register(rawUsername: unknown, password: unknown, ip = ''): Promise<AuthResult<{ username: string; recoveryCodes: string[] }>> {
    const t = this.now();
    const recent = (this.registrations.get(ip) ?? []).filter((x) => t - x < REGISTRATION_WINDOW_MS);
    if (ip && recent.length >= REGISTRATIONS_PER_IP) return { ok: false, err: 'Too many registrations from this connection. Try again later.' };
    const username = this.normaliseUsername(rawUsername);
    if (!username) return { ok: false, err: 'Usernames are 3–20 letters, numbers or underscores.' };
    const problem = this.passwordError(password, username);
    if (problem) return { ok: false, err: problem };
    if (this.accounts.has(username)) return { ok: false, err: 'That username is taken.' };
    const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
    const secret = await this.hashNew(password as string);
    const record: AccountRecord = {
      version: 1, username, createdAt: new Date(t).toISOString(), kdf: { ...KDF }, ...secret,
      recovery: codes.map((c) => sha256(normaliseCode(c))), characters: [],
    };
    // Exclusive create: two racing registrations cannot both win, even across processes.
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(path.join(this.dir, `${username}.json`), JSON.stringify(record), { flag: 'wx', flush: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return { ok: false, err: 'That username is taken.' };
      throw error;
    }
    this.accounts.set(username, record);
    if (ip) this.registrations.set(ip, [...recent, t]);
    return { ok: true, username, recoveryCodes: codes };
  }

  async login(rawUsername: unknown, password: unknown, ip = ''): Promise<AuthResult<{ username: string }>> {
    const username = this.normaliseUsername(rawUsername);
    const wait = this.waitFor(username, ip);
    if (wait > 0) return { ok: false, err: this.lockMessage(wait) };
    if (typeof password !== 'string' || password.length > PASSWORD_MAX) return { ok: false, err: GENERIC_LOGIN_ERROR };
    const record = username ? this.accounts.get(username) : undefined;
    const good = await this.verify(record, password);
    if (!good || !record) {
      this.failBoth(username, ip);
      return { ok: false, err: GENERIC_LOGIN_ERROR };
    }
    this.failures.delete(`u:${record.username}`);
    return { ok: true, username: record.username };
  }

  async recover(rawUsername: unknown, code: unknown, newPassword: unknown, ip = ''): Promise<AuthResult<{ username: string; remaining: number }>> {
    const username = this.normaliseUsername(rawUsername);
    const wait = this.waitFor(username, ip);
    if (wait > 0) return { ok: false, err: this.lockMessage(wait) };
    await this.verify(undefined, 'timing-equaliser'); // same cost whether or not the account or code exists
    const record = username ? this.accounts.get(username) : undefined;
    const digest = typeof code === 'string' ? sha256(normaliseCode(code)) : '';
    const invalid = (): AuthResult<{ username: string; remaining: number }> => {
      this.failBoth(username, ip);
      return { ok: false, err: 'That username or recovery code is not valid.' };
    };
    if (!record || !digest || !record.recovery.includes(digest)) return invalid();
    const problem = this.passwordError(newPassword, record.username);
    if (problem) return { ok: false, err: problem };
    const secret = await this.hashNew(newPassword as string);
    const done = await this.mutate(record.username, (current) => {
      if (!current.recovery.includes(digest)) return 'That username or recovery code is not valid.';
      return { ...current, ...secret, recovery: current.recovery.filter((d) => d !== digest) };
    });
    if (!done.ok) return invalid();
    this.revokeAll(record.username);
    this.failures.delete(`u:${record.username}`);
    return { ok: true, username: record.username, remaining: done.record.recovery.length };
  }

  async changePassword(username: string, current: unknown, next: unknown): Promise<AuthResult> {
    const record = this.accounts.get(username);
    if (!record || typeof current !== 'string' || current.length > PASSWORD_MAX || !(await this.verify(record, current))) {
      return { ok: false, err: 'Your current password is not correct.' };
    }
    const problem = this.passwordError(next, username);
    if (problem) return { ok: false, err: problem };
    const secret = await this.hashNew(next as string);
    const done = await this.mutate(username, (c) => ({ ...c, ...secret }));
    if (!done.ok) return done;
    this.revokeAll(username);
    return { ok: true };
  }

  /** Replaces the whole set of recovery codes after proving the password; the old codes stop working. */
  async newRecoveryCodes(username: string, password: unknown): Promise<AuthResult<{ recoveryCodes: string[] }>> {
    const record = this.accounts.get(username);
    if (!record || typeof password !== 'string' || password.length > PASSWORD_MAX || !(await this.verify(record, password))) {
      return { ok: false, err: 'Your password is not correct.' };
    }
    const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
    const done = await this.mutate(username, (c) => ({ ...c, recovery: codes.map((x) => sha256(normaliseCode(x))) }));
    return done.ok ? { ok: true, recoveryCodes: codes } : done;
  }

  // ───────────── operator tools (used by scripts/accounts-admin.ts, never by the network) ─────────────

  /** Sets a fresh random password and a fresh set of recovery codes, revoking every session. Shown once. */
  async adminReset(username: string): Promise<AuthResult<{ password: string; recoveryCodes: string[] }>> {
    const password = randomBytes(12).toString('base64url');
    const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
    const secret = await this.hashNew(password);
    const done = await this.mutate(username, (c) => ({ ...c, ...secret, recovery: codes.map((x) => sha256(normaliseCode(x))) }));
    if (!done.ok) return done;
    this.revokeAll(username);
    this.failures.delete(`u:${username}`);
    return { ok: true, password, recoveryCodes: codes };
  }

  // ───────────── sessions ─────────────

  issueToken(username: string): string {
    const token = randomBytes(32).toString('base64url');
    const mine = [...this.tokens.entries()].filter(([, v]) => v.username === username).sort((a, b) => a[1].expires - b[1].expires);
    while (mine.length >= MAX_TOKENS_PER_ACCOUNT) this.tokens.delete(mine.shift()![0]);
    this.tokens.set(sha256(token), { username, expires: this.now() + TOKEN_TTL_MS });
    return token;
  }
  resume(token: unknown): string | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const key = sha256(token), entry = this.tokens.get(key);
    if (!entry) return null;
    if (entry.expires <= this.now() || !this.accounts.has(entry.username)) { this.tokens.delete(key); return null; }
    entry.expires = this.now() + TOKEN_TTL_MS;
    return entry.username;
  }
  revoke(token: unknown): void {
    if (typeof token === 'string') this.tokens.delete(sha256(token));
  }
  revokeAll(username: string): void {
    for (const [key, v] of this.tokens) if (v.username === username) this.tokens.delete(key);
  }

  // ───────────── character ownership ─────────────

  has(username: string): boolean { return this.accounts.has(username); }
  ownerOf(characterId: string): string | undefined { return this.owners.get(characterId); }
  charactersOf(username: string): string[] { return [...(this.accounts.get(username)?.characters ?? [])]; }
  usernames(): string[] { return [...this.accounts.keys()].sort(); }

  async link(username: string, characterId: string, max = MAX_CHARACTERS_PER_ACCOUNT): Promise<AuthResult> {
    // The ownership index is claimed synchronously inside the callback, so two accounts racing for one character
    // (they run in different per-account queues) can never both win. A failed write releases the claim.
    let claimed = false;
    try {
      const done = await this.mutate(username, (record) => {
        const owner = this.owners.get(characterId);
        if (owner === username) return record;
        if (owner) return 'That character belongs to another account.';
        if (record.characters.length >= max) return `An account can hold ${max} characters.`;
        this.owners.set(characterId, username);
        claimed = true;
        return { ...record, characters: [...record.characters, characterId] };
      });
      return done.ok ? { ok: true } : done;
    } catch (error) {
      if (claimed && this.owners.get(characterId) === username) this.owners.delete(characterId);
      throw error;
    }
  }
  async unlink(username: string, characterId: string): Promise<AuthResult> {
    const done = await this.mutate(username, (record) => {
      if (this.owners.get(characterId) !== username) return 'That character is not linked to this account.';
      return { ...record, characters: record.characters.filter((c) => c !== characterId) };
    });
    if (done.ok) this.owners.delete(characterId);
    return done.ok ? { ok: true } : done;
  }
}
