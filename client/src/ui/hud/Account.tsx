// Account screens for the select screen (server accounts mode `optional` or `required`; hidden when `off`).
// Log in / create account / recover with a one-time code, the one-time recovery codes sheet, the heroes the account
// owns (delete with a grace period, restore), password and recovery-code management, signed-in devices with recent
// activity, and "Your data" (download everything, delete the account). All requests go through session.auth; the
// server stays the authority.

import { useEffect, useState } from 'preact/hooks';
import type { AuthCharacter } from '@shared/protocol';
import { CLASSES } from '@shared/data/classes';
import { PASSWORD_MAX, PASSWORD_MIN, lastUsername, passwordProblem, usernameProblem } from '../../net/account';
import { session } from '../../net/api';
import { ui, useUI } from '../store';
import { ClassEmblem, Divider } from './Glyphs';

type Tab = 'login' | 'register' | 'recover';
type AuthedTab = 'heroes' | 'security' | 'devices' | 'data';

const dateText = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const timeText = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** Plain words for the server's activity kinds (server/src/accounts.ts AccountEventKind). */
const ACTIVITY: Record<string, string> = {
  created: 'Account created', login: 'Signed in', password: 'Password changed', recovery: 'Recovery code used', codes: 'New recovery codes',
  revoked: 'Devices signed out', export: 'Data downloaded', 'deletion-requested': 'Account deletion requested', 'deletion-cancelled': 'Account deletion cancelled',
  'character-deletion': 'Hero deletion requested', 'character-restored': 'Hero restored', 'admin-reset': 'Password reset by the server owner',
};

const stop = (e: KeyboardEvent) => e.stopPropagation();
const setError = (error: string | null) => ui.set((s) => ({ account: { ...s.account, error } }));
const closeDialog = () => ui.set((s) => ({ account: { ...s.account, open: false, error: null } }));
/** Choosing a hero fills the name and class on the select screen (ClassSelect watches `account.picked`). */
const chooseHero = (c: AuthCharacter) => ui.set((s) => ({ error: null, account: { ...s.account, open: false, error: null, picked: c } }));

function Field(p: { label: string; value: string; onInput: (v: string) => void; type?: string; autocomplete: string; maxLength?: number; placeholder?: string; autofocus?: boolean; mono?: boolean }) {
  return (
    <label class="ac-field">
      <span>{p.label}</span>
      <input
        type={p.type ?? 'text'}
        value={p.value}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        autocomplete={p.autocomplete}
        autofocus={p.autofocus}
        spellcheck={false}
        autocapitalize="none"
        class={p.mono ? 'mono' : undefined}
        onInput={(e) => p.onInput((e.currentTarget as HTMLInputElement).value)}
        onKeyDown={stop}
      />
    </label>
  );
}

/** Recovery codes are shown once. The player must confirm they kept them before the dialog can close. */
function RecoveryCodes({ codes, username }: { codes: string[]; username: string | null }) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const text = `Hearthfall recovery codes for ${username ?? 'your account'}\nEach code works once and resets your password.\n\n${codes.join('\n')}\n`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(codes.join('\n')); setNote('Copied to the clipboard.'); } catch { setNote('Could not copy. Select the codes and copy them by hand.'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'hearthfall-recovery-codes.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote('Saved as hearthfall-recovery-codes.txt.');
  };
  return (
    <div class="ac-body">
      <h2 class="ac-title">Keep your recovery codes</h2>
      <p class="ac-lead">There is no email reset. If you forget your password, one of these codes lets you set a new one. Each code works once and they are shown only now.</p>
      <ol class="ac-codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
      <div class="ac-row">
        <button type="button" class="btn" onClick={copy}>Copy codes</button>
        <button type="button" class="btn" onClick={download}>Download as text</button>
        <span class="ac-note" role="status">{note}</span>
      </div>
      <label class="ac-check"><input type="checkbox" checked={saved} onChange={(e) => setSaved((e.currentTarget as HTMLInputElement).checked)} /> I stored these codes somewhere safe</label>
      <button type="button" class="btn primary ac-go" disabled={!saved} onClick={() => ui.set((s) => ({ account: { ...s.account, codes: null, open: false } }))}>Continue</button>
    </div>
  );
}

