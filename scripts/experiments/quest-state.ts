/** C065 research experiment only. No production imports or live save integration. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Objective, Quest } from './quest-authoring';

export interface ProbeItem { id: string; type: string }
export interface QuestRun {
  definition: Quest;
  revision: string;
  fingerprint: string;
  status: 'active' | 'ready' | 'claimed';
  progress: { id: string; count: number }[];
}
export interface ActorState {
  id: string;
  capacity: number;
  inventory: ProbeItem[];
  acquiredIds: string[]; // Unbounded history is deliberate probe scope, not a production policy.
  xp: number;
  gold: number;
  unlocks: string[];
  runs: QuestRun[];
}
export type QualifiedEvent = { actor: string; quest: string; objective: string } & (
  | { kind: 'kill'; zone: string; monster: string }
  | { kind: 'collect'; item: ProbeItem }
  | { kind: 'reach'; location: string }
  | { kind: 'talk'; npc: string; dialogue: string }
  | { kind: 'service'; npc: string; operation: string }
  | { kind: 'rift'; difficulty: number }
  | { kind: 'deliver'; npc: string; item: string }
  | { kind: 'wave'; encounter: string }
);
export type ProbeCommand =
  | { kind: 'accept'; definition: Quest; revision: string }
  | { kind: 'credit'; event: QualifiedEvent }
  | { kind: 'claim'; quest: string };
export type ProbeResult = { ok: true; state: 'accepted' | 'ignored' | 'credited' | 'claimed' | 'already-claimed' }
  | { ok: false; reason: string };
export type CutPoint = 'after-actor' | 'before-commit' | 'after-commit';

class Refused extends Error {}
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Refused(message);
}
function integer(value: number, min = 0) {
  requireThat(Number.isSafeInteger(value) && value >= min, 'invalid integer');
  return value;
}
function key(value: string) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value, 'invalid ID');
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, ordered(v)]));
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
function target(objective: Objective) { return 'count' in objective ? integer(objective.count, 1) : 1; }
function refresh(run: QuestRun) {
  if (run.status !== 'claimed') run.status = run.definition.objectives.every(o => run.progress.find(p => p.id === o.id)!.count >= target(o)) ? 'ready' : 'active';
}
function matches(objective: Objective, event: QualifiedEvent): boolean {
  if (objective.kind !== event.kind) return false;
  switch (objective.kind) {
    case 'kill': return event.kind === 'kill' && objective.zone === event.zone && objective.monster === event.monster;
    case 'collect': return event.kind === 'collect' && objective.item === event.item.type;
    case 'reach': return event.kind === 'reach' && objective.location === event.location;
    case 'talk': return event.kind === 'talk' && objective.npc === event.npc && objective.dialogue === event.dialogue;
    case 'service': return event.kind === 'service' && objective.npc === event.npc && objective.operation === event.operation;
    case 'rift': return event.kind === 'rift' && integer(event.difficulty) >= objective.minDifficulty;
    case 'deliver': return event.kind === 'deliver' && objective.npc === event.npc && objective.item === event.item;
    case 'wave': return event.kind === 'wave' && objective.encounter === event.encounter;
  }
}

/** Trusted fixture definitions/events only. Not a parser, authentication layer or network endpoint. */
export class QuestStateProbe {
  readonly db: DatabaseSync;
  private closed = false;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0');
    assert.equal(this.db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
    assert.equal(this.db.prepare('PRAGMA synchronous').get()!.synchronous, 2);
    assert.equal(this.db.prepare('PRAGMA foreign_keys').get()!.foreign_keys, 1);
    assert.equal(this.db.prepare('PRAGMA busy_timeout').get()!.timeout, 0);
    this.db.exec(`CREATE TABLE IF NOT EXISTS actors(id TEXT PRIMARY KEY, body TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS receipts(actor TEXT NOT NULL REFERENCES actors(id), request TEXT NOT NULL,
        fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor,request)) STRICT;`);
  }
  seed(actor: ActorState) {
    key(actor.id); integer(actor.capacity); integer(actor.xp); integer(actor.gold);
    requireThat(actor.inventory.length <= actor.capacity, 'inventory full');
    requireThat(new Set(actor.inventory.map(i => i.id)).size === actor.inventory.length, 'duplicate inventory ID');
    requireThat(actor.inventory.every(i => actor.acquiredIds.includes(i.id)), 'missing ownership history');
    this.db.prepare('INSERT INTO actors VALUES(?,?)').run(actor.id, JSON.stringify(actor));
  }
  actor(id: string): ActorState {
    const row = this.db.prepare('SELECT body FROM actors WHERE id=?').get(id);
    requireThat(row, 'unknown actor');
    return JSON.parse(row.body as string);
  }
  snapshot() {
    assert.equal(this.db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    assert.deepEqual(this.db.prepare('PRAGMA foreign_key_check').all(), []);
    return {
      actors: this.db.prepare('SELECT * FROM actors ORDER BY id').all().map(row => ({ ...row })),
      receipts: this.db.prepare('SELECT * FROM receipts ORDER BY actor,request').all().map(row => ({ ...row })),
    };
  }
  close() { if (!this.closed) { this.db.close(); this.closed = true; } }

  async execute(actorId: string, request: string, command: ProbeCommand,
    checkpoint: (point: CutPoint) => Promise<void> = async () => {}): Promise<ProbeResult> {
    let transaction = false;
    try {
      key(actorId); key(request);
      const fingerprint = hash(command);
      this.db.exec('BEGIN IMMEDIATE'); transaction = true;
      const receipt = this.db.prepare('SELECT * FROM receipts WHERE actor=? AND request=?').get(actorId, request);
      if (receipt) {
        requireThat(receipt.fingerprint === fingerprint, 'changed intent');
        this.db.exec('ROLLBACK'); transaction = false;
        return JSON.parse(receipt.result as string);
      }
      const actor = this.actor(actorId);
      const result = this.apply(actor, command);
      this.db.prepare('UPDATE actors SET body=? WHERE id=?').run(JSON.stringify(actor), actorId);
      await checkpoint('after-actor');
      this.db.prepare('INSERT INTO receipts VALUES(?,?,?,?)').run(actorId, request, fingerprint, JSON.stringify(result));
      await checkpoint('before-commit');
      this.db.exec('COMMIT'); transaction = false;
      await checkpoint('after-commit');
      return result;
    } catch (error) {
      if (transaction) this.db.exec('ROLLBACK');
      if (error instanceof Refused) return { ok: false, reason: error.message };
      throw error;
    }
  }

  private apply(actor: ActorState, command: ProbeCommand): ProbeResult {
    if (command.kind === 'accept') {
      const definition = command.definition;
      key(definition.id); key(command.revision);
      const fingerprint = hash([command.revision, definition]);
      const prior = actor.runs.find(r => r.definition.id === definition.id);
      if (prior) {
        requireThat(prior.fingerprint === fingerprint, 'definition changed');
        return { ok: true, state: 'accepted' };
      }
      requireThat(definition.objectives.length > 0, 'empty objectives');
      requireThat(new Set(definition.objectives.map(o => o.id)).size === definition.objectives.length, 'duplicate objective');
      definition.objectives.forEach(target);
      requireThat(definition.requires.every(id => actor.runs.some(r => r.definition.id === id && r.status === 'claimed')), 'prerequisite');
      actor.runs.push({ definition: structuredClone(definition), revision: command.revision, fingerprint,
        status: 'active', progress: definition.objectives.map(o => ({ id: o.id, count: 0 })) });
      return { ok: true, state: 'accepted' };
    }
    if (command.kind === 'credit') {
      const event = command.event;
      requireThat(event.actor === actor.id, 'wrong actor');
      const run = actor.runs.find(r => r.definition.id === event.quest);
      if (!run || run.status !== 'active') return { ok: true, state: 'ignored' };
      const objective = run.definition.objectives.find(o => o.id === event.objective);
      if (!objective || !matches(objective, event)) return { ok: true, state: 'ignored' };
      const progress = run.progress.find(p => p.id === objective.id)!;
      if (progress.count >= target(objective)) return { ok: true, state: 'ignored' };
      if (event.kind === 'collect') {
        key(event.item.id);
        requireThat(!actor.acquiredIds.includes(event.item.id), 'already acquired');
        requireThat(actor.inventory.length < actor.capacity, 'inventory full');
        actor.inventory.push(structuredClone(event.item)); actor.acquiredIds.push(event.item.id);
      }
      if (objective.kind === 'deliver') {
        const selected = actor.inventory.filter(item => item.type === objective.item).slice(0, objective.count);
        requireThat(selected.length === objective.count, 'missing delivery items');
        const ids = new Set(selected.map(item => item.id));
        actor.inventory = actor.inventory.filter(item => !ids.has(item.id));
        progress.count = objective.count;
      } else progress.count++;
      refresh(run);
      return { ok: true, state: 'credited' };
    }
    const run = actor.runs.find(r => r.definition.id === command.quest);
    requireThat(run, 'unknown quest');
    if (run.status === 'claimed') return { ok: true, state: 'already-claimed' };
    requireThat(run.status === 'ready', 'not ready');
    const reward = run.definition.reward;
    integer(reward.xp); integer(reward.gold);
    const itemCount = reward.items.reduce((sum, item) => integer(sum + integer(item.count, 1)), 0);
    requireThat(itemCount <= actor.capacity - actor.inventory.length, 'inventory full');
    const items: ProbeItem[] = [];
    for (const item of reward.items) for (let i = 0; i < item.count; i++) {
      const id = `reward:${hash([actor.id, run.definition.id, run.fingerprint, items.length])}`;
      requireThat(!actor.acquiredIds.includes(id), 'reward ID conflict');
      items.push({ id, type: item.item });
    }
    actor.xp = integer(actor.xp + reward.xp); actor.gold = integer(actor.gold + reward.gold);
    actor.inventory.push(...items); actor.acquiredIds.push(...items.map(i => i.id));
    actor.unlocks = [...new Set([...actor.unlocks, ...reward.unlocks])];
    run.status = 'claimed';
    return { ok: true, state: 'claimed' };
  }
}
