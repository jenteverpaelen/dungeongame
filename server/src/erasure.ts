// Carries out the privacy ledger (server/src/privacy.ts): erase characters and accounts, purge what is due, re-apply
// erasures to files a backup restore brought back, and build a person's machine-readable data export.
//
// What an erasure removes: the character save (and its quarantined copies), its telemetry lines, its guild membership
// and pending invitations, its account link; for an account also the account file, its sessions and every character
// it owns. What remains: the SHA-256 digest of the erased id with the time (so a restored backup is erased again) and
// reports other players filed (30-day moderation retention, then they expire). Other players' friend lists are their
// own data and are left alone.

import type { AccountStore } from './accounts';
import type { Community } from './community';
import { eraseCharacter, listCharacters, loadCharacter, readCharacterBytes } from './persistence';
import { erasureDigest, type ErasureKind, type PendingErasure, type PrivacyLedger } from './privacy';
import type { Telemetry } from './telemetry';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ErasureDeps {
  accounts: AccountStore;
  ledger: PrivacyLedger;
  telemetry: Telemetry;
  community: Community;
  /** Disconnect a character that is online; its last save is queued before the erasure, which runs after it. */
  disconnect?(characterId: string, reason: string): void;
}

export async function eraseCharacterNow(deps: ErasureDeps, id: string): Promise<void> {
  deps.disconnect?.(id, 'This hero has been deleted.');
  await deps.community.forget(id);
  await deps.telemetry.scrub([id]);
  await eraseCharacter(id);
  const owner = deps.accounts.ownerOf(id);
  if (owner) await deps.accounts.unlink(owner, id);
  await deps.ledger.recordErased('character', id);
}

export async function eraseAccountNow(deps: ErasureDeps, username: string): Promise<string[]> {
  const characters = deps.accounts.charactersOf(username);
  for (const id of characters) await eraseCharacterNow(deps, id);
  await deps.accounts.remove(username);
  await deps.ledger.recordErased('account', username);
  return characters;
}

/** Erases everything whose grace period has ended. One failure is logged and does not stop the others. */
export async function purgeDue(deps: ErasureDeps, now = Date.now()): Promise<{ accounts: string[]; characters: string[] }> {
  const done = { accounts: [] as string[], characters: [] as string[] };
  for (const p of deps.ledger.due(now)) {
    try {
      if (p.kind === 'account') done.characters.push(...await eraseAccountNow(deps, p.id)), done.accounts.push(p.id);
      else { await eraseCharacterNow(deps, p.id); done.characters.push(p.id); }
    } catch (error) {
      console.error(`[privacy] could not erase ${p.kind} (will retry):`, error instanceof Error ? error.message : error);
    }
  }
  if (done.accounts.length || done.characters.length) console.log(`[privacy] erased ${done.accounts.length} account(s) and ${done.characters.length} character(s) after their grace period`);
  return done;
}

const erasedAt = (deps: ErasureDeps, kind: ErasureKind, id: string): number | undefined => deps.ledger.erasedAt(kind, id);

/** After a restore: any file older than the erasure of its id is erased again. Files created later (a new hero who
 *  took a freed name) are newer than the erasure and stay. */
export async function reapplyErasures(deps: ErasureDeps): Promise<{ characters: string[]; accounts: string[] }> {
  const out = { characters: [] as string[], accounts: [] as string[] };
  if (!deps.ledger.erasedCount()) return out;
  for (const id of await listCharacters()) {
    const at = erasedAt(deps, 'character', id);
    if (at === undefined) continue;
    let lastSeen = 0;
    try { const raw = await readCharacterBytes(id); lastSeen = raw ? Number((JSON.parse(raw.toString('utf8')) as { lastSeen?: unknown }).lastSeen) || 0 : 0; } catch { lastSeen = 0; }
    if (lastSeen > at) continue;
    await eraseCharacterNow(deps, id);
    out.characters.push(id);
  }
  for (const username of deps.accounts.usernames()) {
    const at = erasedAt(deps, 'account', username);
    if (at === undefined) continue;
    let created = 0;
    try { created = Date.parse(JSON.parse(await fs.readFile(path.join(deps.accounts.dir, `${username}.json`), 'utf8')).createdAt) || 0; } catch { created = 0; }
    if (created > at) continue;
    await eraseAccountNow(deps, username);
    out.accounts.push(username);
  }
  if (out.characters.length || out.accounts.length) console.log(`[privacy] re-applied ${out.accounts.length} account and ${out.characters.length} character erasure(s) to restored files`);
  return out;
}