function SignedOut({ closable }: { closable: boolean }) {
  const { busy, error, mode } = useUI((s) => s.account);
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [code, setCode] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? error;
  const go = (t: Tab) => { setTab(t); setLocal(null); setError(null); setPassword(''); setAgain(''); };

  const submit = async (e: Event) => {
    e.preventDefault();
    setLocal(null);
    const name = username.trim().toLowerCase();
    if (tab === 'login') {
      if (!name || !password) { setLocal('Enter your username and password.'); return; }
      await session.auth('login', { username: name, password });
    } else if (tab === 'register') {
      const problem = usernameProblem(name) ?? passwordProblem(password) ?? (password !== again ? 'The two passwords do not match.' : null);
      if (problem) { setLocal(problem); return; }
      await session.auth('register', { username: name, password });
    } else {
      const problem = usernameProblem(name) ?? (code.trim() ? null : 'Enter one of your recovery codes.') ?? passwordProblem(password);
      if (problem) { setLocal(problem); return; }
      await session.auth('recover', { username: name, code: code.trim(), newPassword: password });
    }
    setPassword(''); setAgain(''); setCode('');
  };

  return (
    <div class="ac-body">
      <h2 class="ac-title">{mode === 'required' ? 'Log in to play' : 'Your account'}</h2>
      <div class="ac-tabs" role="tablist">
        {([['login', 'Log in'], ['register', 'Register'], ['recover', 'Recover']] as const).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} class={tab === id ? 'on' : ''} onClick={() => go(id)}>{label}</button>)}
      </div>
      <form class="ac-form" onSubmit={submit}>
        <Field label="Username" value={username} onInput={setUsername} autocomplete="username" maxLength={20} placeholder="3–20 letters, numbers or underscores" autofocus />
        {tab === 'recover' && <Field label="Recovery code" value={code} onInput={setCode} autocomplete="off" maxLength={40} mono />}
        <Field label={tab === 'recover' ? 'New password' : 'Password'} value={password} onInput={setPassword} type="password"
          autocomplete={tab === 'login' ? 'current-password' : 'new-password'} maxLength={PASSWORD_MAX}
          placeholder={tab === 'login' ? undefined : `At least ${PASSWORD_MIN} characters`} />
        {tab === 'register' && <Field label="Repeat password" value={again} onInput={setAgain} type="password" autocomplete="new-password" maxLength={PASSWORD_MAX} />}
        <p class={`ac-msg${shown ? ' bad' : ''}`} role="alert">{shown ?? (tab === 'register'
          ? 'Passwords are never stored in readable form. You get one-time recovery codes next; there is no email reset.'
          : tab === 'recover' ? 'A recovery code sets a new password, ends every other session and is used up.' : '')}</p>
        <button class="btn primary ac-go" disabled={busy}>{busy ? 'One moment…' : tab === 'login' ? 'Log in' : tab === 'register' ? 'Create account' : 'Set new password'}</button>
      </form>
      {tab === 'login' && <button type="button" class="ac-link" onClick={() => go('recover')}>Forgot your password? Use a recovery code</button>}
      {closable && <button type="button" class="ac-link" onClick={closeDialog}>{mode === 'optional' ? 'Play as a guest instead' : 'Close'}</button>}
    </div>
  );
}

