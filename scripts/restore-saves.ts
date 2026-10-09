import path from 'node:path';
import { restoreCharacterBackup, rotateCharacterBackups, verifyCharacterBackup } from '../server/src/backups';
import { parseBackupKeep } from '../server/src/backupPolicy';

const [operation, source, destination, count, ...extra] = process.argv.slice(2);
if (extra.length || !source || !['verify', 'restore', 'plan'].includes(operation)
  || (operation === 'plan' ? !destination || count === undefined : count !== undefined || (operation === 'restore' ? !destination : !!destination))) {
  console.error('Usage: npm run saves:backup -- verify <backup-directory>\n       npm run saves:backup -- restore <backup-directory> <NEW-destination-directory>\n       npm run saves:backup -- plan <backup-root> <newest-verified-backup> <keep-count>');
  process.exitCode = 1;
} else {
  try {
    const result = operation === 'verify' ? await verifyCharacterBackup(path.resolve(source))
      : operation === 'plan' ? await rotateCharacterBackups(path.resolve(source), path.resolve(destination!), parseBackupKeep(count))
        : await restoreCharacterBackup(path.resolve(source), path.resolve(destination!));
    console.log(JSON.stringify(result,null,2));
    if (operation === 'restore') console.log('Verified restore complete. Activation is separate; the current DATA_DIR was not changed.');
    if (operation === 'plan') console.log('Read-only rotation plan; no files changed. Configure BACKUP_KEEP explicitly to enable future scheduled rotation.');
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
