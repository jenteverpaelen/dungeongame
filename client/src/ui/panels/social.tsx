// Social: friends roster with presence, blocked and muted lists, privacy and nameplate titles, plus the chat and
// emote shortcuts. Same server operations as before (`social` actions, party invite, whisper, inspect).

import { useState } from 'preact/hooks';
import { SOCIAL_LIMIT, SOCIAL_PAGE_SIZE } from '@shared/social';
import { ZONES } from '@shared/data/zones';
import { ui, useUI, togglePanel } from '../store';
import { PanelFrame } from './common';
import { cls, run } from './util';
import { openInspection } from './inspect';
import { unlockedTitles, EMOTES } from '@shared/community';
import { sendChat } from '../../net/api';
import { UiIcon, type UiIconName } from '../hud/UiIcons';
import { IconClose } from './icons';

export function whisperTo(name: string) { togglePanel('social', false); ui.set({ chatChannel: 'whisper', chatTarget: name, chatOpen: true }); }

type Tab = 'friends' | 'blocked' | 'muted' | 'privacy';
const TAB_META: { id: Tab; label: string; icon: UiIconName; blurb: string }[] = [
  { id: 'friends', label: 'Friends', icon: 'social', blurb: 'Add a character to keep it here. Add each other to share presence; unavailable includes offline, private and unconfirmed contacts.' },
  { id: 'blocked', label: 'Blocked', icon: 'shield', blurb: 'Blocking hides messages and presence and prevents invitations and whispers from that character.' },
  { id: 'muted', label: 'Muted', icon: 'eye', blurb: 'Muted names have their chat messages hidden. They can still party with you.' },
  { id: 'privacy', label: 'Privacy', icon: 'lock', blurb: '' },
];
const CHANNELS = ['zone', 'world', 'party', 'trade', 'lfg'] as const;

function Segmented<T extends string>({ value, options, onPick, disabled }: { value: T; options: { id: T; label: string }[]; onPick: (v: T) => void; disabled?: boolean }) {
  return <div class="co-seg so-seg" role="radiogroup">{options.map(o =>
    <button key={o.id} role="radio" aria-checked={value === o.id} class={cls(value === o.id && 'on')} disabled={disabled} onClick={() => onPick(o.id)}>{o.label}</button>)}</div>;
}

