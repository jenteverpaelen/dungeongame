import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { generateNotices } from './license-notices';
import { createStaticHandler } from '../server/src/net/static';

assert.ok(process.env.DATA_DIR, 'Explicit isolated DATA_DIR required');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');

test('reviewed installed stack produces identical notices and retains every complete licence', async () => {
  const first = await generateNotices(repo), second = await generateNotices(repo);
  assert.deepEqual(first, second);
  const inventory = JSON.parse(await fs.readFile(path.join(repo, 'docs/licenses/installed-production.json'), 'utf8'));
  for (const p of inventory.packages) {
    assert.ok(first.includes(Buffer.from(`===== ${p.name}@${p.version} =====`)));
    assert.ok(first.includes(await fs.readFile(path.join(repo, p.licensePath))), p.name);
    if (p.additionalCopyright) assert.ok(first.includes(Buffer.from(p.additionalCopyright)));
  }
  console.log(JSON.stringify({ packages: inventory.count, bytes: first.length, sha256: hash(first) }));
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'notices-'));
  const location = 'node_modules/synthetic-component';
  const license = Buffer.from('Synthetic test notice only\r\nPreserve these bytes.\r\n');
  const p = { name: 'synthetic-component', version: '1.0.0', declaredLicense: 'MIT', installedPath: location,
    packageSource: 'https://example.invalid/fixture', packageIntegrity: 'synthetic-integrity',
    licensePath: `${location}/LICENSE`, licenseBytes: license.length, licenseSha256: hash(license) };
  const inventory = { count: 1, packages: [p] };
  const lock: { packages: Record<string, { version: string; resolved: string; integrity: string }> } =
    { packages: { [location]: { version: p.version, resolved: p.packageSource, integrity: p.packageIntegrity } } };
  await fs.mkdir(path.join(root, location), { recursive: true });
  await fs.mkdir(path.join(root, 'docs/licenses'), { recursive: true });
  const writeJson = (name: string, value: unknown) => fs.writeFile(path.join(root, name), JSON.stringify(value));
  await writeJson(`${location}/package.json`, { name: p.name, version: p.version, license: p.declaredLicense });
  await fs.writeFile(path.join(root, p.licensePath), license);
  await writeJson('docs/licenses/installed-production.json', inventory);
  await writeJson('package-lock.json', lock);
  return { root, location, p, inventory, lock, writeJson };
}

test('changed or unreviewed distribution inputs refuse generation', async t => {
  const cases: { name: string; mutate: (f: Awaited<ReturnType<typeof fixture>>) => Promise<unknown>; error: RegExp }[] = [
    { name: 'version drift', mutate: f => f.writeJson(`${f.location}/package.json`, { name: f.p.name, version: '2.0.0', license: 'MIT' }), error: /Dependency changed/ },
    { name: 'integrity drift', mutate: f => { f.lock.packages[f.location].integrity = 'changed'; return f.writeJson('package-lock.json', f.lock); }, error: /Dependency changed/ },
    { name: 'licence changed', mutate: f => fs.writeFile(path.join(f.root, f.p.licensePath), 'changed'), error: /Licence bytes changed/ },
    { name: 'licence missing', mutate: f => fs.unlink(path.join(f.root, f.p.licensePath)), error: /ENOENT/ },
    { name: 'new notice', mutate: f => fs.writeFile(path.join(f.root, f.location, 'NOTICE.txt'), 'New attribution'), error: /Additional notice requires review/ },
    { name: 'unreviewed dependency', mutate: async f => {
      const location = 'node_modules/unreviewed'; await fs.mkdir(path.join(f.root, location));
      await f.writeJson(`${location}/package.json`, { name: 'unreviewed', version: '1.0.0', license: 'MIT' });
      await f.writeJson('package-lock.json', { packages: { ...f.lock.packages, [location]: { version: '1.0.0' } } });
    }, error: /Unreviewed production dependency/ },
    { name: 'different installed target', mutate: f => fs.unlink(path.join(f.root, f.location, 'package.json')), error: /Reviewed dependency missing/ },
    { name: 'duplicate inventory', mutate: f => { f.inventory.packages.push(f.p); return f.writeJson('docs/licenses/installed-production.json', f.inventory); }, error: /Duplicate or inconsistent/ },
    { name: 'escaping licence path', mutate: f => { f.p.licensePath = '../outside'; return f.writeJson('docs/licenses/installed-production.json', f.inventory); }, error: /outside project/ },
  ];
  for (const c of cases) await t.test(c.name, async () => { const f = await fixture(); await c.mutate(f); await assert.rejects(generateNotices(f.root), c.error); });
});

test('actual static handler serves complete generated text with text MIME and gzip compatibility', async () => {
  const bytes = await generateNotices(repo);
  const root = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'public-'));
  await fs.writeFile(path.join(root, 'THIRD-PARTY-NOTICES.txt'), bytes);
  const handler = createStaticHandler(root);
  const server = createServer((req,res) => { void handler(req,res).then(handled => { if (!handled) res.writeHead(404).end(); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/THIRD-PARTY-NOTICES.txt`);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /^text\/plain/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
