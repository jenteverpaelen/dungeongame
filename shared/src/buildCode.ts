// Build codes (build tools T5, docs/rework/depth/BUILD-TOOLS.md): "HF1." + base64url of a small versioned binary — class,
// level, primary, slots, each bar skill's rune / tier / specialization ranks, passives, Cube powers and the ids of
// equipped legendaries and set pieces (no affix values, no names). Ids are positions in an append-only registry
// (shared/src/data/buildCodeIds.json), so a code stays readable forever; a CRC-16 rejects typos. A code is applied
// through the same rules as loadouts (shared/src/loadouts.ts): the skill part only, never gear.

import REG from './data/buildCodeIds.json';
import { CLASSES } from './data/classes';
import { LEGENDARIES, SETS } from './data/items';
import { NODE_GRID, SKILLS, SKILL_SLOTS, skillsForClass } from './data/skills';
import { PASSIVES, PASSIVE_SLOT_LEVELS } from './passives';
import { savedNodeRanks } from './specialization';
import type { SkillSetup } from './loadouts';
import { SLOTS, type CharacterSave, type ClassId, type Slot } from './types';

export const BUILD_CODE_PREFIX = 'HF1.';
export const BUILD_CODE_VERSION = 1;
/** Matches a whole chat message that is a build code (the binary of a full build is ~55 bytes, ~80 characters). */
export const BUILD_CODE_RE = /^HF1\.[A-Za-z0-9_-]{8,240}$/;
const CELLS = NODE_GRID.cols * NODE_GRID.rows;

export interface BuildCode {
  version: number;
  classId: ClassId;
  level: number;
  primary: string;
  slots: (string | null)[];
  runes: Record<string, string | null>;
  tiers: Record<string, number>;
  nodes: Record<string, Record<string, number>>;
  passives: (string | null)[];
  cube: (string | null)[];
  gear: { slot: Slot; legendary?: string; set?: string }[];
}

// ───────────────────────── bytes ─────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function toB64url(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return out;
}
function fromB64url(s: string): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : -2));
    if (c.some((x) => x === -1) || c[1] < 0) return null;
    const n = (c[0] << 18) | (c[1] << 12) | (Math.max(0, c[2]) << 6) | Math.max(0, c[3]);
    out.push((n >> 16) & 255);
    if (c[2] >= 0) out.push((n >> 8) & 255);
    if (c[3] >= 0) out.push(n & 255);
  }
  return out;
}
/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). */
function crc16(bytes: number[]): number {
  let c = 0xffff;
  for (const b of bytes) { c ^= b << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff; }
  return c;
}
class Writer {
  bytes: number[] = [];
  u8(n: number) { this.bytes.push(n & 255); }
  varint(n: number) { do { let b = n & 127; n = Math.floor(n / 128); if (n) b |= 128; this.bytes.push(b); } while (n); }
}
class Reader {
  i = 0;
  constructor(private b: number[]) {}
  get left() { return this.b.length - this.i; }
  u8(): number { if (this.i >= this.b.length) throw new Error('short'); return this.b[this.i++]; }
  varint(): number { let n = 0, mul = 1; for (let k = 0; k < 5; k++) { const b = this.u8(); n += (b & 127) * mul; if (!(b & 128)) return n; mul *= 128; } throw new Error('varint'); }
}

const idx = (list: readonly string[], id: string | null | undefined) => (id ? list.indexOf(id) : -1);

// ───────────────────────── encode / decode ─────────────────────────

/** The build of a save as a code (skills, passives, Cube powers, equipped legendary and set ids). */
export function encodeBuild(save: CharacterSave): string {
  const w = new Writer();
  w.u8(BUILD_CODE_VERSION);
  w.u8(Math.max(0, idx(REG.classes, save.classId)));
  w.u8(Math.max(1, Math.min(255, save.level)));
  const skillIdx = (id: string | null) => idx(REG.skills, id);
  w.varint(Math.max(0, skillIdx(save.skills.primary)));
  const slots = Array.from({ length: SKILL_SLOTS }, (_, i) => save.skills.slots[i] ?? null);
  for (const s of slots) w.varint(skillIdx(s) + 1);
  for (const id of barSkills(save.skills.primary, slots)) {
    const rune = save.skills.runes[id];
    w.varint(rune ? idx(REG.runes, `${id}.${rune}`) + 1 : 0);
    const ranks = savedNodeRanks(save, id);
    let bits = Math.min(3, save.skills.tiers[id] ?? 0);
    for (const node of SKILLS[id]?.nodes ?? []) {
      const cell = node.pos.row * NODE_GRID.cols + node.pos.col, r = Math.min(3, node.maxRank, ranks[node.id] ?? 0);
      if (cell < CELLS && r > 0) bits |= r << (2 + cell * 2);
    }
    w.u8(bits & 255); w.u8((bits >> 8) & 255); w.u8((bits >> 16) & 255);
  }
  for (let i = 0; i < PASSIVE_SLOT_LEVELS.length; i++) w.varint(idx(REG.passives, save.passives?.slots[i] ?? null) + 1);
  for (let i = 0; i < 3; i++) w.varint(idx(REG.legendaries, save.cube.equipped[i] ?? null) + 1);
  const gear = SLOTS.flatMap((slot, si) => {
    const it = save.equipment[slot];
    const code = it?.legendary ? idx(REG.legendaries, it.legendary.power) * 2 : it?.set ? idx(REG.sets, it.set) * 2 + 1 : -1;
    return code >= 0 ? [[si, code] as const] : [];
  });
  w.varint(gear.length);
  for (const [si, code] of gear) { w.u8(si); w.varint(code); }
  const crc = crc16(w.bytes);
  w.u8(crc >> 8); w.u8(crc);
  return BUILD_CODE_PREFIX + toB64url(w.bytes);
}

