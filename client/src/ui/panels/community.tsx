// Guild & reports: guild roster and officer tools, invitations, manual-review reports and the community rules.
// Same `community` actions as before; the layout follows the Social panel (left rail, one screen per section).

import { useEffect, useState } from 'preact/hooks';
import { REPORT_CATEGORIES, type CommunityView } from '@shared/community';
import { SOCIAL_PAGE_SIZE } from '@shared/social';
import { ui, useUI, togglePanel } from '../store';
import { PanelFrame } from './common';
import { cmd } from '../../net/api';
import { openInspection } from './inspect';
import { cls } from './util';
import { UiIcon, type UiIconName } from '../hud/UiIcons';
import { IconClose } from './icons';

type Tab = 'guild' | 'invites' | 'reports' | 'rules';
const TABS: { id: Tab; label: string; icon: UiIconName }[] = [
  { id: 'guild', label: 'Guild', icon: 'shield' }, { id: 'invites', label: 'Invitations', icon: 'party' },
  { id: 'reports', label: 'Reports', icon: 'eye' }, { id: 'rules', label: 'Rules', icon: 'scroll' },
];
const RANK_LABEL: Record<string, string> = { leader: 'Leader', officer: 'Officer', member: 'Member' };

export function reportMessage(name: string, message: string) { ui.set({ reportContext: { name, message } }); togglePanel('community', true); }