export function SocialPanel() {
  const social = useUI(s => s.social), char = useUI(s => s.char);
  const [tab, setTab] = useState<Tab>('friends'), [page, setPage] = useState(0), [name, setName] = useState(''), [busy, setBusy] = useState(false);
  if (!social) return <PanelFrame id="social" title="Social" width={900}><p>Waiting for contacts…</p></PanelFrame>;
  const act = async (action: string, args: Record<string, unknown> = {}) => {
    setBusy(true);
    try { const r = await run('social', { action, ...args }); if (r.ok) setName(''); } finally { setBusy(false); }
  };
  const list = tab === 'privacy' ? [] : social[tab].map(v => (typeof v === 'string' ? { name: v, online: false } : v));
  const pages = Math.max(1, Math.ceil(list.length / SOCIAL_PAGE_SIZE)), current = Math.min(page, pages - 1);
  const meta = TAB_META.find(t => t.id === tab)!;
  const counts: Record<Tab, number | undefined> = { friends: social.friends.length, blocked: social.blocked.length, muted: social.muted.length, privacy: undefined };
  const online = social.friends.filter(f => typeof f !== 'string' && f.online).length;
  const who: { id: 'all' | 'contacts' | 'off'; label: string }[] = [{ id: 'all', label: 'Everyone' }, { id: 'contacts', label: 'Mutual friends & party' }, { id: 'off', label: 'Nobody' }];
  return <PanelFrame id="social" title="Social" width={900} sub={`${online} friend${online === 1 ? '' : 's'} online`}>
    <div class="co so">
      <nav class="co-nav" role="tablist" aria-label="Social sections">
        {TAB_META.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} class={cls('co-tab', tab === t.id && 'on')} onClick={() => { setTab(t.id); setPage(0); setName(''); }}>
          <UiIcon name={t.icon} size={20} /><span>{t.label}</span>{counts[t.id] !== undefined && <em>{counts[t.id]}</em>}
        </button>)}
        <button class="btn sm so-guild" onClick={() => togglePanel('community', true)}><UiIcon name="shield" size={16} /> Guild &amp; reports</button>
      </nav>
      <div class="co-body">
        {(!social.enabled || !social.supported) && <p class="so-warn">{!social.supported ? 'This contact record needs a supported game version.' : 'Social actions are disabled in this channel. You can still remove names or change privacy.'}</p>}
        {tab !== 'privacy' && <>
          <div class="co-bar"><h3>{meta.label}</h3><span class="co-sub">{list.length} / {SOCIAL_LIMIT} names</span></div>
          <p class="co-sub">{meta.blurb}</p>
          <form class="so-add" onSubmit={e => { e.preventDefault(); void act(tab === 'friends' ? 'add' : tab === 'blocked' ? 'block' : 'mute', { name: name.trim() }); }}>
            <input value={name} maxLength={16} placeholder="Character name" aria-label="Character name" onInput={e => setName(e.currentTarget.value)} autoComplete="off" />
            <button class="btn primary" disabled={busy || !social.enabled || !social.supported || !name.trim() || list.length >= SOCIAL_LIMIT}>
              {tab === 'friends' ? 'Add friend' : tab === 'blocked' ? 'Block' : 'Mute'}
            </button>
          </form>
          <div class="so-list">
            {list.slice(current * SOCIAL_PAGE_SIZE, (current + 1) * SOCIAL_PAGE_SIZE).map(f => {
              const detail = tab === 'friends' ? (f.online ? `Level ${f.level} · ${ZONES[f.zone ?? '']?.name ?? 'Travelling'} · Channel ${f.channel}` : 'Unavailable') : '';
              return <div class={cls('so-row', tab === 'friends' && f.online && 'online')} key={f.name}>
                <i class="so-dot" aria-label={f.online ? 'Online' : 'Offline'} />
                <div class="so-who"><b>{f.name}</b>{detail && <span>{detail}</span>}</div>
                {tab === 'friends' && <>
                  <button class="so-act" disabled={busy || !social.enabled || !f.online} title="Invite to party" onClick={() => void run('party', { action: 'invite', name: f.name })}><UiIcon name="party" size={18} /><span>Invite</span></button>
                  <button class="so-act" disabled={!social.enabled} title="Send a whisper" onClick={() => whisperTo(f.name)}><UiIcon name="chat" size={18} /><span>Whisper</span></button>
                  <button class="so-act" disabled={!social.enabled} title="Inspect equipped items" onClick={() => openInspection(f.name)}><UiIcon name="inspect" size={18} /><span>Inspect</span></button>
                </>}
                <button class="so-act so-remove" disabled={busy || !social.supported} title={tab === 'friends' ? 'Remove from friends' : tab === 'blocked' ? 'Unblock' : 'Unmute'}
                  onClick={() => void act(tab === 'friends' ? 'remove' : tab === 'blocked' ? 'unblock' : 'unmute', { name: f.name })}><IconClose size={12} /><span>{tab === 'friends' ? 'Remove' : tab === 'blocked' ? 'Unblock' : 'Unmute'}</span></button>
              </div>;
            })}
            {!list.length && <div class="so-empty"><UiIcon name="social" size={34} /><b>No names on this list</b><span>{tab === 'friends' ? 'Add a character above, or invite someone from a party to find them here.' : 'Nobody here.'}</span></div>}
          </div>
          {pages > 1 && <div class="so-pages"><button class="btn sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button class="btn sm" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}
        </>}

        {tab === 'privacy' && <>
          <div class="co-bar"><h3>Privacy</h3><span class="co-sub">Saved with this character; other characters have their own lists.</span></div>
          <div class="so-cards">
            <section class="so-card">
              <h4>Share online presence</h4>
              <Segmented value={social.presence} disabled={busy || !social.supported}
                options={[{ id: 'contacts', label: 'Mutual friends' }, { id: 'hidden', label: 'Hidden' }]}
                onPick={v => void act('privacy', { presence: v, whispers: social.whispers })} />
              <p>Only friends who have also added you see your level, zone and channel. Hidden does not conceal your hero in the world or your existing party frame.</p>
            </section>
            <section class="so-card">
              <h4>Who can whisper to you</h4>
              <Segmented value={social.whispers} disabled={busy || !social.supported} options={who} onPick={v => void act('privacy', { presence: social.presence, whispers: v })} />
              <p>Blocked names can never message or invite you. Muted names have their messages hidden.</p>
            </section>
            <section class="so-card">
              <h4>Who can inspect your gear</h4>
              <Segmented value={social.inspect} disabled={busy || !social.supported} options={who} onPick={v => void act('privacy', { presence: social.presence, whispers: social.whispers, inspect: v })} />
              <p>Inspection shares equipped item details only. Your bag, stash, currency and quest history stay private.</p>
            </section>
            <section class="so-card">
              <h4>Nameplate title</h4>
              <div class="so-titles">
                <button class={cls('co-slot', !char?.social?.title && 'on')} disabled={busy} onClick={() => void act('title', { title: '' })}>No title</button>
                {char && unlockedTitles(char).map(t => <button key={t.id} class={cls('co-slot', char.social?.title === t.id && 'on')} disabled={busy} onClick={() => void act('title', { title: t.id })}>{t.name}</button>)}
              </div>
              <p>More titles are earned through story milestones. Titles are cosmetic.</p>
            </section>
          </div>
        </>}

        <div class="so-chat">
          <div class="so-chat-row">
            <span class="so-chat-l">Chat</span>
            {CHANNELS.map(ch => <button key={ch} class="chip so-chip" onClick={() => { togglePanel('social', false); ui.set({ chatChannel: ch, chatTarget: '', chatOpen: true }); }}>{ch === 'lfg' ? 'LFG' : ch}</button>)}
            <span class="so-chat-tip">Press Enter to chat · /w Name whispers · /p reaches your party</span>
          </div>
          <div class="so-chat-row">
            <span class="so-chat-l">Emotes</span>
            {Object.keys(EMOTES).map(key => <button key={key} class="chip so-chip" onClick={() => sendChat('/' + key)}>{key}</button>)}
          </div>
        </div>
      </div>
    </div>
  </PanelFrame>;
}