/** One hero on the account: choose it, or delete it with a grace period (password re-asked), or restore it. */
function HeroRow({ c, graceDays }: { c: AuthCharacter; graceDays: number }) {
  const busy = useUI((s) => s.account.busy);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const pending = c.deleteAt !== undefined;
  const remove = async (e: Event) => {
    e.preventDefault();
    if (!password) { setError('Enter your password to delete this hero.'); return; }
    const r = await session.auth('deleteCharacter', { character: c.name, password });
    if (r.ok) { setConfirming(false); setPassword(''); }
  };
  return (
    <li class={pending ? 'ac-pending' : undefined}>
      <span class="ac-hero-ico"><ClassEmblem classId={c.classId} /></span>
      <span class="ac-hero-t"><b>{c.name}</b><small>{pending ? `Deleted on ${dateText(c.deleteAt!)} unless restored` : `Level ${c.level} ${CLASSES[c.classId].name}`}</small></span>
      <span class="ac-hero-act">
        {pending
          ? <button type="button" class="btn" disabled={busy} onClick={() => void session.auth('restoreCharacter', { character: c.name })}>Restore</button>
          : <>
            <button type="button" class="btn" onClick={() => chooseHero(c)}>Choose</button>
            <button type="button" class="btn quiet" aria-expanded={confirming} onClick={() => { setConfirming(!confirming); setError(null); }}>Delete…</button>
          </>}
      </span>
      {confirming && !pending && <form class="ac-confirm" onSubmit={remove}>
        <p>{c.name} is removed in {graceDays} days. Until then you can restore it here; afterwards it is gone for good.</p>
        <div class="ac-inline">
          <Field label="Password" value={password} onInput={setPassword} type="password" autocomplete="current-password" maxLength={PASSWORD_MAX} />
          <button class="btn danger" disabled={busy}>Delete {c.name}</button>
          <button type="button" class="btn quiet" onClick={() => setConfirming(false)}>Keep</button>
        </div>
      </form>}
    </li>
  );
}

/** Signed-in devices (sign one out, or all others) and the recent security activity. */
function DevicesPane() {
  const { sessions, events, busy } = useUI((s) => s.account);
  useEffect(() => { void session.auth('sessions'); }, []);
  const list = sessions ?? [];
  return (
    <div class="ac-pane">
      <h3 class="ac-sub">Signed-in devices</h3>
      {list.length === 0 ? <p class="ac-lead">Loading…</p> : <ul class="ac-devices">{list.map((d) => <li key={d.id}>
        <span class="ac-dev-t"><b>{d.device}{d.current && <em class="ac-badge">This device</em>}</b><small>Last used {timeText(d.lastUsed)} · signed in {dateText(d.created)}</small></span>
        {!d.current && <button type="button" class="btn quiet" disabled={busy} onClick={() => void session.auth('revoke', { session: d.id })}>Sign out</button>}
      </li>)}</ul>}
      <div><button type="button" class="btn" disabled={busy || list.filter(d => !d.current).length === 0} onClick={() => void session.auth('revoke', { session: 'others' })}>Sign out all other devices</button></div>
      <h3 class="ac-sub">Recent activity</h3>
      <ul class="ac-activity">{(events ?? []).slice(0, 6).map((e, i) => <li key={i}><span>{ACTIVITY[e.k] ?? e.k}{e.d ? ` · ${e.d}` : ''}</span><time>{timeText(e.t)}</time></li>)}</ul>
      <p class="ac-note">No email is ever sent. If something here looks unfamiliar, sign the other devices out and change your password.</p>
    </div>
  );
}

