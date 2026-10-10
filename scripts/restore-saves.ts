import path from 'node:path';
import { restoreCharacterBackup, rotateCharacterBackups, verifyCharacterBackup } from '../server/src/backups';
import { restoreAuxBackup, verifyAuxBackup } from '../server/src/backupAux';
import { parseBackupKeep } from '../server/src/backupPolicy';

const [operation, source, destination, count, ...extra] = process.argv.slice(2);
const operations = ['verify', 'restore', 'plan', 'aux-verify', 'aux-restore'];
if (extra.length || !source || !operations.includes(operation)
  || (operation === 'plan' ? !destination || count === undefined
    : count !== undefined || (operation === 'restore' || operation === 'aux-restore' ? !destination : !!destination))) {
  console.error('Usage: npm run saves:backup -- verify <backup-directory>\n       npm run saves:backup -- restore <backup-directory> <NEW-destination-directory>\n       npm run saves:backup -- plan <backup-root> <newest-verified-backup> <keep-count>\n       npm run saves:backup -- aux-verify <aux-directory>\n       npm run saves:backup -- aux-restore <aux-directory> <NEW-destination-directory>');
  process.exitCode = 1;
} else {
  try {
    const result = operation === 'verify' ? await verifyCharacterBackup(path.resolve(source))
      : operation === 'plan' ? await rotateCharacterBackups(path.resolve(source), path.resolve(destination!), parseBackupKeep(count))
        : operation === 'aux-verify' ? await verifyAuxBackup(path.resolve(source))
          : operation === 'aux-restore' ? await restoreAuxBackup(path.resolve(source), path.resolve(destination!))
            : await restoreCharacterBackup(path.resolve(source), path.resolve(destination!));
    console.log(JSON.stringify(result,null,2));
    if (operation === 'restore') console.log('Verified restore complete. Activation is separate; the current DATA_DIR was not changed.');
    if (operation === 'aux-restore') console.log('Verified restore complete. Copy accounts/ and social/ into DATA_DIR yourself, with the server stopped; the current DATA_DIR was not changed.');
    if (operation === 'plan') console.log('Read-only rotation plan; no files changed. Configure BACKUP_KEEP explicitly to enable future scheduled rotation.');
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
