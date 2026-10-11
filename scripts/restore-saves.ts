import path from 'node:path';
import { restoreCharacterBackup, rotateCharacterBackups, verifyCharacterBackup } from '../server/src/backups';
import { restoreAuxBackup, verifyAuxBackup } from '../server/src/backupAux';
import { parseBackupKeep } from '../server/src/backupPolicy';
import { appendDrillLog, DEFAULT_DRILL_LOG, drillBackup, mirrorBackup, readDrillLog } from '../server/src/backupDrill';
import { applyErasuresToDirectory } from '../server/src/erasure';

const USAGE = `Usage: npm run saves:backup -- verify <backup-directory>
       npm run saves:backup -- restore <backup-directory> <NEW-destination-directory>
       npm run saves:backup -- plan <backup-root> <newest-verified-backup> <keep-count>
       npm run saves:backup -- aux-verify <aux-directory>
       npm run saves:backup -- aux-restore <aux-directory> <NEW-destination-directory>
       npm run saves:backup -- drill <backup-directory> [aux-directory]        (timed restore drill; appends to $DATA_DIR/ops/backup-drills.jsonl when DATA_DIR is set)
       npm run saves:backup -- drills <drill-log-file>                         (last 20 drill results)
       npm run saves:backup -- mirror <backup-or-aux-directory> <mirror-root>  (copy + verify elsewhere)
       npm run saves:backup -- apply-erasures <restored-characters-dir> <live-privacy-ledger.json> [restored-accounts-dir]`;
const [operation, a, b, c, ...extra] = process.argv.slice(2);
const arity: Record<string, [number, number]> = {
  verify: [1, 1], restore: [2, 2], plan: [3, 3], 'aux-verify': [1, 1], 'aux-restore': [2, 2],
  drill: [1, 2], drills: [1, 1], mirror: [2, 2], 'apply-erasures': [2, 3],
};
const given = [a, b, c].filter(v => v !== undefined).length;
if (extra.length || !arity[operation] || given < arity[operation][0] || given > arity[operation][1]) {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  try {
    const p = (v: string | undefined) => path.resolve(v!);
    let result: unknown;
    switch (operation) {
      case 'verify': result = await verifyCharacterBackup(p(a)); break;
      case 'restore': result = await restoreCharacterBackup(p(a), p(b)); break;
      case 'plan': result = await rotateCharacterBackups(p(a), p(b), parseBackupKeep(c)); break;
      case 'aux-verify': result = await verifyAuxBackup(p(a)); break;
      case 'aux-restore': result = await restoreAuxBackup(p(a), p(b)); break;
      case 'drill': {
        const drill = await drillBackup(p(a), { aux: b ? p(b) : undefined });
        if (process.env.DATA_DIR) await appendDrillLog(DEFAULT_DRILL_LOG, drill);
        result = drill;
        if (!drill.ok) process.exitCode = 1;
        break;
      }
      case 'drills': result = await readDrillLog(p(a)); break;
      case 'mirror': result = await mirrorBackup(p(a), p(b)); break;
      case 'apply-erasures': result = await applyErasuresToDirectory(p(a), p(b), c ? p(c) : undefined); break;
    }
    console.log(JSON.stringify(result, null, 2));
    if (operation === 'restore') console.log('Verified restore complete. Activation is separate; the current DATA_DIR was not changed. Run apply-erasures before activating it.');
    if (operation === 'aux-restore') console.log('Verified restore complete. Copy accounts/ and social/ into DATA_DIR yourself, with the server stopped; keep the live privacy/ledger.json.');
    if (operation === 'plan') console.log('Read-only rotation plan; no files changed. Configure BACKUP_KEEP explicitly to enable future scheduled rotation.');
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
