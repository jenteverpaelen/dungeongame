// Staff tools in chat (owner 2026-10-13: "make slapbox account the developer account with a cool symbol and tags and
// colours in chat and give moderation tools"). Staff accounts come only from the server's STAFF_ACCOUNTS setting, never
// from the client. Every mute, ban and resolve goes through the community ledger with its reason, audited like the owner
// CLI (scripts/community-admin.ts); kicks and announcements are logged to the server console.
import { randomUUID } from 'node:crypto';
import type { Community } from './community';
import type { Session } from './net/session';

export const STAFF_HELP = [
  'Staff commands:',
  '/announce TEXT — a notice for everyone online',
  '/who — who is online and where',
  '/kick NAME [REASON] — disconnect a hero',
  '/mute NAME MINUTES REASON — no chat (0 minutes = until lifted) · /unmute NAME REASON',
  '/ban NAME MINUTES REASON — no login, kicks now (0 = until lifted) · /unban NAME REASON',
  '/reports — open player reports · /resolve REPORT-ID REASON',
];

const sys = (s: Session, text: string) => s.send({ t: 'chat', ch: 'system', text });
const find = (sessions: () => Iterable<Session>, name: string) => [...sessions()].find(p => p.save?.name.toLowerCase() === name.toLowerCase());

/** Handles a staff slash command; returns false when the text is not one (it is then sent as a normal message). */
export function staffCommand(s: Session, raw: string, sessions: () => Iterable<Session>, community?: Community): boolean {
  const m = /^\/([a-z]+)\s*(.*)$/i.exec(raw.trim());
  if (!m) return false;
  const cmd = m[1].toLowerCase(), rest = m[2].trim(), args = rest.split(/\s+/).filter(Boolean);
  const who = s.save?.name ?? '?';
  switch (cmd) {
    case 'staff': case 'mod': case 'help':
      for (const line of STAFF_HELP) sys(s, line);
      return true;
    case 'announce': {
      if (!rest) { sys(s, 'Usage: /announce TEXT'); return true; }
      const text = rest.slice(0, 200);
      console.log(`[staff] ${who} announced: ${text}`);
      for (const p of sessions()) p.send({ t: 'chat', ch: 'system', text: `Announcement: ${text}`, role: 'dev', from: who });
      return true;
    }
    case 'who': {
      const list = [...sessions()].filter(p => p.save).map(p => `${p.save.name} (${p.save.classId} ${p.save.level}, ${p.rec?.zoneId ?? 'loading'})`);
      sys(s, `${list.length} online: ${list.join(' · ') || 'nobody'}`);
      return true;
    }
    case 'kick': {
      const target = args[0];
      if (!target) { sys(s, 'Usage: /kick NAME [REASON]'); return true; }
      const peer = find(sessions, target);
      if (!peer) { sys(s, `${target} is not online`); return true; }
      const reason = args.slice(1).join(' ');
      console.log(`[staff] ${who} kicked ${peer.save.name}${reason ? `: ${reason}` : ''}`);
      peer.kick(`Disconnected by staff${reason ? `: ${reason}` : ''}`);
      sys(s, `Kicked ${peer.save.name}`);
      return true;
    }
    case 'mute': case 'ban': case 'unmute': case 'unban': {
      if (!community) { sys(s, 'Moderation is unavailable on this server'); return true; }
      const lift = cmd.startsWith('un');
      const target = args[0], minutes = lift ? undefined : Number(args[1]), reason = args.slice(lift ? 1 : 2).join(' ');
      if (!target || !reason || (!lift && !Number.isSafeInteger(minutes))) { sys(s, lift ? `Usage: /${cmd} NAME REASON` : `Usage: /${cmd} NAME MINUTES REASON`); return true; }
      void community.owner(randomUUID(), { action: cmd, target, ...(lift ? {} : { minutes }), reason: `${reason} (by ${who})` }).then(r => {
        if (!r.ok) { sys(s, r.err ?? 'That did not work'); return; }
        console.log(`[staff] ${who} ${cmd} ${target}${lift ? '' : ` ${minutes} min`}: ${reason}`);
        if (cmd === 'ban') find(sessions, target)?.kick('This character is suspended. Contact the owner.');
        sys(s, `${cmd[0].toUpperCase() + cmd.slice(1)}: ${target}${lift ? '' : minutes === 0 ? ' until lifted' : ` for ${minutes} min`}`);
      });
      return true;
    }
    case 'reports': {
      const open = community?.openReports() ?? [];
      if (!open.length) { sys(s, 'No open reports'); return true; }
      sys(s, `${open.length} open report(s)${open.length > 8 ? ', newest 8' : ''}:`);
      for (const r of open.slice(-8)) sys(s, `${r.id.slice(0, 8)} · ${r.target} · ${r.category} · ${new Date(r.at).toISOString().slice(0, 16).replace('T', ' ')} · ${r.description.slice(0, 80)}`);
      return true;
    }
    case 'resolve': {
      if (!community) { sys(s, 'Moderation is unavailable on this server'); return true; }
      const prefix = args[0], reason = args.slice(1).join(' ');
      if (!prefix || !reason) { sys(s, 'Usage: /resolve REPORT-ID REASON'); return true; }
      const matches = community.openReports().filter(r => r.id.startsWith(prefix));
      if (matches.length !== 1) { sys(s, matches.length ? 'That id matches more than one report; use more characters' : 'No open report with that id'); return true; }
      void community.owner(randomUUID(), { action: 'resolve', target: matches[0].id, reason: `${reason} (by ${who})` }).then(r => sys(s, r.ok ? `Resolved ${prefix}` : r.err ?? 'That did not work'));
      return true;
    }
    default:
      return false;
  }
}
