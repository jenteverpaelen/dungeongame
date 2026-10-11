// Accounts: a username and password (scrypt) with one-time recovery codes. Characters are linked to an account;
// character names stay unique per server. Nothing here knows about the simulation: the session consults the store
// before a character is loaded. Everything is plain files under DATA_DIR/accounts so backups and inspection stay easy.
//
// Threat model for v1 (a private or friends server): stolen or guessed passwords, enumeration of usernames,
// brute force, replay of an old session token, path tricks in usernames, and two registrations racing for a name.
// Out of scope until an independent review: email verification, passkeys, third-party sign-in.
//
// Sessions (2026-10-11): tokens are 32 random bytes; only their SHA-256 is kept, in memory and (unless
// ACCOUNT_SESSIONS=memory) in DATA_DIR/accounts/.sessions.json, so a restart keeps players signed in while a copy of
// that file cannot be replayed (a 256-bit random preimage is not guessable). The file is a dotfile, so the account
// loader and the aux backup (which only takes <username>.json) both skip it: sessions never come back from a backup.
//
// Lockout (2026-10-11): failures are counted per username+connection (5 in 15 min lock that pair), per account from
// all connections (50 in 15 min lock the account; NIST SP 800-63B §5.2.2 asks for a limit well before 100
// consecutive failures) and per connection (25 in 15 min). A stranger can no longer lock a player out with five guesses.

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
const PAIR_FAILURES = 5, PAIR_WINDOW_MS = 15 * 60_000, PAIR_LOCK_MS = 15 * 60_000;
const USER_FAILURES = 50, USER_WINDOW_MS = 15 * 60_000, USER_LOCK_MS = 15 * 60_000;
const REASK_FAILURES = 5, REASK_WINDOW_MS = 15 * 60_000, REASK_LOCK_MS = 15 * 60_000;
const IP_FAILURES = 25, IP_WINDOW_MS = 15 * 60_000, IP_LOCK_MS = 15 * 60_000;
const REGISTRATIONS_PER_IP = 5, REGISTRATION_WINDOW_MS = 3600_000;
const MAX_TRACKED_FAILURES = 5000;
const KDF = { N: 1 << 15, r: 8, p: 1, keylen: 64 } as const;
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'system', 'server', 'gm', 'moderator', 'mod', 'support', 'owner', 'null', 'undefined',
  'con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);
const GENERIC_LOGIN_ERROR = 'Wrong username or password.';
const SESSION_FILE = '.sessions.json';
const SESSION_WRITE_MS = 1000;
const MAX_EVENTS = 20;

/** What the account owner can see in "Devices & activity". Never an IP address or a full user agent. */
export type AccountEventKind = 'created' | 'login' | 'password' | 'recovery' | 'codes' | 'revoked' | 'export'
  | 'deletion-requested' | 'deletion-cancelled' | 'character-deletion' | 'character-restored' | 'admin-reset';
export interface AccountEvent { t: number; k: AccountEventKind; d?: string }
export interface SessionInfo { id: string; device: string; created: number; lastUsed: number; current: boolean }
interface SessionEntry { username: string; expires: number; created: number; lastUsed: number; device: string }

/** Coarse device label from a User-Agent ("Chrome on Windows"). Only this label is stored, never the header. */
export function deviceLabel(userAgent: unknown): string {
  if (typeof userAgent !== 'string' || !userAgent) return 'Unknown device';
  const ua = userAgent.slice(0, 512);
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

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
  /** Newest last, at most MAX_EVENTS. Optional: older records simply have no history. */
  events?: AccountEvent[];
}
export type AuthResult<T = object> = ({ ok: true } & T) | { ok: false; err: string };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** scrypt runs on libuv's four-thread pool, the same pool that writes character saves. A flood of login attempts
 *  must not be able to occupy all of it: at most `KDF_CONCURRENCY` hashes run at once, a bounded queue waits, and
 *  anything beyond that is refused with a retryable error. */
