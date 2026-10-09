/** C051 research prototype. No imports from, or registration in, the live game. */
export type Objective = { id: string; text: string } & (
  | { kind: 'kill'; zone: string; monster: string; count: number }
  | { kind: 'collect'; item: string; count: number }
  | { kind: 'reach'; location: string }
  | { kind: 'talk'; npc: string; dialogue: string }
  | { kind: 'service'; npc: string; operation: string }
  | { kind: 'rift'; minDifficulty: number }
  | { kind: 'deliver'; npc: string; item: string; count: number }
  | { kind: 'wave'; encounter: string; count: number }
);
export interface Quest {
  id: string;
  title: string;
  requires: string[]; // All required; alternative/repeat prerequisites are outside this probe.
  objectives: Objective[];
  reward: { xp: number; gold: number; items: { item: string; count: number }[]; unlocks: string[] };
}
export interface Catalogue {
  messages: Record<string, string>;
  zones: Set<string>;
  monsters: Set<string>;
  items: Set<string>;
  locations: Set<string>;
  npcs: Map<string, Set<string>>; // Explicit supported operations at each synthetic NPC.
  dialogues: Set<string>;
  encounters: Set<string>;
  unlocks: Set<string>;
  objectiveKinds: Set<Objective['kind']>;
  flags: Set<string>;
}
export interface Dialogue {
  id: string;
  start: string;
  nodes: {
    id: string;
    text: string;
    terminal: boolean;
    choices: { id: string; text: string; to: string; when: { flag: string; equals: boolean }[] }[];
  }[];
}
export interface ProbeState { id: string; facts: Record<string, boolean> }

function checks(errors: string[], messages: Record<string, string>) {
  const fail = (path: string, message: string) => { errors.push(`${path}: ${message}`); };
  return {
    fail,
    ids(values: string[], path: string) {
      const seen = new Set<string>();
      for (const id of values) {
        if (!id || id !== id.trim()) fail(path, 'IDs must be nonempty and trimmed');
        if (seen.has(id)) fail(path, `duplicate ID ${id}`);
        seen.add(id);
      }
    },
    text(key: string, path: string) {
      if (!Object.hasOwn(messages, key) || typeof messages[key] !== 'string' || !messages[key].trim())
        fail(path, `missing/empty message ${key}`);
    },
    quantity(value: number, min: number, path: string) {
      if (!Number.isSafeInteger(value) || value < min) fail(path, `expected safe integer >= ${min}`);
    },
    ref(values: Set<string> | Map<string, unknown>, id: string, path: string) {
      if (!values.has(id)) fail(path, `unknown reference ${id}`);
    },
  };
}

export function validateQuests(quests: Quest[], catalogue: Catalogue): string[] {
  const errors: string[] = [], c = checks(errors, catalogue.messages);
  c.ids(quests.map(q => q.id), 'quests');
  const ids = new Set(quests.map(q => q.id));
  for (const q of quests) {
    const at = `quest.${q.id}`;
    c.text(q.title, `${at}.title`);
    c.ids(q.requires, `${at}.requires`);
    q.requires.forEach(id => c.ref(ids, id, `${at}.requires`));
    if (!q.objectives.length) c.fail(`${at}.objectives`, 'must declare at least one objective');
    c.ids(q.objectives.map(o => o.id), `${at}.objectives`);
    for (const o of q.objectives) {
      const path = `${at}.${o.id}`;
      c.text(o.text, `${path}.text`);
      c.ref(catalogue.objectiveKinds, o.kind, `${path}.kind`);
      switch (o.kind) {
        case 'kill':
          c.ref(catalogue.zones, o.zone, `${path}.zone`);
          c.ref(catalogue.monsters, o.monster, `${path}.monster`);
          c.quantity(o.count, 1, `${path}.count`); break;
        case 'collect':
          c.ref(catalogue.items, o.item, `${path}.item`);
          c.quantity(o.count, 1, `${path}.count`); break;
        case 'reach': c.ref(catalogue.locations, o.location, `${path}.location`); break;
        case 'talk':
          c.ref(catalogue.npcs, o.npc, `${path}.npc`);
          c.ref(catalogue.dialogues, o.dialogue, `${path}.dialogue`); break;
        case 'service':
          c.ref(catalogue.npcs, o.npc, `${path}.npc`);
          if (!catalogue.npcs.get(o.npc)?.has(o.operation))
            c.fail(`${path}.operation`, 'operation unavailable at this NPC');
          break;
        case 'rift': c.quantity(o.minDifficulty, 0, `${path}.minDifficulty`); break;
        case 'deliver':
          c.ref(catalogue.npcs, o.npc, `${path}.npc`);
          c.ref(catalogue.items, o.item, `${path}.item`);
          c.quantity(o.count, 1, `${path}.count`); break;
        case 'wave':
          c.ref(catalogue.encounters, o.encounter, `${path}.encounter`);
          c.quantity(o.count, 1, `${path}.count`); break;
        default: { const unsupported: never = o; c.fail(path, `unsupported objective ${String(unsupported)}`); }
      }
    }
    c.quantity(q.reward.xp, 0, `${at}.reward.xp`);
    c.quantity(q.reward.gold, 0, `${at}.reward.gold`);
    c.ids(q.reward.items.map(i => i.item), `${at}.reward.items`);
    for (const i of q.reward.items) {
      c.ref(catalogue.items, i.item, `${at}.reward.item`);
      c.quantity(i.count, 1, `${at}.reward.count`);
    }
    c.ids(q.reward.unlocks, `${at}.reward.unlocks`);
    q.reward.unlocks.forEach(id => c.ref(catalogue.unlocks, id, `${at}.reward.unlocks`));
  }
  // Monotone all-required prerequisites. Exclude missing refs, already reported above.
  const remaining = new Map(quests.map(q => [q.id, q.requires.filter(id => ids.has(id))]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, required] of remaining) {
      if (required.every(other => !remaining.has(other))) { remaining.delete(id); changed = true; }
    }
  }
  for (const id of remaining.keys()) c.fail(`quest.${id}.requires`, 'blocked by a prerequisite cycle');
  return errors;
}

