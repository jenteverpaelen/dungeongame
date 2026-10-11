/**
 * Operator tool for accounts and personal data. Run with the SAME DATA_DIR as the server. Account changes (create,
 * link, unlink, reset, revoke-sessions, delete --now) need a server restart afterwards (it keeps accounts in memory) —
 * stop the server first for those. Scheduled deletions (delete, cancel-delete, delete-character) are merged safely
 * with a running server and picked up within an hour.
 *
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts list
 *   DATA_DIR=<saves> HF_PASSWORD='long password here' npx tsx scripts/accounts-admin.ts create alice
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts link alice OldHeroName
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts unlink alice OldHeroName
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts reset alice              (prints a new password and recovery codes once)
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts activity alice           (security activity, signed-in devices)
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts revoke-sessions alice    (signs out every device)
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts export alice out.json    (GDPR access/portability copy)
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts export-character Name out.json
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts delete alice [--now]     (grace period unless --now)
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts delete-character Name [--now]
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts cancel-delete alice|Name
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts pending                  (scheduled deletions and erasure count)
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts purge                    (erase everything past its grace period now)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { AccountStore } from '../server/src/accounts';
import { DATA_DIR, ACCOUNT_MODE } from '../server/src/config';
import { characterId, ensureDataDir, flushSaves, NAME_RE } from '../server/src/persistence';
import { PrivacyLedger } from '../server/src/privacy';
import { Telemetry } from '../server/src/telemetry';
import { Community } from '../server/src/community';
import { buildAccountExport, buildCharacterExport, eraseAccountNow, eraseCharacterNow, purgeDue, type ErasureDeps } from '../server/src/erasure';

const [command, subject, extra] = process.argv.slice(2);
ensureDataDir();
const store = new AccountStore();
await store.init();
const ledger = new PrivacyLedger();
await ledger.init();
const community = new Community(() => [], () => false, () => true);
await community.init();
const deps: ErasureDeps = { accounts: store, ledger, telemetry: new Telemetry(undefined, false), community };
const fail = (message: string): never => { console.error(message); process.exit(1); };
const needUser = () => (subject && store.normaliseUsername(subject)) || fail('Give a valid username.');
const needCharacter = () => (subject && NAME_RE.test(subject) ? characterId(subject) : fail('Give a character name.'));
const now = process.argv.includes('--now');
const when = (t: number) => new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

switch (command) {
  case 'list':
    for (const name of store.usernames()) console.log(`${name}: ${store.charactersOf(name).join(', ') || '(no characters)'}${ledger.pending('account', name) ? '  [scheduled for deletion]' : ''}`);
    console.log(`${store.usernames().length} account(s) in ${path.join(DATA_DIR, 'accounts')} (server mode: ${ACCOUNT_MODE})`);
    break;
  case 'create': {
    const password = process.env.HF_PASSWORD;
    if (!password) fail('Set HF_PASSWORD to the new account password (not shown again).');
    const r = await store.register(needUser(), password);
    if (!r.ok) fail(r.err);
    else { console.log(`Created ${r.username}. Recovery codes (shown once):`); for (const c of r.recoveryCodes) console.log(`  ${c}`); }
    break;
  }
  case 'link': {
    const user = needUser(), id = characterId(extra ?? '');
    if (!extra) fail('Give a character name.');
    await fs.access(path.join(DATA_DIR, `${id}.json`)).catch(() => fail(`No saved character "${extra}" in ${DATA_DIR}.`));
    const r = await store.link(user, id);
    console.log(r.ok ? `Linked ${id} to ${user}.` : r.err);
    break;
  }
  case 'unlink': {
    const user = needUser();
    const r = await store.unlink(user, characterId(extra ?? ''));
    console.log(r.ok ? `Unlinked ${extra} from ${user}.` : r.err);
    break;
  }
  case 'reset': {
    const r = await store.adminReset(needUser());
    if (!r.ok) fail(r.err);
    else {
      console.log(`New password for ${subject} (shown once): ${r.password}`);
      console.log('New recovery codes (shown once):');
      for (const c of r.recoveryCodes) console.log(`  ${c}`);
    }
    break;
  }
  case 'activity': {
    const user = needUser();
    console.log(`Recovery codes left: ${store.recoveryLeft(user)}`);
    for (const s of store.sessionsOf(user)) console.log(`  device: ${s.device}, signed in ${when(s.created)}, last used ${when(s.lastUsed)}`);
    for (const e of store.events(user).reverse()) console.log(`  ${when(e.t)}  ${e.k}${e.d ? ` (${e.d})` : ''}`);
    break;
  }
  case 'revoke-sessions': {
    const user = needUser();
    const n = store.sessionsOf(user).length;
    store.revokeAll(user);
    await store.settled();
    console.log(`Signed out ${n} device(s) of ${user}. Restart the server for this to take effect.`);
    break;
  }
  case 'export': {
    const user = needUser();
    if (!extra) fail('Give an output file.');
    await fs.writeFile(extra, JSON.stringify(await buildAccountExport(deps, user), null, 2), { flag: 'wx' });
    await store.note(user, 'export', 'by the server owner');
    console.log(`Wrote ${extra}. Hand it to the account owner only after checking who is asking (docs/rework/partials/PRIVACY-RUNBOOK.md).`);
    break;
  }
  case 'export-character': {
    const id = needCharacter();
    if (!extra) fail('Give an output file.');
    await fs.writeFile(extra, JSON.stringify(await buildCharacterExport(deps, id), null, 2), { flag: 'wx' });
    console.log(`Wrote ${extra}.`);
    break;
  }
  case 'delete': {
    const user = needUser();
    if (now) { const chars = await eraseAccountNow(deps, user); console.log(`Erased account ${user} and ${chars.length} character(s). Restart the server.`); break; }
    const p = await ledger.schedule('account', user, { by: 'owner' });
    await store.note(user, 'deletion-requested', 'by the server owner');
    console.log(`Account ${user} will be erased on ${when(p.purgeAt)}; logging in shows a cancel button until then.`);
    break;
  }
  case 'delete-character': {
    const id = needCharacter();
    if (now) { await eraseCharacterNow(deps, id); console.log(`Erased ${id}. Restart the server if it is running.`); break; }
    const p = await ledger.schedule('character', id, { by: 'owner', account: store.ownerOf(id) });
    console.log(`${id} will be erased on ${when(p.purgeAt)} and cannot be played until then.`);
    break;
  }
  case 'cancel-delete': {
    const user = subject ? store.normaliseUsername(subject) : null;
    const id = subject && NAME_RE.test(subject) ? characterId(subject) : '';
    const done = (user && await ledger.cancel('account', user)) || (id && await ledger.cancel('character', id));
    if (done && user && store.has(user)) await store.note(user, 'deletion-cancelled', 'by the server owner');
    console.log(done ? `Cancelled the scheduled deletion of ${subject}.` : `Nothing scheduled for ${subject}.`);
    break;
  }
  case 'pending':
    for (const p of ledger.allPending()) console.log(`${p.kind} ${p.id}${p.account && p.kind === 'character' ? ` (account ${p.account})` : ''}: erase on ${when(p.purgeAt)}, asked by ${p.by} on ${when(p.requestedAt)}`);
    console.log(`${ledger.allPending().length} scheduled; ${ledger.erasedCount()} erased so far (only digests are kept).`);
    break;
  case 'purge': {
    const r = await purgeDue(deps);
    console.log(`Erased ${r.accounts.length} account(s) and ${r.characters.length} character(s). Restart the server if it is running.`);
    break;
  }
  default:
    fail('Commands: list | create | link | unlink | reset | activity | revoke-sessions | export | export-character | delete [--now] | delete-character [--now] | cancel-delete | pending | purge');
}
await store.settled();
await community.flush();
await flushSaves();
