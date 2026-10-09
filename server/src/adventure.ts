import { questCommand } from './quests';
import type { Session } from './net/session';
/** Compatibility for the C070 client, replay fixtures and walkthrough harness. */
export const adventureCommand = (s:Session,a:Record<string,unknown>) => questCommand(s,{...a,quest:'silent_wheel'});