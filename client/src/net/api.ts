// Command API used by the UI. The connection module installs the real sender at startup.

import { funnel } from '../game/funnel';
import { QUEST_SERVICE_OPS } from '@shared/questTypes';
import type { IntroEvent } from '@shared/onboarding';
import type { CmdOp } from '@shared/protocol';

export interface CmdResult<T = unknown> { ok: boolean; err?: string; data?: T }

type Sender = (op: CmdOp, args?: Record<string, unknown>) => Promise<CmdResult>;
type ChatSender = (text: string,ch?:import('@shared/social').ChatChannel,to?:string) => void;

let sender: Sender = async () => ({ ok: false, err: 'Not connected' });
let chatSender: ChatSender = () => {};

export function installApi(s: Sender, c: ChatSender) {
  sender = s;
  chatSender = c;
}

/** Send a gameplay command to the server (equip, cube operations, skills, paragon, travel...). */
export function cmd<T = unknown>(op: CmdOp, args?: Record<string, unknown>): Promise<CmdResult<T>> {
  return sender(op,args).then(result=>{
    if(result.ok){const event:IntroEvent|undefined=op==='equip'?'equip':op==='skillTier'?'skill':op==='skillRune'?'rune':op==='quest'&&args?.action==='accept'?'talk':op==='quest'&&args?.action==='claim'?'claim':(QUEST_SERVICE_OPS as readonly string[]).includes(op)?'service':undefined;if(event)funnel.event(event);}
    return result as CmdResult<T>;
  });
}

export function sendChat(text: string,ch?:import('@shared/social').ChatChannel,to?:string) {
  chatSender(text,ch,to);
}

/** Start the game with a character (class select screen). Installed by main.ts. */
export const session = {
  interact: () => {},
  start: (_name: string, _classId: 'warrior' | 'ranger' | 'mage', _options?:{appearance?:import('@shared/appearance').HeroAppearance;tutorial?:boolean}) => {},
  /** Account request before `hello` (register, login, resume, recover, password, codes, logout). Installed by main.ts. */
  auth: async (_op: Exclude<import('@shared/protocol').AuthOp, 'status'>, _fields?: { username?: string; password?: string; newPassword?: string; code?: string }): Promise<{ ok: boolean; err?: string }> => ({ ok: false, err: 'Not connected' }),
  /** Reads the server's account mode and resumes a remembered session. Installed by main.ts. */
  initAccount: async (): Promise<void> => {},
};
