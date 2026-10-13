// On-screen prompts for party invites and friend adds (owner 2026-10-13: "are there pop ups on screen for friend request
// and party invites ... for like idk 30 secs to a min"). World of Warcraft asks at the top of the screen with Accept and
// Decline [K]; here a bar shows the 60 s an invite lasts (server/src/party.ts), and "X added you as a friend" offers
// Add back for FRIEND_NOTICE_MS. docs/rework/OWNER-LIST-2026-10-13.md batch 6.
import { useRef, useState } from 'preact/hooks';
import { FRIEND_NOTICE_MS } from '@shared/social';
import { useUI } from '../store';
import { run } from '../panels/util';
import { UiIcon } from './UiIcons';
import { useNow } from './util';

interface Prompt { key: string; kind: 'invite' | 'friend'; name: string; invite?: string; ms: number }

export function SocialPrompts() {
  const party = useUI((s) => s.party), social = useUI((s) => s.social);
  const invites = party?.incoming ?? [], adds = social?.requests ?? [];
  const now = useNow(200, invites.length + adds.length > 0);
  // First sight of each prompt, so the bar runs on this machine's clock.
  const seen = useRef(new Map<string, { at: number; ms: number }>());
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const all: Prompt[] = [
    ...invites.map((i) => ({ key: `invite:${i.id}`, kind: 'invite' as const, name: i.from, invite: i.id, ms: Math.max(1000, i.expiresAt - (party?.now ?? i.expiresAt)) })),
    ...adds.map((name) => ({ key: `friend:${name}`, kind: 'friend' as const, name, ms: FRIEND_NOTICE_MS })),
  ];
  const rows = all.filter((p) => !done.has(p.key)).slice(0, 3);
  if (!rows.length) return null;
  const close = (key: string) => setDone((d) => new Set(d).add(key));
  const act = async (p: Prompt, op: 'party' | 'social', args: Record<string, unknown>) => {
    setBusy(p.key);
    try { await run(op, args); } finally { setBusy(null); close(p.key); }
  };
  return (
    <div class="social-prompts interactive" role="region" aria-label="Invitations">
      {rows.map((p) => {
        let s = seen.current.get(p.key);
        if (!s) seen.current.set(p.key, (s = { at: now, ms: p.ms }));
        const left = Math.max(0, 1 - (now - s.at) / s.ms);
        return (
          <div key={p.key} class={`sp-card ${p.kind}`} role="alertdialog" aria-label={p.kind === 'invite' ? `${p.name} invites you to their party` : `${p.name} added you as a friend`}>
            <span class="sp-icon"><UiIcon name="party" size={18} /></span>
            <p>{p.kind === 'invite' ? <><b>{p.name}</b> invites you to their party</> : <><b>{p.name}</b> added you as a friend</>}</p>
            <span class="sp-acts">
              {p.kind === 'invite'
                ? <>
                  <button class="btn sm primary" disabled={busy === p.key} onClick={() => void act(p, 'party', { action: 'accept', invite: p.invite })}>Accept</button>
                  <button class="btn sm" disabled={busy === p.key} onClick={() => void act(p, 'party', { action: 'decline', invite: p.invite })}>Decline</button>
                </>
                : <>
                  <button class="btn sm primary" disabled={busy === p.key} onClick={() => void act(p, 'social', { action: 'add', name: p.name })}>Add back</button>
                  <button class="btn sm" onClick={() => close(p.key)}>Dismiss</button>
                </>}
            </span>
            <i class="sp-time" style={{ transform: `scaleX(${left})` }} aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}