/** Download everything the server keeps about the account; schedule the account's deletion. */
function DataPane({ username }: { username: string }) {
  const { busy, info } = useUI((s) => s.account);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [note, setNote] = useState('');
  const grace = info?.graceDays ?? 14;
  const download = async (e: Event) => {
    e.preventDefault(); setNote('');
    if (!password) { setError('Enter your password to download your data.'); return; }
    const r = await session.auth('export', { password });
    if (!r.ok || !r.data) return;
    const name = `hearthfall-data-${username}-${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPassword(''); setNote(`Saved as ${name}.`);
  };
  const remove = async (e: Event) => {
    e.preventDefault();
    if (confirm.trim().toLowerCase() !== username) { setError('Type your username exactly to confirm.'); return; }
    if (!delPassword) { setError('Enter your password to delete your account.'); return; }
    const r = await session.auth('deleteAccount', { password: delPassword, confirm: confirm.trim().toLowerCase() });
    if (r.ok) { setDeleting(false); setConfirm(''); setDelPassword(''); }
  };
  return (
    <div class="ac-pane">
      <form class="ac-form" onSubmit={download}>
        <h3 class="ac-sub">Download your data</h3>
        <p class="ac-lead">One file with your account, every hero's full save and anything else this server keeps about you.</p>
        <div class="ac-inline"><Field label="Password" value={password} onInput={setPassword} type="password" autocomplete="current-password" maxLength={PASSWORD_MAX} />
          <button class="btn" disabled={busy}>Download</button></div>
        {note && <p class="ac-note" role="status">{note}</p>}
      </form>
      <Divider class="ac-div" />
      <h3 class="ac-sub">Delete your account</h3>
      {info?.deletionAt
        ? <p class="ac-lead">Scheduled: everything is erased on <b>{dateText(info.deletionAt)}</b>. Use “Cancel deletion” above to keep playing.</p>
        : !deleting
          ? <><p class="ac-lead">Removes the account and all its heroes after {grace} days. Until then you can cancel by logging in.</p>
            <div><button type="button" class="btn quiet" onClick={() => { setDeleting(true); setError(null); }}>Delete account…</button></div></>
          : <form class="ac-form" onSubmit={remove}>
            <p class="ac-lead">Type <b>{username}</b> and your password. Your heroes cannot be played while the deletion is pending.</p>
            <div class="ac-inline">
              <Field label="Username" value={confirm} onInput={setConfirm} autocomplete="off" maxLength={20} />
              <Field label="Password" value={delPassword} onInput={setDelPassword} type="password" autocomplete="current-password" maxLength={PASSWORD_MAX} />
            </div>
            <div class="ac-row"><button class="btn danger" disabled={busy}>Delete in {grace} days</button><button type="button" class="btn quiet" onClick={() => setDeleting(false)}>Keep my account</button></div>
          </form>}
    </div>
  );
}

function SignedIn({ username, characters }: { username: string; characters: AuthCharacter[] }) {
  const { busy, error, info } = useUI((s) => s.account);
  const [tab, setTab] = useState<AuthedTab>('heroes');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [codesPassword, setCodesPassword] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const shown = local ?? error;

  const changePassword = async (e: Event) => {
    e.preventDefault(); setLocal(null); setDone('');
    const problem = !current ? 'Enter your current password.' : passwordProblem(next) ?? (next !== again ? 'The two new passwords do not match.' : null);
    if (problem) { setLocal(problem); return; }
    const r = await session.auth('password', { password: current, newPassword: next });
    if (r.ok) { setDone('Password changed. Other sessions were signed out.'); setCurrent(''); setNext(''); setAgain(''); }
  };
  const newCodes = async (e: Event) => {
    e.preventDefault(); setLocal(null); setDone('');
    if (!codesPassword) { setLocal('Enter your password to create new recovery codes.'); return; }
    const r = await session.auth('codes', { password: codesPassword });
    if (r.ok) setCodesPassword('');
  };

  return (
    <div class="ac-body">
      <h2 class="ac-title">{username}</h2>
      {info?.deletionAt && <div class="ac-warn" role="alert">
        <span>This account and its heroes will be erased on <b>{dateText(info.deletionAt)}</b>.</span>
        <button type="button" class="btn" disabled={busy} onClick={() => void session.auth('cancelDeletion')}>Cancel deletion</button>
      </div>}
      <div class="ac-tabs" role="tablist">
        {([['heroes', 'Heroes'], ['security', 'Security'], ['devices', 'Devices'], ['data', 'Your data']] as const).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} class={tab === id ? 'on' : ''} onClick={() => { setTab(id); setLocal(null); setError(null); }}>{label}</button>)}
      </div>
      {tab === 'heroes' && <>
        {characters.length === 0
          ? <p class="ac-lead">No heroes on this account yet. Name a new hero on the main screen and it is linked to {username} when you enter the world.</p>
          : <ul class="ac-heroes">{characters.map((c) => <HeroRow key={c.name} c={c} graceDays={info?.graceDays ?? 14} />)}</ul>}
        {error && <p class="ac-msg bad" role="alert">{error}</p>}
      </>}
      {tab === 'devices' && <><DevicesPane />{error && <p class="ac-msg bad" role="alert">{error}</p>}</>}
      {tab === 'data' && <><DataPane username={username} /><p class={`ac-msg${error ? ' bad' : ''}`} role="alert">{error ?? ''}</p></>}
      {tab === 'security' && <>
        {info && <p class={`ac-note${info.recoveryLeft <= 2 ? ' ac-low' : ''}`}>{info.recoveryLeft === 0 ? 'No recovery codes left: create new ones below.'
          : `${info.recoveryLeft} of 8 recovery codes left.${info.recoveryLeft <= 2 ? ' Create new ones soon.' : ''}`}</p>}
        <form class="ac-form" onSubmit={changePassword}>
          <h3 class="ac-sub">Change password</h3>
          <Field label="Current password" value={current} onInput={setCurrent} type="password" autocomplete="current-password" maxLength={PASSWORD_MAX} />
          <Field label="New password" value={next} onInput={setNext} type="password" autocomplete="new-password" maxLength={PASSWORD_MAX} placeholder={`At least ${PASSWORD_MIN} characters`} />
          <Field label="Repeat new password" value={again} onInput={setAgain} type="password" autocomplete="new-password" maxLength={PASSWORD_MAX} />
          <button class="btn" disabled={busy}>Change password</button>
        </form>
        <Divider class="ac-div" />
        <form class="ac-form" onSubmit={newCodes}>
          <h3 class="ac-sub">New recovery codes</h3>
          <p class="ac-lead">Creates eight fresh one-time codes and retires every older code.</p>
          <Field label="Password" value={codesPassword} onInput={setCodesPassword} type="password" autocomplete="current-password" maxLength={PASSWORD_MAX} />
          <button class="btn" disabled={busy}>Create new codes</button>
        </form>
        <p class={`ac-msg${shown ? ' bad' : ''}`} role="alert">{shown ?? done}</p>
      </>}
      <div class="ac-foot">
        <button type="button" class="btn" disabled={busy} onClick={() => void session.auth('logout')}>Log out</button>
        <button type="button" class="btn primary" onClick={closeDialog}>Done</button>
      </div>
    </div>
  );
}

export function AccountDialog() {
  const account = useUI((s) => s.account);
  const forced = account.mode === 'required' && !account.username;
  const visible = account.mode !== 'off' && (account.open || forced || !!account.codes);
  useEffect(() => {
    if (!visible || forced || account.codes) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDialog(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, forced, !!account.codes]);
  if (!visible) return null;
  return (
    <div class="ac-veil interactive" role="dialog" aria-modal="true" aria-label="Account">
      <div class="ac-card">
        {account.codes ? <RecoveryCodes codes={account.codes} username={account.username}/>
          : account.username ? <SignedIn username={account.username} characters={account.characters} />
          : <SignedOut closable={!forced} />}
      </div>
    </div>
  );
}

/** Top-right chip on the select screen: who is logged in, or how to log in. */
export function AccountBar() {
  const { mode, username } = useUI((s) => s.account);
  if (mode === 'off') return null;
  return (
    <button type="button" class={`ac-chip interactive${username ? ' in' : ''}`} onClick={() => ui.set((s) => ({ account: { ...s.account, open: true, error: null } }))}>
      <i aria-hidden="true" />
      {username ? <><b>{username}</b><span>Account</span></> : <><b>Log in</b><span>{mode === 'optional' ? 'or play as a guest' : 'or create an account'}</span></>}
    </button>
  );
}

/** Heroes the logged-in account owns, as quick picks above the name field. */
export function HeroPicker() {
  const { username, characters } = useUI((s) => s.account);
  if (!username || characters.length === 0) return null;
  return (
    <div class="ac-picker" role="group" aria-label="Your heroes">
      <span>Your heroes</span>
      {characters.filter(c => c.deleteAt === undefined).map((c) => <button key={c.name} type="button" class="ac-pick interactive" onClick={() => chooseHero(c)} title={`Level ${c.level} ${CLASSES[c.classId].name}`}>
        <span class="ac-pick-ico"><ClassEmblem classId={c.classId} /></span><b>{c.name}</b><small>{c.level}</small>
      </button>)}
    </div>
  );
}