const KDF_CONCURRENCY = 2;
const KDF_QUEUE_MAX = 32;
export class AccountsBusyError extends Error {
  constructor() { super('The server is busy. Try again in a moment.'); }
}
const kdf = { active: 0, maxActive: 0, waiting: [] as (() => void)[] };
export const kdfStats = () => ({ active: kdf.active, maxActive: kdf.maxActive, queued: kdf.waiting.length });
async function withKdfSlot<T>(work: () => Promise<T>): Promise<T> {
  if (kdf.active < KDF_CONCURRENCY) kdf.active++;
  else {
    if (kdf.waiting.length >= KDF_QUEUE_MAX) throw new AccountsBusyError();
    await new Promise<void>((resolve) => kdf.waiting.push(resolve)); // the finishing hash hands its slot over
  }
  kdf.maxActive = Math.max(kdf.maxActive, kdf.active);
  try { return await work(); } finally {
    const next = kdf.waiting.shift();
    if (next) next(); else kdf.active--;
  }
}
const derive = (password: string, salt: Buffer, params: { N: number; r: number; p: number; keylen: number } = KDF) =>
  withKdfSlot(() => new Promise<Buffer>((resolve, reject) => nodeScrypt(password, salt, params.keylen,
    { N: params.N, r: params.r, p: params.p, maxmem: 128 * params.N * params.r * 2 }, (error, key) => (error ? reject(error) : resolve(key)))));

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
  private tokens = new Map<string, SessionEntry>();
  private failures = new Map<string, Failure>();
  private registrations = new Map<string, number[]>();
  private queues = new Map<string, Promise<unknown>>();
  private dummy: { salt: Buffer; hash: Buffer } | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private sessionWrites: Promise<void> = Promise.resolve();

  constructor(readonly dir = path.join(DATA_DIR, 'accounts'), private readonly now: () => number = Date.now,
    readonly persistSessions = process.env.ACCOUNT_SESSIONS !== 'memory') {}

  /** Loads every account file; unreadable or malformed ones are reported and skipped, never trusted. */
  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    this.accounts.clear();
    this.owners.clear();
    for (const file of await fs.readdir(this.dir)) {
      if (!file.endsWith('.json') || file.startsWith('.')) continue; // dotfiles are the session store, not accounts
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
    await this.loadSessions();
  }

  /** Waits for queued account writes and the pending session write (tests, shutdown). */
  async settled(): Promise<void> {
    await Promise.allSettled([...this.queues.values()]);
    await this.flushSessions();
  }
  async shutdown(): Promise<void> { await this.settled(); }

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
    if (username) {
      this.recordFailure(`p:${username}|${ip}`, PAIR_FAILURES, PAIR_WINDOW_MS, PAIR_LOCK_MS);
      this.recordFailure(`u:${username}`, USER_FAILURES, USER_WINDOW_MS, USER_LOCK_MS);
    }
    if (ip) this.recordFailure(`i:${ip}`, IP_FAILURES, IP_WINDOW_MS, IP_LOCK_MS);
  }
  private waitFor(username: string | null, ip: string): number {
    return Math.max(username ? this.blockedFor(`p:${username}|${ip}`, PAIR_WINDOW_MS) : 0,
      username ? this.blockedFor(`u:${username}`, USER_WINDOW_MS) : 0, ip ? this.blockedFor(`i:${ip}`, IP_WINDOW_MS) : 0);
  }
  private succeeded(username: string, ip: string): void { this.failures.delete(`p:${username}|${ip}`); }
  private forgetFailures(username: string): void {
    for (const key of [...this.failures.keys()]) if (key === `u:${username}` || key === `r:${username}` || key.startsWith(`p:${username}|`)) this.failures.delete(key);
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

  async register(rawUsername: unknown, password: unknown, ip = '', device = ''): Promise<AuthResult<{ username: string; recoveryCodes: string[] }>> {
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
      recovery: codes.map((c) => sha256(normaliseCode(c))), characters: [], events: [{ t, k: 'created', ...(device ? { d: device } : {}) }],
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

  async login(rawUsername: unknown, password: unknown, ip = '', device = ''): Promise<AuthResult<{ username: string }>> {
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
    this.succeeded(record.username, ip);
    void this.note(record.username, 'login', device);
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
    this.succeeded(record.username, ip);
    void this.note(record.username, 'recovery', `${done.record.recovery.length} code(s) left`);
    return { ok: true, username: record.username, remaining: done.record.recovery.length };
  }

  /** Operations that re-ask for the password count wrong answers like a login does, so a stolen session token cannot
   *  be used to guess the password online without limit. */
  async proveOwnPassword(username: string, password: unknown, message = 'Your password is not correct.'): Promise<AuthResult> {
    const key = `r:${username}`, wait = this.blockedFor(key, REASK_WINDOW_MS);
    if (wait > 0) return { ok: false, err: this.lockMessage(wait) };
    const record = this.accounts.get(username);
    if (!record || typeof password !== 'string' || password.length > PASSWORD_MAX || !(await this.verify(record, password))) {
      this.recordFailure(key, REASK_FAILURES, REASK_WINDOW_MS, REASK_LOCK_MS);
      return { ok: false, err: message };
    }
    this.failures.delete(key);
    return { ok: true };
  }

  async changePassword(username: string, current: unknown, next: unknown): Promise<AuthResult> {
    const proof = await this.proveOwnPassword(username, current, 'Your current password is not correct.');
    if (!proof.ok) return proof;
    const problem = this.passwordError(next, username);
    if (problem) return { ok: false, err: problem };
    const secret = await this.hashNew(next as string);
    const done = await this.mutate(username, (c) => ({ ...c, ...secret }));
    if (!done.ok) return done;
    this.revokeAll(username);
    void this.note(username, 'password');
    return { ok: true };
  }

  /** Replaces the whole set of recovery codes after proving the password; the old codes stop working. */
  async newRecoveryCodes(username: string, password: unknown): Promise<AuthResult<{ recoveryCodes: string[] }>> {
    const proof = await this.proveOwnPassword(username, password, 'Your password is not correct.');
    if (!proof.ok) return proof;
    const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
    const done = await this.mutate(username, (c) => ({ ...c, recovery: codes.map((x) => sha256(normaliseCode(x))) }));
    if (done.ok) void this.note(username, 'codes');
    return done.ok ? { ok: true, recoveryCodes: codes } : done;
  }

  /** Unused recovery codes left (shown so a player knows when to make new ones). */
  recoveryLeft(username: string): number { return this.accounts.get(username)?.recovery.length ?? 0; }
  events(username: string): AccountEvent[] { return [...(this.accounts.get(username)?.events ?? [])]; }

  /** Appends to the account's activity list; best effort (a failed write never fails the action it describes). */
  note(username: string, k: AccountEventKind, d = ''): Promise<void> {
    if (!this.accounts.has(username)) return Promise.resolve();
    const entry: AccountEvent = { t: this.now(), k, ...(d ? { d: d.slice(0, 60) } : {}) };
    return this.mutate(username, (c) => ({ ...c, events: [...(c.events ?? []), entry].slice(-MAX_EVENTS) }))
      .then(() => undefined, (error) => { console.error('[accounts] could not record activity:', error instanceof Error ? error.message : error); });
  }

  /** The account's own data for a GDPR export: everything but the secrets (password hash, salt, recovery hashes). */
  exportRecord(username: string): Record<string, unknown> | null {
    const r = this.accounts.get(username);
    if (!r) return null;
    return {
      username: r.username, createdAt: r.createdAt, characters: [...r.characters], recoveryCodesLeft: r.recovery.length,
      activity: [...(r.events ?? [])].map(e => ({ at: new Date(e.t).toISOString(), kind: e.k, ...(e.d ? { detail: e.d } : {}) })),
      sessions: this.sessionsOf(username).map(({ device, created, lastUsed }) => ({ device, created: new Date(created).toISOString(), lastUsed: new Date(lastUsed).toISOString() })),
      excluded: 'Password hash, salt and recovery-code hashes are secrets and are not exported. IP addresses are never stored.',
    };
  }

  /** Erases the account file, its sessions and its ownership index. Returns the characters it owned. Purge job only. */
  async remove(username: string): Promise<string[]> {
    const previous = this.queues.get(username) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(async () => {
      const record = this.accounts.get(username);
      if (!record) return [] as string[];
      await fs.rm(path.join(this.dir, `${username}.json`), { force: true });
      this.accounts.delete(username);
      for (const id of record.characters) if (this.owners.get(id) === username) this.owners.delete(id);
      this.revokeAll(username);
      this.forgetFailures(username);
      return [...record.characters];
    });
    this.queues.set(username, run);
    return run;
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
    this.forgetFailures(username);
    await this.note(username, 'admin-reset');
    return { ok: true, password, recoveryCodes: codes };
  }

  // ───────────── sessions ─────────────

  issueToken(username: string, device = ''): string {
    const token = randomBytes(32).toString('base64url');
    const mine = [...this.tokens.entries()].filter(([, v]) => v.username === username).sort((a, b) => a[1].expires - b[1].expires);
    while (mine.length >= MAX_TOKENS_PER_ACCOUNT) this.tokens.delete(mine.shift()![0]);
    const t = this.now();
    this.tokens.set(sha256(token), { username, expires: t + TOKEN_TTL_MS, created: t, lastUsed: t, device: device.slice(0, 40) || 'Unknown device' });
    this.scheduleSessionWrite();
    return token;
  }
  resume(token: unknown): string | null {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const key = sha256(token), entry = this.tokens.get(key);
    if (!entry) return null;
    if (entry.expires <= this.now() || !this.accounts.has(entry.username)) { this.tokens.delete(key); this.scheduleSessionWrite(); return null; }
    entry.expires = this.now() + TOKEN_TTL_MS;
    entry.lastUsed = this.now();
    this.scheduleSessionWrite();
    return entry.username;
  }
  revoke(token: unknown): void {
    if (typeof token === 'string' && this.tokens.delete(sha256(token))) this.scheduleSessionWrite();
  }
  revokeAll(username: string): void {
    let changed = false;
    for (const [key, v] of this.tokens) if (v.username === username) { this.tokens.delete(key); changed = true; }
    if (changed) this.scheduleSessionWrite();
  }
  /** The account's signed-in devices, newest use first. `id` is a short prefix of the token hash (not a secret). */
  sessionsOf(username: string, currentToken?: unknown): SessionInfo[] {
    const current = typeof currentToken === 'string' ? sha256(currentToken) : '';
    return [...this.tokens.entries()].filter(([, v]) => v.username === username && v.expires > this.now())
      .map(([key, v]) => ({ id: key.slice(0, 16), device: v.device, created: v.created, lastUsed: v.lastUsed, current: key === current }))
      .sort((a, b) => b.lastUsed - a.lastUsed);
  }
  /** Signs out one device (by id) or every device except the caller's (`'others'`). Returns how many ended. */
  revokeSession(username: string, id: unknown, currentToken?: unknown): number {
    const current = typeof currentToken === 'string' ? sha256(currentToken) : '';
    let n = 0;
    for (const [key, v] of this.tokens) {
      if (v.username !== username || key === current) continue;
      if (id === 'others' || (typeof id === 'string' && /^[a-f0-9]{16}$/.test(id) && key.startsWith(id))) { this.tokens.delete(key); n++; }
    }
    if (n) { this.scheduleSessionWrite(); void this.note(username, 'revoked', `${n} device(s)`); }
    return n;
  }

  private scheduleSessionWrite(): void {
    if (!this.persistSessions || this.sessionTimer) return;
    this.sessionTimer = setTimeout(() => { this.sessionTimer = null; void this.flushSessions(); }, SESSION_WRITE_MS);
    this.sessionTimer.unref?.();
  }
  /** Writes the hashed session list now (atomic temp + rename, in order). Never rejects. */
  flushSessions(): Promise<void> {
    if (!this.persistSessions) return this.sessionWrites;
    if (this.sessionTimer) { clearTimeout(this.sessionTimer); this.sessionTimer = null; }
    const t = this.now();
    const body = JSON.stringify({ version: 1, sessions: [...this.tokens.entries()].filter(([, v]) => v.expires > t)
      .map(([h, v]) => ({ h, u: v.username, c: v.created, l: v.lastUsed, e: v.expires, d: v.device })) });
    this.sessionWrites = this.sessionWrites.then(async () => {
      const file = path.join(this.dir, SESSION_FILE), tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
      try {
        await fs.mkdir(this.dir, { recursive: true });
        await fs.writeFile(tmp, body, { flush: true });
        await fs.rename(tmp, file);
      } catch (error) {
        await fs.rm(tmp, { force: true }).catch(() => undefined);
        console.error('[accounts] could not save sessions (players may need to log in again after a restart):', error instanceof Error ? error.message : error);
      }
    });
    return this.sessionWrites;
  }
  private async loadSessions(): Promise<void> {
    this.tokens.clear();
    if (!this.persistSessions) return;
    let raw: string;
    try { raw = await fs.readFile(path.join(this.dir, SESSION_FILE), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[accounts] could not read sessions:', (error as Error).message); return; }
    try {
      const data = JSON.parse(raw) as { version?: number; sessions?: unknown[] };
      if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('unsupported session file');
      const t = this.now(), perAccount = new Map<string, number>();
      for (const e of data.sessions as Record<string, unknown>[]) {
        const ok = !!e && typeof e.h === 'string' && /^[a-f0-9]{64}$/.test(e.h) && typeof e.u === 'string' && this.accounts.has(e.u)
          && [e.c, e.l, e.e].every(n => typeof n === 'number' && Number.isFinite(n)) && typeof e.d === 'string' && e.d.length <= 40;
        if (!ok || (e.e as number) <= t || (e.e as number) > t + TOKEN_TTL_MS) continue;
        const n = perAccount.get(e.u as string) ?? 0;
        if (n >= MAX_TOKENS_PER_ACCOUNT) continue;
        perAccount.set(e.u as string, n + 1);
        this.tokens.set(e.h as string, { username: e.u as string, created: e.c as number, lastUsed: e.l as number, expires: e.e as number, device: e.d as string });
      }
    } catch (error) {
      console.error('[accounts] ignored an unreadable session file; players log in again:', error instanceof Error ? error.message : error);
    }
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
