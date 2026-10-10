import { createHash } from 'node:crypto';
import { COMMAND_TIMEOUT_MS, MAX_MESSAGE_BYTES, MAX_MESSAGES_PER_SECOND, type S2C } from '../../../shared/src/protocol';

type Reply = Extract<S2C, { t: 'res' }>;
interface Receipt { fingerprint: string; response: Reply; bytes: number }
export const MAX_COMMAND_RECEIPTS = Math.ceil(COMMAND_TIMEOUT_MS / 1000) * MAX_MESSAGES_PER_SECOND;

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  throw new Error('Command arguments must contain finite JSON values');
}

export function commandFingerprint(op:unknown,args:unknown):string {
  return createHash('sha256').update(canonical([op,args])).digest('hex');
}

/** Connection-local transport/failure history. Saved mutation receipts live in CharacterSave.commands. */
export class CommandReceipts {
  private highWater = 0;
  private receipts = new Map<number, Receipt>();
  private retainedBytes = 0;

  execute(id: number, op: unknown, args: unknown, execute: () => Reply): Reply {
    const fail = (err: string): Reply => ({ t: 'res', id, ok: false, err });
    if (!Number.isSafeInteger(id) || id <= 0) return fail('Invalid command ID');
    let fingerprint: string;
    try { fingerprint = commandFingerprint(op,args); }
    catch { return fail('Invalid command arguments'); }
    const previous = this.receipts.get(id);
    if (previous) return previous.fingerprint === fingerprint
      ? structuredClone(previous.response) : fail('Command ID was already used for a different request');
    if (id <= this.highWater) return fail('Command result expired; refresh state before making a new request');
    // Record the high-water mark before entering a potentially mutating handler.
    // Even a failure while cloning/retaining its response cannot reopen this ID.
    this.highWater = id;
    let response: Reply;
    try { response = execute(); }
    catch { response = fail('Server error'); }
    const snapshot = structuredClone(response);
    const bytes = Buffer.byteLength(JSON.stringify(snapshot)) + fingerprint.length;
    if (bytes <= MAX_MESSAGE_BYTES) {
      this.receipts.set(id, { fingerprint, response: snapshot, bytes });
      this.retainedBytes += bytes;
    }
    while (this.receipts.size > MAX_COMMAND_RECEIPTS || this.retainedBytes > MAX_MESSAGE_BYTES) {
      const [oldest, receipt] = this.receipts.entries().next().value!;
      this.receipts.delete(oldest); this.retainedBytes -= receipt.bytes;
    }
    return response;
  }
}