export function CommunityPanel() {
  const context = useUI(s => s.reportContext), me = useUI(s => s.char?.name);
  const [tab, setTab] = useState<Tab>(context ? 'reports' : 'guild'), [data, setData] = useState<CommunityView | null>(null);
  const [name, setName] = useState(context?.name ?? ''), [message, setMessage] = useState(context?.message ?? ''), [text, setText] = useState('');
  const [category, setCategory] = useState<string>('harassment'), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [page, setPage] = useState(0);
  const refresh = async () => { const r = await cmd<CommunityView>('community', { action: 'view' }); if (r.ok && r.data) setData(r.data); else setNotice(r.err ?? 'Could not load community'); };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (context) { setTab('reports'); setName(context.name); setMessage(context.message); setPage(0); } }, [context]);
  const act = async (action: string, args: Record<string, unknown> = {}) => {
    setBusy(true); setNotice('');
    try {
      const r = await cmd('community', { action, ...args });
      setNotice(r.ok ? action === 'report' ? 'Report saved for owner review. No automatic punishment.' : 'Saved.' : r.err ?? 'Action failed');
      if (r.ok) { if (action === 'report') { setMessage(''); ui.set({ reportContext: null }); } setText(''); await refresh(); }
    } finally { setBusy(false); }
  };
  const guild = data?.guild, rank = guild?.rank;
  const entries = tab === 'guild' ? guild?.members ?? [] : tab === 'reports' ? data?.reports ?? [] : [];
  const pages = Math.max(1, Math.ceil(entries.length / SOCIAL_PAGE_SIZE)), current = Math.min(page, pages - 1);
  const pageNav = pages > 1 && <div class="so-pages"><button class="btn sm" disabled={!current} onClick={() => setPage(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button class="btn sm" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>;
  const badge = (t: Tab) => t === 'invites' ? data?.invites.length : t === 'guild' ? guild?.members.length : t === 'reports' ? data?.reports.length : undefined;
  return <PanelFrame id="community" title="Guild & reports" width={960} sub={guild?.name ?? 'Companions and community care'}>
    <div class="co so">
      <nav class="co-nav" role="tablist" aria-label="Guild and reports sections">
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} class={cls('co-tab', tab === t.id && 'on')} onClick={() => { setTab(t.id); setPage(0); setText(''); }}>
          <UiIcon name={t.icon} size={20} /><span>{t.label}</span>{!!badge(t.id) && <em>{badge(t.id)}</em>}
        </button>)}
        <button class="btn sm so-guild" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        <button class="btn sm so-guild" onClick={() => togglePanel('social', true)}><UiIcon name="social" size={16} /> Social</button>
      </nav>

      <div class="co-body">
        {notice && <p class="cm-notice" role="status"><UiIcon name="help" size={14} />{notice}</p>}

        {tab === 'guild' && (guild ? <>
          <div class="co-bar"><h3>{guild.name}</h3><span class="co-sub">{guild.members.length} / 80 members · you are {RANK_LABEL[rank ?? 'member'].toLowerCase()}</span></div>
          <blockquote class="cm-motd"><b>Message of the day</b><span>{guild.motd || 'No message of the day.'}</span></blockquote>
          <div class="so-list">
            {guild.members.slice(current * SOCIAL_PAGE_SIZE, (current + 1) * SOCIAL_PAGE_SIZE).map(m => <div class={cls('so-row', m.online && 'online')} key={m.name}>
              <i class="so-dot" aria-label={m.online ? 'Online' : 'Offline'} />
              <div class="so-who"><b>{m.name}</b><span>{RANK_LABEL[m.rank] ?? m.rank} · {m.online ? 'Online' : 'Unavailable'}</span></div>
              <button class="so-act" title="Inspect equipped items" onClick={() => openInspection(m.name)}><UiIcon name="inspect" size={18} /><span>Inspect</span></button>
              {m.name !== me && rank === 'leader' && <>
                <button class="so-act" disabled={busy} onClick={() => void act(m.rank === 'officer' ? 'demote' : 'promote', { name: m.name })}><UiIcon name="star" size={18} /><span>{m.rank === 'officer' ? 'Demote' : 'Promote'}</span></button>
                <button class="so-act" disabled={busy} onClick={() => void act('leader', { name: m.name })}><UiIcon name="shield" size={18} /><span>Leader</span></button>
              </>}
              {m.name !== me && (rank === 'leader' || rank === 'officer' && m.rank === 'member') && <button class="so-act so-remove" disabled={busy} onClick={() => void act('kick', { name: m.name })}><IconClose size={12} /><span>Remove</span></button>}
            </div>)}
          </div>
          {pageNav}
          {rank !== 'member' && <div class="so-cards">
            <form class="so-card" onSubmit={e => { e.preventDefault(); void act('invite', { name: name.trim() }); }}>
              <h4>Invite a character</h4>
              <div class="so-add"><input value={name} maxLength={16} placeholder="Online character name" aria-label="Online character name" onInput={e => setName(e.currentTarget.value)} autoComplete="off" />
                <button class="btn primary" disabled={busy || !name.trim()}>Invite</button></div>
              <p>They get 60 seconds to accept.</p>
            </form>
            <form class="so-card" onSubmit={e => { e.preventDefault(); void act('motd', { text }); }}>
              <h4>Message of the day</h4>
              <div class="so-add"><input value={text} maxLength={200} placeholder="Up to 200 characters" aria-label="New message of the day" onInput={e => setText(e.currentTarget.value)} autoComplete="off" />
                <button class="btn primary" disabled={busy}>Save</button></div>
              <p>Shown to every member here.</p>
            </form>
          </div>}
          <div class="so-chat">
            <div class="so-chat-row">
              <button class="btn" onClick={() => { togglePanel('community', false); ui.set({ chatChannel: 'guild', chatOpen: true }); }}><UiIcon name="chat" size={16} /> Guild chat</button>
              <button class="btn" disabled={busy} onClick={() => void act('leave')}>Leave guild</button>
              <span class="so-chat-tip">One guild per character, 80 members. Leaders transfer leadership before leaving a populated guild. No bank, currency costs or combat bonuses.</span>
            </div>
          </div>
        </> : <>
          <div class="co-bar"><h3>Guild</h3><span class="co-sub">Companions who share a chat channel and a roster.</span></div>
          <div class="so-empty"><UiIcon name="shield" size={40} /><b>You are not in a guild</b><span>Found one below, or ask an officer to invite you.</span></div>
          <form class="so-card" onSubmit={e => { e.preventDefault(); void act('create', { name: name.trim() }); }}>
            <h4>Found a guild</h4>
            <div class="so-add"><input value={name} maxLength={32} placeholder="3–32 letters, numbers or spaces" aria-label="Guild name" onInput={e => setName(e.currentTarget.value)} autoComplete="off" />
              <button class="btn primary" disabled={busy || !name.trim()}>Create guild</button></div>
            <p>One guild per character, 80 members. Guilds have chat and a roster; there is no bank, currency cost or combat bonus.</p>
          </form>
        </>)}

        {tab === 'invites' && <>
          <div class="co-bar"><h3>Invitations</h3><span class="co-sub">Invitations expire after 60 seconds. Refresh to see new ones.</span></div>
          <div class="so-list">
            {data?.invites.map(i => <div class="so-row online" key={i.id}>
              <i class="so-dot" />
              <div class="so-who"><b>{i.guild}</b><span>Invited by {i.from}</span></div>
              <button class="btn primary" disabled={busy || !!guild} onClick={() => void act('accept', { invite: i.id })}>Accept</button>
              <button class="btn" disabled={busy} onClick={() => void act('decline', { invite: i.id })}>Decline</button>
            </div>)}
            {!data?.invites.length && <div class="so-empty"><UiIcon name="party" size={34} /><b>No pending guild invitations</b><span>{guild ? 'Leave your guild before accepting another.' : 'Officers can invite you by character name.'}</span></div>}
          </div>
        </>}

        {tab === 'reports' && <>
          <div class="co-bar"><h3>Reports</h3><span class="co-sub">Reports go to the owner for manual review and expire after 30 days. A report is not proof or an automatic punishment.</span></div>
          <div class="so-cards">
            <form class="so-card" onSubmit={e => { e.preventDefault(); void act('report', { name: name.trim(), category, text, ...(message ? { message } : {}) }); }}>
              <h4>New report</h4>
              <div class="so-add"><input value={name} maxLength={16} placeholder="Character name" aria-label="Character name" onInput={e => { setName(e.currentTarget.value); setMessage(''); }} autoComplete="off" /></div>
              <div class="st-filters" role="radiogroup" aria-label="Report category">
                {REPORT_CATEGORIES.map(c => <button type="button" key={c} role="radio" aria-checked={category === c} class={cls('st-chip', category === c && 'on')} onClick={() => setCategory(c)}>{c}</button>)}
              </div>
              <div class="so-add"><input value={text} maxLength={200} placeholder="What happened? (200 characters)" aria-label="What happened" onInput={e => setText(e.currentTarget.value)} autoComplete="off" /></div>
              {message && <p>The selected message you received will be attached. <button type="button" class="btn sm" onClick={() => setMessage('')}>Remove attachment</button></p>}
              <button class="btn primary" disabled={busy || !name.trim() || (!text.trim() && !message)}>Submit report</button>
            </form>
            <section class="so-card">
              <h4>Your reports</h4>
              <div class="so-list">
                {data?.reports.slice(current * SOCIAL_PAGE_SIZE, (current + 1) * SOCIAL_PAGE_SIZE).map(r => <div class="so-row" key={r.id}>
                  <div class="so-who"><b>{r.target} · {r.category}</b><span>{new Date(r.at).toLocaleDateString()} · {r.resolved ? 'Reviewed' : 'Pending owner review'} · {r.id.slice(0, 8)}</span></div>
                </div>)}
                {!data?.reports.length && <p>You have not filed any reports.</p>}
              </div>
              {pageNav}
            </section>
          </div>
        </>}

        {tab === 'rules' && <>
          <div class="co-bar"><h3>Community rules</h3><span class="co-sub">Short and fair. The owner reviews everything by hand.</span></div>
          <div class="so-cards">
            <section class="so-card"><h4>Be decent</h4><p>Respect other players. Do not harass, threaten, impersonate or spam. Do not cheat, exploit or advertise real-money trades. Report concerns with accurate descriptions; do not submit knowingly false reports.</p></section>
            <section class="so-card"><h4>Your tools</h4><p>Use Social to block messages and invitations or mute chat. Leave a party if you no longer want to share its frames. The owner reviews reports and can mute or suspend a character manually. Contact the owner to request a review of a decision.</p></section>
            <section class="so-card"><h4>What is kept</h4><p>Ordinary chat stays in server memory only. A report may retain the selected received message and your description for 30 days. Expiry runs when the server is running; it runs again at startup. Active sanctions remain until lifted or expired. These controls currently apply to characters, pending account authentication.</p></section>
            <section class="so-card"><h4>Text filter</h4><p>Links and owner-configured phrases may be rejected by the text filter. Filter matches do not cause automatic punishment.</p></section>
          </div>
        </>}
      </div>
    </div>
  </PanelFrame>;
}
