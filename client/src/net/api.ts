// Command API used by the UI. The connection module installs the real sender at startup.

import type { CmdOp } from '@shared/protocol';

export interface CmdResult<T = unknown> { ok: boolean; err?: string; data?: T }

type Sender = (op: CmdOp, args?: Record<string, unknown>) => Promise<CmdResult>;
type ChatSender = (text: string) => void;

let sender: Sender = async () => ({ ok: false, err: 'Not connected' });
let chatSender: ChatSender = () => {};

export function installApi(s: Sender, c: ChatSender) {
  sender = s;
  chatSender = c;
}

/** Send a gameplay command to the server (equip, cube operations, skills, paragon, travel...). */
export function cmd<T = unknown>(op: CmdOp, args?: Record<string, unknown>): Promise<CmdResult<T>> {
  return sender(op, args) as Promise<CmdResult<T>>;
}

export function sendChat(text: string) {
  chatSender(text);
}

/** Start the game with a character (class select screen). Installed by main.ts. */
export const session = {
  start: (_name: string, _classId: 'warrior' | 'ranger' | 'mage') => {},
};
