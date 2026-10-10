// Party: roster of up to four, invitations, and the public group finder. HUD party frames live at the bottom of this file.

import { useEffect, useState } from 'preact/hooks';
import { PARTY_ACTIVITIES, type PartyDirectory } from '@shared/party';
import { PARTY_MAX } from '@shared/constants';
import { ZONES } from '@shared/data/zones';
import { CLASSES } from '@shared/data/classes';
import { togglePanel, useUI } from '../store';
import { PanelFrame } from './common';
import { cls, run } from './util';
import { ClassEmblem } from '../hud/Glyphs';
import { UiIcon, type UiIconName } from '../hud/UiIcons';

type Tab = 'members' | 'invitations' | 'directory';
const hex = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

export function PartyPanel() {
  const party = useUI(s => s.party);
  const [tab, setTab] = useState<Tab>(() => (party?.incoming.length ? 'invitations' : 'members'));
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [directory, setDirectory] = useState<PartyDirectory | null>(null);
  const browse = async (page = 0) => { setBusy(true); try { const r = await run('party', { action: 'browse', page }); if (r.ok) setDirectory(r.data as PartyDirectory); } finally { setBusy(false); } };
  useEffect(() => { if (tab === 'directory') void browse(); }, [tab]);
  if (!party) return <PanelFrame id="party" title="Party" width={900}><p>Waiting for party information…</p></PanelFrame>;
  const lead = party.you === party.leader && !!party.id;
  const act = async (action: string, args: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const result = await run('party', { action, ...args });
      if (result.ok && action === 'invite') setName('');
      if (result.ok && action === 'join') setTab('members');
    } finally { setBusy(false); }
  };
  const nav: { id: Tab; label: string; icon: UiIconName; badge?: number }[] = [
    { id: 'members', label: 'Members', icon: 'party', badge: party.members.length },
    { id: 'invitations', label: 'Invitations', icon: 'scroll', badge: party.incoming.length },
    { id: 'directory', label: 'Find group', icon: 'map' },
  ];
  const canInvite = (!party.id || lead);
  return <PanelFrame id="party" title="Party" width={900} sub={party.id ? `${party.members.length} / ${PARTY_MAX} members` : 'Not in a party'}>
    <div class="co so">
      <nav class="co-nav" role="tablist" aria-label="Party sections">
        {nav.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} class={cls('co-tab', tab === t.id && 'on')} onClick={() => setTab(t.id)}>
          <UiIcon name={t.icon} size={20} /><span>{t.label}</span>{t.badge !== undefined && (t.badge > 0 || t.id !== 'invitations') && <em>{t.badge}</em>}
        </button>)}
        {party.id && <button class="btn sm so-guild" disabled={busy} onClick={() => void act('leave')}>Leave party</button>}
      </nav>
      <div class="co-body">
        {!party.enabled && <p class="so-warn">New party actions are disabled in this channel. You can still leave or decline an invitation.</p>}

        {tab === 'members' && <>
          <div class="co-bar"><h3>Your group</h3><span class="co-sub">{party.id ? 'Personal loot and nearby experience rules stay in effect.' : 'Invite an online character to travel as a group. Each player chooses whether to join.'}</span></div>
          <div class="pt-members">
            {party.members.map(m => {
              const theme = hex(CLASSES[m.classId].themeColor);
              return <article class={cls('pt-member', !m.online && 'off', m.dead && 'dead')} key={m.key} style={{ '--cls': theme }}>
                <span class="pt-emblem"><ClassEmblem classId={m.classId} /></span>
                <div class="pt-main">
                  <header>
                    <b>{m.name}</b>
                    {m.key === party.leader && <span class="chip lead" title="Party leader"><UiIcon name="star" size={12} /> Leader</span>}
                    {m.key === party.you && <span class="chip">You</span>}
                    <em>Level {m.level}</em>
                  </header>
                  <span class="pt-where">{m.online ? `${ZONES[m.zone ?? '']?.name ?? 'Travelling'}${m.channel ? ` · Channel ${m.channel}` : ''}` : 'Reconnecting…'}</span>
                  {m.online && <div class="pt-life" role="img" aria-label={m.dead ? 'Defeated' : `${Math.round((m.hp ?? 0) * 100)}% life`}>
                    <i style={{ width: `${Math.max(0, Math.min(1, m.hp ?? 0)) * 100}%` }} />
                    <span>{m.dead ? 'Defeated' : m.hp === null ? 'Travelling' : `${Math.round(m.hp * 100)}% life`}</span>
                  </div>}
                </div>
                {lead && m.key !== party.you && <div class="pt-ctl">
                  <button class="btn sm" disabled={busy || !party.enabled || !m.online} onClick={() => void act('leader', { member: m.key })}>Make leader</button>
                  <button class="btn sm" disabled={busy || !party.enabled} onClick={() => void act('kick', { member: m.key })}>Remove</button>
                </div>}
              </article>;
            })}
            {!party.id && <div class="so-empty"><UiIcon name="party" size={38} /><b>You are not in a party</b><span>Invite a friend below, or find an open group.</span></div>}
          </div>
          {canInvite && <form class="so-add" onSubmit={e => { e.preventDefault(); void act('invite', { name }); }}>
            <input maxLength={16} value={name} placeholder="Online character name" aria-label="Online character name" onInput={e => setName(e.currentTarget.value)} autoComplete="off" />
            <button class="btn primary" disabled={busy || !party.enabled || !name.trim() || party.members.length >= PARTY_MAX}>Invite</button>
          </form>}
          {canInvite && <section class="so-card">
            <h4>Public group listing</h4>
            <div class="pt-list-row">
              {PARTY_ACTIVITIES.map(activity => <button key={activity} class={cls('co-slot', party.listing === activity && 'on')} disabled={busy || !party.enabled} onClick={() => void act('list', { activity })}>List for {activity}</button>)}
              {party.listing && <button class="btn sm" disabled={busy} onClick={() => void act('unlist')}>Unlist</button>}
            </div>
            <p>Listing shares your name, level, zone and channel. Anyone you have not blocked can join while a place is free; players still travel themselves. Invitations and disconnected places last 60 seconds, and an online member takes over if the leader disconnects.</p>
          </section>}
        </>}

        {tab === 'invitations' && <>
          <div class="co-bar"><h3>Invitations</h3><span class="co-sub">Invitations expire after 60 seconds. Leave your current party before accepting.</span></div>
          <div class="so-list">
            {party.incoming.map(i => <div class="so-row online" key={i.id}>
              <i class="so-dot" />
              <div class="so-who"><b>{i.from}</b><span>invited you to their party</span></div>
              <button class="btn primary" disabled={busy || !!party.id || !party.enabled} onClick={() => void act('accept', { invite: i.id })}>Accept</button>
              <button class="btn" disabled={busy} onClick={() => void act('decline', { invite: i.id })}>Decline</button>
            </div>)}
            {party.outgoing.map(i => <div class="so-row" key={i.id}>
              <i class="so-dot" />
              <div class="so-who"><b>{i.name}</b><span>waiting for a reply</span></div>
              <button class="btn" disabled={busy} onClick={() => void act('cancel', { invite: i.id })}>Cancel</button>
            </div>)}
            {!party.incoming.length && !party.outgoing.length && <div class="so-empty"><UiIcon name="scroll" size={34} /><b>No pending invitations</b><span>Invitations you send or receive appear here.</span></div>}
          </div>
        </>}

        {tab === 'directory' && <>
          <div class="co-bar"><h3>Open groups</h3>
            <button class="btn sm" disabled={busy || !party.enabled} onClick={() => void browse(directory?.page)}>Refresh</button></div>
          <p class="co-sub">Join an openly listed group. Joining does not teleport you or unlock story routes. Full, unavailable and blocked groups are hidden.{party.id ? ' Leave your current party before joining another.' : ''}</p>
          <div class="so-list">
            {directory?.entries.map(entry => <div class="so-row online" key={entry.id}>
              <i class="so-dot" />
              <div class="so-who"><b>{entry.leader} · {entry.activity}</b><span>Level {entry.level} · {entry.members}/{PARTY_MAX} · {ZONES[entry.zone]?.name ?? entry.zone} · Channel {entry.channel}</span></div>
              <button class="btn primary" disabled={busy || !!party.id || !party.enabled} onClick={() => void act('join', { group: entry.id })}>Join</button>
            </div>)}
            {directory && !directory.entries.length && <div class="so-empty"><UiIcon name="map" size={34} /><b>No open groups right now</b><span>List your own from the Members section.</span></div>}
          </div>
          {directory && directory.pages > 1 && <div class="so-pages">
            <button class="btn sm" disabled={busy || directory.page === 0} onClick={() => void browse(directory.page - 1)}>Previous</button>
            <span>{directory.page + 1} / {directory.pages} · {directory.total} groups</span>
            <button class="btn sm" disabled={busy || directory.page === directory.pages - 1} onClick={() => void browse(directory.page + 1)}>Next</button>
          </div>}
        </>}
      </div>
    </div>
  </PanelFrame>;
}

