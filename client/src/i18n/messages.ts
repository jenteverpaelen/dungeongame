import { ENGLISH } from './en';

export type MessageKey = keyof typeof ENGLISH;
type ParametersIn<S extends string> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | ParametersIn<Rest> : never;
type MessageArgs<K extends MessageKey> = [ParametersIn<typeof ENGLISH[K]>] extends [never]
  ? [] : [values: Record<ParametersIn<typeof ENGLISH[K]>, string>];
const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g;

function placeholders(template: string): string[] {
  if (/[{}]/.test(template.replace(PLACEHOLDER, ''))) throw Error('Malformed message placeholder');
  return [...new Set([...template.matchAll(PLACEHOLDER)].map(m => m[1]))].sort();
}

// Plain string substitution only. Not ICU/Unicode MessageFormat, HTML or a plural formatter.
export function formatMessage(template: string, values: Readonly<Record<string, string>> = {}): string {
  const names = placeholders(template);
  if (Object.keys(values).some(name => !names.includes(name))) throw Error('Unexpected message parameter');
  for (const name of names) if (!Object.hasOwn(values, name) || typeof values[name] !== 'string')
    throw Error(`Missing string message parameter: ${name}`);
  // A callback preserves literal dollar signs; inserted values are never parsed a second time.
  return template.replace(PLACEHOLDER, (_, name: string) => values[name]);
}

export function text<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
  if (!Object.hasOwn(ENGLISH, key)) throw Error(`Unknown message key: ${key}`);
  return formatMessage(ENGLISH[key], args[0]);
}

/** Check complete scoped catalogues; source code typechecking verifies the referenced keys. */
export function validateMessages(candidate: unknown = ENGLISH): string[] {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return ['messages: expected a catalogue'];
  const errors: string[] = [], values = candidate as Record<string, unknown>;
  for (const key of Object.keys(values)) if (!Object.hasOwn(ENGLISH, key)) errors.push(`messages: unexpected key ${key}`);
  for (const [key, original] of Object.entries(ENGLISH)) {
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    if (typeof value !== 'string' || !value.trim()) { errors.push(`messages: missing or empty ${key}`); continue; }
    try {
      if (placeholders(value).join('|') !== placeholders(original).join('|')) errors.push(`messages: parameter mismatch ${key}`);
    } catch { errors.push(`messages: malformed placeholder ${key}`); }
  }
  return errors;
}
