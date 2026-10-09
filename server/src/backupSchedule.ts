import { createCharacterBackup, rotateCharacterBackups } from './backups';
import { flushSaves } from './persistence';

export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** One process owns DATA_DIR. Save live state before capturing its persisted cut. */
export function startCharacterBackups(root: string, saveLive: () => void, keepCount = 0) {
  if (!Number.isSafeInteger(keepCount) || keepCount < 0) throw new Error('Invalid backup retention count');
  let active: Promise<void> | undefined;
  let stopped = false;
  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (active) return active;
    active = (async () => {
      saveLive();
      await flushSaves();
      const result = await createCharacterBackup(root);
      console.log(`[backup] verified ${result.characters} characters: ${result.directory}`);
      if (keepCount > 0) {
        try {
          const rotation = await rotateCharacterBackups(root, result.directory, keepCount, true);
          console.log(`[backup] rotation kept ${rotation.keep.length}, removed ${rotation.removed.length}, preserved ${rotation.excluded.length} excluded entries`);
        } catch (error) {
          console.error('[backup] rotation failed; new verified backup remains available:', error);
        }
      }
    })().catch(error => {
      console.error('[backup] failed; no completed backup reported:', error);
    }).finally(() => { active = undefined; });
    return active;
  };
  const timer = setInterval(() => void run(), BACKUP_INTERVAL_MS);
  timer.unref();
  void run();
  return {
    run,
    async stop(): Promise<void> {
      stopped = true;
      clearInterval(timer);
      await active;
    },
  };
}
