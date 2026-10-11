import { CONTENT_DATA, validateContent } from '../shared/src/contentValidation';
import { loadAuthoredTown } from '../shared/src/town';
import { validateTown } from '../shared/src/townValidation';
import { validateMessages } from '../client/src/i18n/messages';
import { validateQuests, validateAdventures } from '../shared/src/questValidation';
import { validateStoryCatalogue } from '../shared/src/questAuthoring';
import { registrySchemaProblems, stableIdProblems } from './content-ids';
import { buildCodeRegistryProblems } from '../shared/src/buildCode';
import { originalityProblems } from './originality-check';
import { localizationProblems } from './i18n-check';
const ids = stableIdProblems(), originality = originalityProblems(), i18n = localizationProblems();
const errors = [...validateContent(), ...validateMessages(), ...validateQuests(), ...validateStoryCatalogue(), ...validateAdventures(), ...validateTown(loadAuthoredTown(1).town!).map(e=>`town: ${e}`),
  ...ids.errors, ...registrySchemaProblems(), ...buildCodeRegistryProblems(), ...originality.errors, ...i18n.errors];
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Content valid: ${Object.keys(CONTENT_DATA.classes).length} classes, ${Object.keys(CONTENT_DATA.skills).length} skills, ${Object.keys(CONTENT_DATA.bases).length} bases, ${Object.keys(CONTENT_DATA.legendaries).length} legendaries, ${Object.keys(CONTENT_DATA.sets).length} sets, ${Object.keys(CONTENT_DATA.gems).length} gems, ${Object.keys(CONTENT_DATA.monsters).length} monsters, ${Object.keys(CONTENT_DATA.zones).length} zones; town geometry and routes pass.`
  + `\nStable ids: none missing${ids.added ? `, ${ids.added} new (record with npx tsx scripts/content-ids.ts --update)` : ''}. Originality: ${originality.matches.length} known borrowed-term use(s) waiting for renames, none new`
  + `${originality.stale.length ? `, ${originality.stale.length} allowlist entr${originality.stale.length === 1 ? 'y' : 'ies'} already renamed (prune docs/originality/allowlist.json)` : ''}. Localized files: ${i18n.files} with no inline text.`);