function walk(start: string, edges: Map<string, string[]>): Set<string> {
  const seen = new Set<string>(), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (seen.has(id) || !edges.has(id)) continue;
    seen.add(id);
    queue.push(...edges.get(id)!);
  }
  return seen;
}

/** Facts are read-only; reusable choices have no actions. Result applies only to supplied states. */
export function inspectDialogue(dialogue: Dialogue, catalogue: Catalogue, states: ProbeState[]) {
  const errors: string[] = [], c = checks(errors, catalogue.messages);
  const at = `dialogue.${dialogue.id}`, nodes = new Map(dialogue.nodes.map(n => [n.id, n]));
  c.ref(catalogue.dialogues, dialogue.id, `${at}.id`);
  c.ids(dialogue.nodes.map(n => n.id), `${at}.nodes`);
  c.ref(nodes, dialogue.start, `${at}.start`);
  c.ids(states.map(s => s.id), `${at}.states`);
  if (!states.length) c.fail(`${at}.states`, 'no supplied states examined');
  for (const n of dialogue.nodes) {
    const path = `${at}.${n.id}`;
    c.text(n.text, `${path}.text`);
    c.ids(n.choices.map(choice => choice.id), `${path}.choices`);
    if (n.terminal && n.choices.length) c.fail(path, 'terminal must not have outgoing choices');
    if (!n.terminal && !n.choices.length) c.fail(path, 'nonterminal has no choices');
    for (const choice of n.choices) {
      c.text(choice.text, `${path}.${choice.id}.text`);
      c.ref(nodes, choice.to, `${path}.${choice.id}.to`);
      c.ids(choice.when.map(w => w.flag), `${path}.${choice.id}.when`);
      choice.when.forEach(w => {
        c.ref(catalogue.flags, w.flag, `${path}.${choice.id}.when`);
        if (typeof w.equals !== 'boolean') c.fail(`${path}.${choice.id}.when`, 'expected boolean condition');
      });
    }
  }
  const structural = new Map(dialogue.nodes.map(n => [n.id, n.choices.map(ch => ch.to)]));
  const structurallyReachable = walk(dialogue.start, structural);
  for (const n of dialogue.nodes) if (!structurallyReachable.has(n.id))
    c.fail(`${at}.${n.id}`, 'unreachable from entry even without conditions');
  const observations: { state: string; reachable: string[]; stranded: string[] }[] = [];
  for (const state of states) {
    let valid = true;
    for (const flag of catalogue.flags) {
      if (!Object.hasOwn(state.facts, flag) || typeof state.facts[flag] !== 'boolean') {
        c.fail(`${at}.state.${state.id}`, `missing boolean fact ${flag}`); valid = false;
      }
    }
    if (!valid) continue;
    const edges = new Map(dialogue.nodes.map(n => [n.id, n.choices
      .filter(ch => ch.when.every(w => Object.hasOwn(state.facts, w.flag) && state.facts[w.flag] === w.equals))
      .map(ch => ch.to).filter(id => nodes.has(id))]));
    const reachable = walk(dialogue.start, edges);
    // Reverse closure of terminals: existence of an exit path, not forced termination.
    const canExit = new Set(dialogue.nodes.filter(n => n.terminal).map(n => n.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, targets] of edges) if (!canExit.has(id) && targets.some(t => canExit.has(t))) {
        canExit.add(id); changed = true;
      }
    }
    const stranded = [...reachable].filter(id => !canExit.has(id));
    for (const id of stranded) c.fail(`${at}.state.${state.id}.${id}`, 'cannot reach a terminal with supplied facts');
    observations.push({ state: state.id, reachable: [...reachable], stranded });
  }
  return { errors, structurallyReachable: [...structurallyReachable], observations };
}
