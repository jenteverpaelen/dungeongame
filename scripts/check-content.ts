import { CONTENT_DATA, validateContent } from '../shared/src/contentValidation';
import { loadAuthoredTown } from '../shared/src/town';
import { validateTown } from '../shared/src/townValidation';
const errors = [...validateContent(), ...validateTown(loadAuthoredTown(1).town!).map(e=>`town: ${e}`)];
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Content valid: ${Object.keys(CONTENT_DATA.classes).length} classes, ${Object.keys(CONTENT_DATA.skills).length} skills, ${Object.keys(CONTENT_DATA.bases).length} bases, ${Object.keys(CONTENT_DATA.legendaries).length} legendaries, ${Object.keys(CONTENT_DATA.sets).length} sets, ${Object.keys(CONTENT_DATA.gems).length} gems, ${Object.keys(CONTENT_DATA.monsters).length} monsters, ${Object.keys(CONTENT_DATA.zones).length} zones; town geometry and routes pass.`);
