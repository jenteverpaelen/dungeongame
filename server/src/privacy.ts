// Data-subject rights for accounts and characters (roadmap F-ACC-06, GDPR Art. 15/17/20): scheduled deletions with a
// grace period, the purge that carries them out, an erasure ledger that re-applies them after a backup restore, and
// the machine-readable export.
//
// Ledger file: DATA_DIR/privacy/ledger.json — pending deletions plus SHA-256 digests of every erased account/character
// id (no names in clear text). It is deliberately outside the character backups: restoring an old backup must not
// bring an erased person back, so at startup the server erases any restored file whose digest is in the ledger.
// The aux backup also copies the ledger, so a lost disk does not lose the list of erasures.
//
// Grace period: DELETION_GRACE_DAYS (default 14, allowed 0–30). GDPR Art. 12(3) asks for an answer within one month;
// 14 days of grace + an hourly purge + a backup retention of up to 14 days (docs/rework/partials/BACKUP-RUNBOOK.md)
// stays inside it. 14 days is also the cancellation window some large game publishers use for account deletion [K].

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config';

export type ErasureKind = 'account' | 'character';
export interface PendingErasure {
  kind: ErasureKind; id: string; requestedAt: number; purgeAt: number; by: 'player' | 'owner';
  /** For a character: the account that asked (absent for an owner action on an unowned character). */
  account?: string;
}
interface ErasedEntry { h: string; kind: ErasureKind; at: number }
interface Ledger { version: 1; pending: PendingErasure[]; erased: ErasedEntry[] }

const DAY = 86_400_000;
export function parseGraceDays(value: string | undefined): number {
  if (value === undefined || value === '') return 14;
  if (!/^(0|[1-9][0-9]?)$/.test(value) || Number(value) > 30) throw new Error('DELETION_GRACE_DAYS must be an integer from 0 to 30');
  return Number(value);
}
export const DELETION_GRACE_DAYS = parseGraceDays(process.env.DELETION_GRACE_DAYS);
export const erasureDigest = (kind: ErasureKind, id: string) => createHash('sha256').update(`hearthfall-erasure-v1:${kind}:${id}`).digest('hex');
const ID_RE: Record<ErasureKind, RegExp> = { account: /^[a-z0-9_]{3,20}$/, character: /^[a-z0-9]{2,16}$/ };

function valid(ledger: unknown): ledger is Ledger {
  const l = ledger as Ledger | null;
  return !!l && l.version === 1 && Array.isArray(l.pending) && Array.isArray(l.erased)
    && l.pending.every(p => !!p && (p.kind === 'account' || p.kind === 'character') && ID_RE[p.kind].test(p.id)
      && Number.isSafeInteger(p.requestedAt) && Number.isSafeInteger(p.purgeAt) && (p.by === 'player' || p.by === 'owner')
      && (p.account === undefined || ID_RE.account.test(p.account)))
    && l.erased.every(e => !!e && /^[a-f0-9]{64}$/.test(e.h) && (e.kind === 'account' || e.kind === 'character') && Number.isSafeInteger(e.at));
}

export class PrivacyLedger {
  private state: Ledger = { version: 1, pending: [], erased: [] };
  private digests = new Set<string>();
  private tail: Promise<unknown> = Promise.resolve();
  readonly file: string;

  constructor(readonly dir = path.join(DATA_DIR, 'privacy'), private readonly now: () => number = Date.now,
    readonly graceMs = DELETION_GRACE_DAYS * DAY) { this.file = path.join(dir, 'ledger.json'); }

  /** Reads the ledger if there is one; the directory is only created by the first write. */
  async init(): Promise<void> { await this.refresh(); }

  /** Re-reads the file (the owner tool may have changed it). An unreadable ledger is a hard error: erasures must not be forgotten. */
  async refresh(): Promise<void> {
    let raw: string;
    try { raw = await fs.readFile(this.file, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    const parsed = JSON.parse(raw);
    if (!valid(parsed)) throw new Error(`Privacy ledger ${this.file} is invalid; fix or restore it before starting (erasures must not be lost)`);
    this.state = parsed;
    this.digests = new Set(parsed.erased.map(e => e.h));
  }

  /** Read-modify-write from disk, serialised, so a concurrent owner tool and the server do not drop each other's change. */
  private mutate<T>(change: (l: Ledger) => T): Promise<T> {
    const run = this.tail.catch(() => undefined).then(async () => {
      await this.refresh();
      const next = structuredClone(this.state);
      const result = change(next);
      const tmp = `${this.file}.${randomBytes(6).toString('hex')}.tmp`;
      try {
        await fs.mkdir(this.dir, { recursive: true });
        await fs.writeFile(tmp, JSON.stringify(next), { flush: true });
        await fs.rename(tmp, this.file);
      } catch (error) { await fs.rm(tmp, { force: true }).catch(() => undefined); throw error; }
      this.state = next;
      this.digests = new Set(next.erased.map(e => e.h));
      return result;
    });
    this.tail = run;
    return run;
  }

  pending(kind: ErasureKind, id: string): PendingErasure | undefined { return this.state.pending.find(p => p.kind === kind && p.id === id); }
  /** The account's own pending deletion and those of its characters. */
  pendingFor(username: string): PendingErasure[] {
    return this.state.pending.filter(p => (p.kind === 'account' && p.id === username) || (p.kind === 'character' && p.account === username));
  }
  allPending(): PendingErasure[] { return this.state.pending.map(p => ({ ...p })); }
  erasedCount(): number { return this.state.erased.length; }
  isErased(kind: ErasureKind, id: string): boolean { return this.digests.has(erasureDigest(kind, id)); }
  /** When this id was erased (undefined when it never was). */
  erasedAt(kind: ErasureKind, id: string): number | undefined {
    if (!this.isErased(kind, id)) return undefined;
    const h = erasureDigest(kind, id);
    return this.state.erased.find(e => e.h === h)?.at;
  }

  /** Idempotent: an existing request keeps its original dates. */
  schedule(kind: ErasureKind, id: string, opts: { account?: string; by?: 'player' | 'owner'; graceMs?: number } = {}): Promise<PendingErasure> {
    if (!ID_RE[kind].test(id)) return Promise.reject(new Error(`invalid ${kind} id`));
    return this.mutate(l => {
      const existing = l.pending.find(p => p.kind === kind && p.id === id);
      if (existing) return { ...existing };
      const t = this.now();
      const entry: PendingErasure = { kind, id, requestedAt: t, purgeAt: t + Math.max(0, opts.graceMs ?? this.graceMs), by: opts.by ?? 'player',
        ...(opts.account ? { account: opts.account } : {}) };
      l.pending.push(entry);
      return { ...entry };
    });
  }
  cancel(kind: ErasureKind, id: string): Promise<boolean> {
    return this.mutate(l => {
      const before = l.pending.length;
      l.pending = l.pending.filter(p => !(p.kind === kind && p.id === id));
      return l.pending.length !== before;
    });
  }
  due(now = this.now()): PendingErasure[] { return this.state.pending.filter(p => p.purgeAt <= now).map(p => ({ ...p })); }
  /** Marks an id erased: drops its pending entry and remembers only the digest. */
  recordErased(kind: ErasureKind, id: string): Promise<void> {
    return this.mutate(l => {
      l.pending = l.pending.filter(p => !(p.kind === kind && p.id === id));
      const h = erasureDigest(kind, id);
      if (!l.erased.some(e => e.h === h)) l.erased.push({ h, kind, at: this.now() });
    });
  }
}
