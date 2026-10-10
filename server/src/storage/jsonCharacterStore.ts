import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { INCOMPLETE_RESTORE, validCharacterId, type CharacterStore } from './characterStore';

const RETRYABLE_RENAME = new Set(['EPERM', 'EBUSY', 'EACCES']);
/** Windows briefly refuses to replace a file that another process holds open (antivirus, backup tools, a test reading
 *  the save). Retry the atomic rename with a short bounded backoff (~1.9 s total) instead of failing the save. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await fsp.rename(from, to); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== 'win32' || !code || !RETRYABLE_RENAME.has(code) || attempt >= 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * 2 ** attempt));
    }
  }
}

export class JsonCharacterStore implements CharacterStore {
  private tmpCounter = 0;
  constructor(readonly directory: string) {}

  ensure(): void {
    fs.mkdirSync(this.directory, { recursive: true });
    if (fs.existsSync(path.join(this.directory, INCOMPLETE_RESTORE))) throw new Error('Character directory contains an incomplete restore; choose a completed restore');
  }
  private file(id: string): string {
    if (!validCharacterId(id)) throw new Error(`invalid character id "${id}"`);
    return path.join(this.directory, `${id}.json`);
  }
  async read(id: string): Promise<Buffer | null> {
    try { return await fsp.readFile(this.file(id)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async write(id: string, json: string): Promise<void> {
    const file = this.file(id), tmp = `${file}.${process.pid}.${++this.tmpCounter}.tmp`;
    try {
      await fsp.writeFile(tmp, json, { flush: true });
      await renameWithRetry(tmp, file);
    } catch (error) {
      await fsp.rm(tmp, { force: true }).catch(() => undefined);
      throw error;
    }
  }
  async quarantine(id: string): Promise<string> {
    const source = this.file(id), destination = `${source}.corrupt-${Date.now()}`;
    await fsp.rename(source, destination);
    return path.basename(destination);
  }
  /** Caller owns the write barrier; another independent process is not supported. */
  async snapshot(): Promise<Map<string, Buffer>> {
    const result = new Map<string, Buffer>();
    const entries = await fsp.readdir(this.directory, { withFileTypes: true });
    for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
      if (!entry.name.endsWith('.json')) continue;
      const id = entry.name.slice(0,-5);
      if (!validCharacterId(id) || !entry.isFile()) throw new Error(`Cannot snapshot unexpected character entry ${entry.name}`);
      const bytes = await this.read(id);
      if (bytes === null) throw new Error(`Character disappeared during snapshot: ${id}`);
      result.set(id,bytes);
    }
    return result;
  }
}
