import { createAuxBackup, rotateAuxBackups } from './backupAux';
import { appendDrillLog, DEFAULT_DRILL_LOG, drillBackup, mirrorBackup, type DrillResult } from './backupDrill';
import { createCharacterBackup, rotateCharacterBackups } from './backups';
import { flushSaves } from './persistence';

export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface BackupOptions {
  /** Second copy of every verified backup (another disk / share / synced folder); rotated with the same keep count. */
  mirror?: string;
  /** Restore drill after each backup (default on). */
  drill?: boolean;
  /** Where drills restore to (default: the OS temp directory). */
  scratchRoot?: string;
  /** Drill log file (default DATA_DIR/ops/backup-drills.jsonl). */
  drillLog?: string;
}
export interface BackupStatus {
  lastBackup?: { at: string; directory: string; characters: number };
  lastDrill?: Pick<DrillResult, 'at' | 'ok' | 'characters' | 'items' | 'ms'> & { problems: number };
  lastMirror?: { at: string; ok: boolean; error?: string };
  lastError?: { at: string; message: string };
}

/** One process owns DATA_DIR. Save live state before capturing its persisted cut. */
export function startCharacterBackups(root: string, saveLive: () => void, keepCount = 0, options: BackupOptions = {}) {
  if (!Number.isSafeInteger(keepCount) || keepCount < 0) throw new Error('Invalid backup retention count');
  let active: Promise<void> | undefined;
  let stopped = false;
  const status: BackupStatus = {};
  const stamp = () => new Date().toISOString();
  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (active) return active;
    active = (async () => {
      saveLive();
      await flushSaves();
      const result = await createCharacterBackup(root);
      status.lastBackup = { at: stamp(), directory: result.directory, characters: result.characters };
      console.log(`[backup] verified ${result.characters} characters: ${result.directory}`);
      if (keepCount > 0) {
        try {
          const rotation = await rotateCharacterBackups(root, result.directory, keepCount, true);
          console.log(`[backup] rotation kept ${rotation.keep.length}, removed ${rotation.removed.length}, preserved ${rotation.excluded.length} excluded entries`);
        } catch (error) {
          console.error('[backup] rotation failed; new verified backup remains available:', error);
        }
      }
      // Accounts and the community ledger are not part of the character backup format; copy them beside it.
      let auxDirectory: string | undefined;
      try {
        const aux = await createAuxBackup(root);
        if (aux) {
          auxDirectory = aux.directory;
          console.log(`[backup] verified ${aux.files} account/ledger file(s): ${aux.directory}`);
          if (keepCount > 0) await rotateAuxBackups(root, keepCount);
        }
      } catch (error) {
        console.error('[backup] account/ledger snapshot failed; the character backup is unaffected:', error);
      }
      if (options.drill !== false) {
        try {
          const drill = await drillBackup(result.directory, { aux: auxDirectory, scratchRoot: options.scratchRoot });
          await appendDrillLog(options.drillLog ?? DEFAULT_DRILL_LOG, drill);
          status.lastDrill = { at: drill.at, ok: drill.ok, characters: drill.characters, items: drill.items, ms: drill.ms, problems: drill.problems.length + (drill.aux && !drill.aux.ok ? 1 : 0) };
          if (drill.ok) console.log(`[backup] restore drill passed: ${drill.characters} characters, ${drill.items} items loaded in ${drill.ms} ms`);
          else console.error(`[backup] RESTORE DRILL FAILED (${drill.problems.length} problem(s)); see ${options.drillLog ?? DEFAULT_DRILL_LOG}. The backup itself is kept.`);
        } catch (error) {
          console.error('[backup] restore drill could not run:', error);
        }
      }
      if (options.mirror) {
        try {
          await mirrorBackup(result.directory, options.mirror, keepCount);
          if (auxDirectory) await mirrorBackup(auxDirectory, options.mirror, keepCount);
          status.lastMirror = { at: stamp(), ok: true };
          console.log(`[backup] mirrored and verified in ${options.mirror}`);
        } catch (error) {
          status.lastMirror = { at: stamp(), ok: false, error: error instanceof Error ? error.message : String(error) };
          console.error('[backup] mirror copy failed; the local backup is unaffected:', error);
        }
      }
    })().catch(error => {
      status.lastError = { at: stamp(), message: error instanceof Error ? error.message : String(error) };
      console.error('[backup] failed; no completed backup reported:', error);
    }).finally(() => { active = undefined; });
    return active;
  };
  const timer = setInterval(() => void run(), BACKUP_INTERVAL_MS);
  timer.unref();
  void run();
  return {
    run,
    status: (): BackupStatus => structuredClone(status),
    async stop(): Promise<void> {
      stopped = true;
      clearInterval(timer);
      await active;
    },
  };
}
