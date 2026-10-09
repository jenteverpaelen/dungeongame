export const TARGET_PRIORITIES = ['default', 'nearest', 'elites', 'lowestLife'] as const;
export type TargetPriority = typeof TARGET_PRIORITIES[number];

export const TARGET_PRIORITY_LABEL: Record<TargetPriority, string> = {
  default: 'Default', nearest: 'Nearest', elites: 'Elites first', lowestLife: 'Lowest life',
};
export const TARGET_PRIORITY_NOTE: Record<TargetPriority, string> = {
  default: 'Nearest enemy, with a preference for nearby elites, bosses and treasure goblins.',
  nearest: 'The enemy whose body is closest to the attacker.',
  elites: 'The nearest elite, boss or treasure goblin in range; otherwise the nearest enemy.',
  lowestLife: 'The enemy with the lowest percentage of life remaining. Ties favour the nearest.',
};

export const isTargetPriority = (value: unknown): value is TargetPriority =>
  value === 'default' || value === 'nearest' || value === 'elites' || value === 'lowestLife';

/** Legacy and malformed preferences retain the original target selection. */
export const normalizeTargetPriority = (value: unknown): TargetPriority => isTargetPriority(value) ? value : 'default';
