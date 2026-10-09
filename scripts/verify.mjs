// Uses only installed tools, never npx downloads. Every stage gets its own save directory.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageStatus, verificationOutcome } from './verification-status.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(a => a !== '--allow-known-windows-shutdown')) throw new Error('Unknown verify option');
const allowKnown = args.includes('--allow-known-windows-shutdown');
const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hearthfall-verify-'));
const sharedTests = (await fs.readdir(path.join(root, 'shared/test')))
  .filter(f => f.endsWith('.test.ts')).sort().map(f => `shared/test/${f}`);
const stages = [
  ['verify-contract', ['--test', 'scripts/verification-status.test.mjs']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']],
  ['shared', ['--import', 'tsx', '--test', ...sharedTests]],
  ['foundations', ['--import', 'tsx', '--test', 'server/test/foundations.test.ts']],
  ['save-failures', ['--import', 'tsx', '--test', 'server/test/saveFailures.test.ts']],
  ['command-replay', ['--import', 'tsx', '--test', 'server/test/commandReplay.test.ts']],
  ['connection-security', ['--import', 'tsx', '--test', 'server/test/origin.test.ts', 'server/test/connectionRuntime.test.ts', 'server/test/messageBudget.test.ts']],
  ['backups', ['--import', 'tsx', '--test', 'server/test/backups.test.ts']],
  ['backup-runtime', ['--import', 'tsx', '--test', 'server/test/backupRuntime.test.ts']],
  ['shutdown-failures', ['--import', 'tsx', '--test', 'server/test/shutdownFailures.test.ts']],
  ['client-preferences', ['--import', 'tsx', '--test', 'client/src/game/preferences.test.ts']],
  ['client-bindings', ['--import', 'tsx', '--test', 'client/src/game/bindings.test.ts']],
  ['town-services', ['--import', 'tsx', '--test', 'server/test/townServices.test.ts']],
  ['skill-descriptions', ['--import', 'tsx', '--test', 'server/test/skillDescriptions.test.ts']],
  ['server', ['--import', 'tsx', 'server/test/bot.ts']],
  ['simulation', ['--import', 'tsx', 'server/test/sim.ts']],
  ['content', ['--import', 'tsx', 'scripts/check-content.ts']],
  ['build', ['node_modules/vite/bin/vite.js', 'build', '--config', 'client/vite.config.ts']],
];
const results = [];
let child;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = true;
  child?.kill(signal);
});
console.log(`Verification evidence: ${runDir}`);
for (const [name, argv] of stages) {
  if (interrupted) break;
  const dataDir = path.join(runDir, name, 'saves');
  await fs.mkdir(dataDir, { recursive: true });
  console.log(`\n[verify] ${name}`);
  const started = performance.now();
  let output = '';
  const exitCode = await new Promise(resolve => {
    child = spawn(process.execPath, argv, {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: '', WS_ALLOWED_ORIGINS: undefined, ENABLE_DEBUG: '0', DISABLE_DEBUG: '0', FORCE_COLOR: '0' },
    });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {
      const text = data.toString(); output += text; process.stdout.write(text);
    });
    child.once('error', err => { output += `${err.stack}\n`; resolve(-1); });
    child.once('close', code => resolve(code ?? -1));
  });
  child = undefined;
  await fs.writeFile(path.join(runDir, `${name}.log`), output);
  const status = stageStatus({ platform:process.platform, name, exitCode, output });
  results.push({ name, status, exitCode, durationMs: Math.round(performance.now() - started), dataDir });
}
const report = { node: process.version, platform: process.platform, runDir, interrupted, allowKnown,
  outcome: verificationOutcome(results, stages.length, {allowKnown, interrupted}), results };
await fs.writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\n[verify] ${report.outcome}; evidence: ${runDir}`);
console.log('Browser visual/crowd checks and independent security review are separate; this command does not certify them.');
process.exitCode = report.outcome === 'failed' ? 1 : 0;
