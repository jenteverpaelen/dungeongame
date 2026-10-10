// Account screens for the select screen (server accounts mode `optional` or `required`; hidden when `off`).
// Log in / create account / recover with a one-time code, the one-time recovery codes sheet, the heroes the account
// owns, and password and recovery-code management. All requests go through session.auth; the server stays the authority.

import { useEffect, useState } from 'preact/hooks';
import type { AuthCharacter } from '@shared/protocol';
import { CLASSES } from '@shared/data/classes';
import { PASSWORD_MAX, PASSWORD_MIN, lastUsername, passwordProblem, usernameProblem } from '../../net/account';
import { session } from '../../net/api';
import { ui, useUI } from '../store';
import { ClassEmblem, Divider } from './Glyphs';

type Tab = 'login' | 'register' | 'recover';
type AuthedTab = 'heroes' | 'security';

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

function SignedIn({ username, characters }: { username: string; characters: AuthCharacter[] }) {
  const { busy, error } = useUI((s) => s.account);
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
      <div class="ac-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'heroes'} class={tab === 'heroes' ? 'on' : ''} onClick={() => { setTab('heroes'); setLocal(null); setError(null); }}>Heroes</button>
        <button type="button" role="tab" aria-selected={tab === 'security'} class={tab === 'security' ? 'on' : ''} onClick={() => { setTab('security'); setLocal(null); setError(null); }}>Security</button>
      </div>
      {tab === 'heroes' && <>
        {characters.length === 0
          ? <p class="ac-lead">No heroes on this account yet. Name a new hero on the main screen and it is linked to {username} when you enter the world.</p>
          : <ul class="ac-heroes">{characters.map((c) => <li key={c.name}>
            <span class="ac-hero-ico"><ClassEmblem classId={c.classId} /></span>
            <span class="ac-hero-t"><b>{c.name}</b><small>Level {c.level} {CLASSES[c.classId].name}</small></span>
            <button type="button" class="btn" onClick={() => chooseHero(c)}>Choose</button>
          </li>)}</ul>}
      </>}
      {tab === 'security' && <>
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
      {characters.map((c) => <button key={c.name} type="button" class="ac-pick interactive" onClick={() => chooseHero(c)} title={`Level ${c.level} ${CLASSES[c.classId].name}`}>
        <span class="ac-pick-ico"><ClassEmblem classId={c.classId} /></span><b>{c.name}</b><small>{c.level}</small>
      </button>)}
    </div>
  );
}