/** Restore tooling (works on a directory that is not live): erase restored characters/accounts older than their
 *  erasure in `ledgerFile`. Use before activating a restored directory. */
export async function applyErasuresToDirectory(charactersDir: string, ledgerFile: string, accountsDir?: string): Promise<{ characters: string[]; accounts: string[] }> {
  const ledger = new PrivacyLedgerFile(ledgerFile);
  await ledger.load();
  const out = { characters: [] as string[], accounts: [] as string[] };
  for (const name of (await fs.readdir(charactersDir)).filter(n => /^[a-z0-9]{2,16}\.json$/.test(n))) {
    const id = name.slice(0, -5), at = ledger.erasedAt('character', id);
    if (at === undefined) continue;
    let lastSeen = 0;
    try { lastSeen = Number(JSON.parse(await fs.readFile(path.join(charactersDir, name), 'utf8')).lastSeen) || 0; } catch { lastSeen = 0; }
    if (lastSeen > at) continue;
    for (const f of await fs.readdir(charactersDir)) if (f === name || f.startsWith(`${name}.`)) await fs.rm(path.join(charactersDir, f), { force: true });
    out.characters.push(id);
  }
  if (accountsDir) for (const name of (await fs.readdir(accountsDir)).filter(n => /^[a-z0-9_]{3,20}\.json$/.test(n))) {
    const username = name.slice(0, -5), at = ledger.erasedAt('account', username);
    if (at === undefined) continue;
    let created = 0;
    try { created = Date.parse(JSON.parse(await fs.readFile(path.join(accountsDir, name), 'utf8')).createdAt) || 0; } catch { created = 0; }
    if (created > at) continue;
    await fs.rm(path.join(accountsDir, name), { force: true });
    out.accounts.push(username);
  }
  return out;
}

/** Read-only view of a ledger file at any path (restore tooling). */
class PrivacyLedgerFile {
  private erased = new Map<string, number>();
  constructor(private readonly file: string) {}
  async load() {
    const data = JSON.parse(await fs.readFile(this.file, 'utf8')) as { version?: number; erased?: { h: string; at: number }[] };
    if (data.version !== 1 || !Array.isArray(data.erased)) throw new Error('Not a Hearthfall privacy ledger');
    for (const e of data.erased) this.erased.set(e.h, e.at);
  }
  erasedAt(kind: ErasureKind, id: string) { return this.erased.get(erasureDigest(kind, id)); }
}

const iso = (t: number) => new Date(t).toISOString();
const pendingView = (p: PendingErasure) => ({ kind: p.kind, id: p.id, requested: iso(p.requestedAt), erasedOn: iso(p.purgeAt), by: p.by });

/** A person's data, machine-readable (GDPR Art. 15 access + Art. 20 portability): account, characters, telemetry. */
export async function buildAccountExport(deps: ErasureDeps, username: string): Promise<Record<string, unknown>> {
  const characters: Record<string, unknown>[] = [];
  const ids = deps.accounts.charactersOf(username);
  for (const id of ids) {
    let save: unknown = null;
    try { save = await loadCharacter(id); } catch (error) { save = { unreadable: error instanceof Error ? error.message : 'unreadable' }; }
    characters.push({ id, save, community: deps.community.exportFor(id) });
  }
  return {
    format: 'hearthfall-personal-data', version: 1, exportedAt: iso(Date.now()),
    about: 'Everything this Hearthfall server stores about your account and heroes. Character saves are the exact game records. '
      + 'Telemetry lines exist only when the server owner ran a playtest with telemetry switched on.',
    account: deps.accounts.exportRecord(username),
    pendingDeletions: deps.ledger.pendingFor(username).map(pendingView),
    characters,
    telemetry: await deps.telemetry.eventsFor(ids).catch(() => []),
  };
}

/** Owner tooling: the export for a single character (any account mode). */
export async function buildCharacterExport(deps: ErasureDeps, id: string): Promise<Record<string, unknown>> {
  return {
    format: 'hearthfall-personal-data', version: 1, exportedAt: iso(Date.now()), character: id,
    save: await loadCharacter(id), community: deps.community.exportFor(id),
    pendingDeletion: deps.ledger.pending('character', id) ? pendingView(deps.ledger.pending('character', id)!) : null,
    telemetry: await deps.telemetry.eventsFor([id]).catch(() => []),
  };
}
