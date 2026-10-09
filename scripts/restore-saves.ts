import path from 'node:path';
import { restoreCharacterBackup, verifyCharacterBackup } from '../server/src/backups';

const [operation, source, destination, ...extra] = process.argv.slice(2);
if (extra.length || !source || (operation !== 'verify' && operation !== 'restore')
  || (operation === 'restore' ? !destination : !!destination)) {
  console.error('Usage: npm run saves:backup -- verify <backup-directory>\n       npm run saves:backup -- restore <backup-directory> <NEW-destination-directory>');
  process.exitCode = 1;
} else {
  try {
    const result = operation === 'verify' ? await verifyCharacterBackup(path.resolve(source))
      : await restoreCharacterBackup(path.resolve(source), path.resolve(destination!));
    console.log(JSON.stringify(result,null,2));
    if (operation === 'restore') console.log('Verified restore complete. Activation is separate; the current DATA_DIR was not changed.');
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
