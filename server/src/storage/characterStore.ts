/** Raw bytes are intentional: backup and future-format preservation must not normalize saves. */
export interface CharacterStore {
  ensure(): void;
  read(id: string): Promise<Buffer | null>;
  write(id: string, json: string): Promise<void>;
  quarantine(id: string): Promise<string>;
  snapshot(): Promise<Map<string, Buffer>>;
}

export const INCOMPLETE_RESTORE = '.hearthfall-restore-incomplete';
export const validCharacterId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9]{2,16}$/.test(id);
