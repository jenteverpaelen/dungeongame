// Build codes on the client (build tools T5): the chat card for an HF1 code (decoded by the server, shown here), its
// Apply / Copy buttons, and the copy / paste row in the Skills window. Applying goes to the server (op `applyBuild`),
// which uses the loadout rules: the skill part only, in town, skipping what this hero may not use. Gear is shown, never
// granted.

import { useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { LEGENDARIES, SETS } from '@shared/data/items';
import { SKILLS } from '@shared/data/skills';
import { PASSIVES } from '@shared/passives';
import { BUILD_CODE_RE, encodeBuild, type BuildCode } from '@shared/buildCode';
import { pushNotice, useUI, type ChatLine } from '../store';
import { textTipHandlers } from './tooltip';
import { run } from './util';

const skillName = (id: string | null) => (id ? SKILLS[id]?.name ?? id : '');

/** The card's tooltip: every part of the build, in reading order. */
export function buildLines(b: BuildCode): string[] {
  const bar = [b.primary, ...b.slots].filter((s): s is string => !!s);
  const lines = bar.map((id) => {
    const rune = b.runes[id] ? SKILLS[id]?.runes.find((r) => r.id === b.runes[id])?.name : null;
    const ranks = Object.values(b.nodes[id] ?? {}).reduce((n, r) => n + r, 0);
    return `${skillName(id)}${rune ? ` · ${rune}` : ''}${b.tiers[id] ? ` · tier ${b.tiers[id]}` : ''}${ranks ? ` · ${ranks} specialization` : ''}`;
  });
  const passives = b.passives.filter((p): p is string => !!p).map((p) => PASSIVES.find((x) => x.id === p)?.name ?? p);
  if (passives.length) lines.push(`Passives: ${passives.join(', ')}`);
  const cube = b.cube.filter((c): c is string => !!c).map((c) => LEGENDARIES[c]?.name ?? c);
  if (cube.length) lines.push(`Cube: ${cube.join(', ')}`);
  const gear = b.gear.map((g) => (g.legendary ? LEGENDARIES[g.legendary]?.name : g.set ? `${SETS[g.set]?.name} piece` : '') ?? '').filter(Boolean);
  if (gear.length) lines.push(`Gear (shown, never granted): ${gear.join(', ')}`);
  return lines;
}

async function applyCode(code: string) {
  const r = await run<{ skipped?: string[] }>('applyBuild', { code });
  if (r.ok) pushNotice(r.data?.skipped?.length ? `Build applied; skipped: ${r.data.skipped.join('; ')}` : 'Build applied', r.data?.skipped?.length ? 'warn' : 'info');
}

/** A build code in chat: class, level and the bar, with Apply (same class only) and Copy. */
export function BuildCard({ l }: { l: ChatLine }) {
  const b = l.build!;
  const me = useUI((s) => s.char?.classId);
  const bar = [b.primary, ...b.slots].filter((s): s is string => !!s).map(skillName);
  return (
    <span class="chat-build interactive" {...textTipHandlers(() => ({ title: `${CLASSES[b.classId].name} build · level ${b.level}`, lines: buildLines(b), note: 'Apply sets your skills, runes, tiers, specialization and passives to this build (free, in Hearthmere). Gear is only shown.' }), `bc-${l.id}`)}>
      <b>[{CLASSES[b.classId].name} build L{b.level}]</b> <span class="chat-text">{bar.slice(0, 3).join(', ')}{bar.length > 3 ? ` +${bar.length - 3}` : ''}</span>
      {me === b.classId && <button class="chat-name interactive" onClick={() => void applyCode(l.text)}> · Apply</button>}
      <button class="chat-name interactive" onClick={() => { void navigator.clipboard?.writeText(l.text); pushNotice('Build code copied', 'info'); }}> · Copy</button>
    </span>
  );
}

/** Copy this hero's build code / paste one (Skills window). */
export function BuildCodeRow() {
  const char = useUI((s) => s.char);
  const [paste, setPaste] = useState('');
  if (!char) return null;
  const valid = BUILD_CODE_RE.test(paste.trim());
  return (
    <div class="sk-code" role="group" aria-label="Build code">
      <button class="btn sm" onClick={() => { const c = encodeBuild(char); void navigator.clipboard?.writeText(c); pushNotice('Build code copied — paste it in chat to share it', 'info'); }}
        {...textTipHandlers(() => ({ title: 'Copy build code', lines: [encodeBuild(char), 'Skills, runes, tiers, specialization, passives, Cube powers and the names of your legendary and set items (no stats). Paste it in chat to share it as a card.'] }), 'bc-copy')}>Copy build code</button>
      <input class="sk-lo-name sk-code-in" placeholder="Paste a build code" value={paste} onInput={(e) => setPaste(e.currentTarget.value)} aria-label="Build code to apply" />
      <button class="btn sm" disabled={!valid} onClick={() => { void applyCode(paste.trim()); setPaste(''); }}>Apply code</button>
    </div>
  );
}
