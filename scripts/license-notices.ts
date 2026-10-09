// Generate attribution from individually reviewed installed bytes; never fetch licences implicitly.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

interface ReviewedPackage {
  name: string; version: string; declaredLicense: string; installedPath: string;
  packageSource: string; packageIntegrity: string; licensePath: string;
  licenseBytes: number; licenseSha256: string; additionalCopyright?: string;
}
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function within(root: string, relative: string) {
  const target = path.resolve(root, relative), local = path.relative(root, target);
  if (local.startsWith('..') || path.isAbsolute(local)) throw Error(`Notice input outside project: ${relative}`);
  return target;
}
async function json(filename: string) { return JSON.parse(await fs.readFile(filename, 'utf8')); }

export async function generateNotices(root: string): Promise<Buffer> {
  const inventory: { count: number; packages: ReviewedPackage[] } = await json(path.join(root, 'docs/licenses/installed-production.json'));
  const lock = await json(path.join(root, 'package-lock.json'));
  const reviewed = new Map(inventory.packages.map(p => [p.installedPath, p]));
  if (reviewed.size !== inventory.count || reviewed.size !== inventory.packages.length) throw Error('Duplicate or inconsistent licence inventory');
  const installed = new Map<string, { name: string; version: string; license: string }>();
  for (const [location, entry] of Object.entries(lock.packages) as [string, { dev?: boolean }][]) {
    if (!location || entry.dev) continue;
    try { installed.set(location, await json(within(root, `${location}/package.json`))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const location of installed.keys()) if (!reviewed.has(location)) throw Error(`Unreviewed production dependency: ${location}`);
  for (const location of reviewed.keys()) if (!installed.has(location)) throw Error(`Reviewed dependency missing; review this target stack: ${location}`);

  const chunks: Buffer[] = [Buffer.from('Hearthfall — Third-party notices\n\n' +
    'These notices cover the reviewed installed production application stack. Some components serve the server or supply types; inclusion does not imply every component is in the browser bundle.\n' +
    'The following licences apply to their respective components, not automatically to original game content.\n\n')];
  for (const p of [...inventory.packages].sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const actual = installed.get(p.installedPath)!;
    const pinned = lock.packages[p.installedPath];
    if (actual.name !== p.name || actual.version !== p.version || actual.license !== p.declaredLicense ||
      pinned.version !== p.version || pinned.integrity !== p.packageIntegrity || pinned.resolved !== p.packageSource)
      throw Error(`Dependency changed; review licence/provenance: ${p.name}`);
    const noticeFiles = (await fs.readdir(within(root, p.installedPath), { withFileTypes: true }))
      .filter(entry => entry.isFile() && /notice/i.test(entry.name));
    if (noticeFiles.length) throw Error(`Additional notice requires review: ${p.name}: ${noticeFiles.map(e=>e.name).join(', ')}`);
    const license = await fs.readFile(within(root, p.licensePath));
    if (license.length !== p.licenseBytes || sha256(license) !== p.licenseSha256)
      throw Error(`Licence bytes changed; review before distribution: ${p.name}`);
    chunks.push(Buffer.from(`===== ${p.name}@${p.version} =====\nLicense: ${p.declaredLicense}\nSource: ${p.packageSource}\n` +
      (p.additionalCopyright ? `${p.additionalCopyright}\n` : '') + '\n'));
    chunks.push(license, Buffer.from('\n\n'));
  }
  return Buffer.concat(chunks);
}

export function licenseNoticesPlugin(root: string): Plugin {
  return { name: 'hearthfall-reviewed-notices', apply: 'build', async generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: await generateNotices(root) });
  } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output')) throw Error('Usage: licenses:check [--output path]');
  const bytes = await generateNotices(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  if (args.length) { const output = path.resolve(args[1]); await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, bytes); }
  console.log(JSON.stringify({ bytes: bytes.length, sha256: sha256(bytes), output: args[1] ?? null }));
}
