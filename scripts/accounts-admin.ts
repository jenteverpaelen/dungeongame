/**
 * Operator tool for accounts. Run with the SAME DATA_DIR as the server, and restart the server afterwards
 * (it keeps accounts in memory): the owner links old characters, resets a forgotten password, lists accounts.
 *
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts list
 *   DATA_DIR=<saves> HF_PASSWORD='long password here' npx tsx scripts/accounts-admin.ts create alice
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts link alice OldHeroName
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts unlink alice OldHeroName
 *   DATA_DIR=<saves> npx tsx scripts/accounts-admin.ts reset alice        (prints a new password and recovery codes once)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { AccountStore } from '../server/src/accounts';
import { DATA_DIR, ACCOUNT_MODE } from '../server/src/config';
import { characterId } from '../server/src/persistence';

const [command, username, character] = process.argv.slice(2);
const store = new AccountStore();
await store.init();
const fail = (message: string): never => { console.error(message); process.exit(1); };
const needUser = () => (username && store.normaliseUsername(username)) || fail('Give a valid username.');

switch (command) {
  case 'list':
    for (const name of store.usernames()) console.log(`${name}: ${store.charactersOf(name).join(', ') || '(no characters)'}`);
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
    const user = needUser(), id = characterId(character ?? '');
    if (!character) fail('Give a character name.');
    await fs.access(path.join(DATA_DIR, `${id}.json`)).catch(() => fail(`No saved character "${character}" in ${DATA_DIR}.`));
    const r = await store.link(user, id);
    console.log(r.ok ? `Linked ${id} to ${user}.` : r.err);
    break;
  }
  case 'unlink': {
    const user = needUser();
    const r = await store.unlink(user, characterId(character ?? ''));
    console.log(r.ok ? `Unlinked ${character} from ${user}.` : r.err);
    break;
  }
  case 'reset': {
    const r = await store.adminReset(needUser());
    if (!r.ok) fail(r.err);
    else {
      console.log(`New password for ${username} (shown once): ${r.password}`);
      console.log('New recovery codes (shown once):');
      for (const c of r.recoveryCodes) console.log(`  ${c}`);
    }
    break;
  }
  default:
    fail('Commands: list | create <user> (HF_PASSWORD) | link <user> <character> | unlink <user> <character> | reset <user>');
}
