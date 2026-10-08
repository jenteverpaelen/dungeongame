import { loadAuthoredTown } from '../shared/src/town';
import { validateTown } from '../shared/src/townValidation';
const town = loadAuthoredTown(1).town!;
const errors = validateTown(town);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Town valid: ${town.buildings.length} buildings, ${town.npcs.length} NPCs, ${town.routes.length} swept walking routes; all services reachable.`);
