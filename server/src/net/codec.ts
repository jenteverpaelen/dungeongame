// MessagePack framing shared by every connection. One Packr instance is reused for all sockets;
// buffers it returns stay valid (it never recycles memory in non-reuse mode), so a single encoded
// buffer can be fanned out to many clients.

import { Packr } from 'msgpackr';
import type { RawData } from 'ws';
import type { C2S, S2C } from '../../../shared/src/protocol';

const packr = new Packr({ useRecords: false });

export function encode(msg: S2C): Uint8Array {
  return packr.pack(msg);
}

/** Decode a client frame. Returns null for anything that is not a MessagePack object with a string `t`. */
export function decode(data: RawData): C2S | null {
  try {
    const buf = Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const msg = packr.unpack(buf) as unknown;
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return null;
    return msg as C2S;
  } catch {
    return null;
  }
}