/** Compact frames for the other members, docked under the player plate. Click opens the party panel. */
export function PartyFrames() {
  const party = useUI(s => s.party);
  if (!party) return null;
  const others = party.members.filter(m => m.key !== party.you);
  if (!others.length && !party.incoming.length) return null;
  return <div class="party-frames interactive">
    {party.incoming.length > 0 && <button class="pf-invite" onClick={() => togglePanel('party', true)}><UiIcon name="party" size={16} /> Party invitation{party.incoming.length > 1 ? `s · ${party.incoming.length}` : ''}</button>}
    {others.map(m => {
      const hp = m.online ? Math.max(0, Math.min(1, m.hp ?? 0)) : 0;
      const tone = m.dead ? 'dead' : hp < 0.3 ? 'low' : hp < 0.6 ? 'mid' : 'ok';
      return <button class={cls('party-frame', 'pf', !m.online && 'off', m.dead && 'dead')} key={m.key} style={{ '--cls': hex(CLASSES[m.classId].themeColor) }}
        title={`${m.name}, level ${m.level}${m.key === party.leader ? ', party leader' : ''}`} onClick={() => togglePanel('party', true)}>
        <span class="pf-emblem"><ClassEmblem classId={m.classId} /></span>
        <span class="pf-main">
          <span class="pf-name">{m.key === party.leader && <UiIcon name="star" size={11} />}{m.name}<em>{m.level}</em></span>
          <span class={cls('pf-bar', tone)}><i style={{ width: `${hp * 100}%` }} /><b>{!m.online ? 'Reconnecting' : m.dead ? 'Defeated' : hp === 0 && m.hp === null ? (ZONES[m.zone ?? '']?.name ?? 'Travelling') : `${Math.round(hp * 100)}%`}</b></span>
        </span>
      </button>;
    })}
  </div>;
}