function barSkills(primary: string, slots: readonly (string | null)[]): string[] {
  return [...new Set([primary, ...slots.filter((s): s is string => !!s)])];
}

/** Decode a code. Ids the registry no longer knows (or that come from a newer game) are reported, not guessed. */
export function decodeBuild(code: string): { ok: true; build: BuildCode; unknown: string[] } | { ok: false; err: string } {
  const text = code.trim();
  if (!text.startsWith(BUILD_CODE_PREFIX)) return { ok: false, err: 'Not a build code' };
  const bytes = fromB64url(text.slice(BUILD_CODE_PREFIX.length));
  if (!bytes || bytes.length < 8) return { ok: false, err: 'The build code is damaged' };
  const body = bytes.slice(0, -2), crc = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
  if (crc16(body) !== crc) return { ok: false, err: 'The build code is damaged (checksum)' };
  const unknown: string[] = [];
  try {
    const r = new Reader(body);
    const version = r.u8();
    if (version < 1) return { ok: false, err: 'Unknown build code version' };
    const classId = REG.classes[r.u8()] as ClassId | undefined;
    if (!classId || !CLASSES[classId]) return { ok: false, err: 'Unknown class in the build code' };
    const level = r.u8();
    const skill = (i: number) => { const id = REG.skills[i]; if (i >= 0 && (!id || !SKILLS[id])) unknown.push(`skill #${i}`); return id && SKILLS[id] ? id : null; };
    const primary = skill(r.varint()) ?? CLASSES[classId].primary;
    const slots = Array.from({ length: SKILL_SLOTS }, () => { const v = r.varint(); return v ? skill(v - 1) : null; });
    const runes: Record<string, string | null> = {}, tiers: Record<string, number> = {}, nodes: Record<string, Record<string, number>> = {};
    for (const id of barSkills(primary, slots)) {
      const rv = r.varint();
      if (rv) { const full = REG.runes[rv - 1]; const [sk, rune] = (full ?? '').split('.'); if (sk === id && SKILLS[id].runes.some((x) => x.id === rune)) runes[id] = rune; else unknown.push(`rune #${rv - 1}`); }
      const bits = r.u8() | (r.u8() << 8) | (r.u8() << 16);
      if (bits & 3) tiers[id] = bits & 3;
      for (const node of SKILLS[id].nodes ?? []) {
        const cell = node.pos.row * NODE_GRID.cols + node.pos.col, rank = (bits >> (2 + cell * 2)) & 3;
        if (cell < CELLS && rank > 0) (nodes[id] ??= {})[node.id] = Math.min(rank, node.maxRank);
      }
    }
    const passives = PASSIVE_SLOT_LEVELS.map(() => { const v = r.varint(); if (!v) return null; const id = REG.passives[v - 1]; if (!id || !PASSIVES.some((p) => p.id === id)) { unknown.push(`passive #${v - 1}`); return null; } return id; });
    const cube = [0, 1, 2].map(() => { const v = r.varint(); if (!v) return null; const id = REG.legendaries[v - 1]; if (!id || !LEGENDARIES[id]) { unknown.push(`power #${v - 1}`); return null; } return id; });
    const gear: BuildCode['gear'] = [];
    for (let n = r.varint(); n > 0; n--) {
      const slot = SLOTS[r.u8()], v = r.varint();
      const id = v % 2 ? REG.sets[(v - 1) / 2] : REG.legendaries[v / 2];
      if (!slot || !id || (v % 2 ? !SETS[id] : !LEGENDARIES[id])) { unknown.push(`item #${v}`); continue; }
      gear.push(v % 2 ? { slot, set: id } : { slot, legendary: id });
    }
    return { ok: true, build: { version, classId, level, primary, slots, runes, tiers, nodes, passives, cube, gear }, unknown };
  } catch {
    return { ok: false, err: 'The build code is damaged' };
  }
}

/** The skill part of a decoded build, for applySetup (shared/src/loadouts.ts). Gear is never applied. */
export function buildToSetup(b: BuildCode): SkillSetup {
  return { primary: b.primary, slots: b.slots, runes: b.runes, tiers: b.tiers, nodes: b.nodes, passives: b.passives };
}

/** Registry problems for the content check: every current id must have a position (append it with content-ids --update). */
export function buildCodeRegistryProblems(): string[] {
  const out: string[] = [];
  const need: [keyof typeof REG, string[]][] = [
    ['classes', Object.keys(CLASSES)], ['skills', Object.keys(SKILLS)], ['runes', Object.values(SKILLS).flatMap((s) => s.runes.map((r) => `${s.id}.${r.id}`))],
    ['passives', PASSIVES.map((p) => p.id)], ['legendaries', Object.keys(LEGENDARIES)], ['sets', Object.keys(SETS)],
  ];
  for (const [k, ids] of need) {
    const have = new Set(REG[k] as string[]);
    for (const id of ids) if (!have.has(id)) out.push(`build codes: ${k} "${id}" has no position in shared/src/data/buildCodeIds.json; run npx tsx scripts/content-ids.ts --update`);
    if (have.size !== (REG[k] as string[]).length) out.push(`build codes: ${k} lists an id twice`);
  }
  return out;
}

/** Ids of all of a class's skills (used by the chat card). */
export const classSkillIds = (classId: ClassId) => skillsForClass(classId).map((s) => s.id);
