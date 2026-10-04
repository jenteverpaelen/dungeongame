// Runs the authoritative game server and the Vite client dev server together (Windows, macOS, Linux).
import { spawn } from 'node:child_process';

const win = process.platform === 'win32';
// On Windows `npx` is a .cmd shim, which needs a shell to launch.
const run = (args) => spawn('npx', args, { stdio: 'inherit', shell: win });

const procs = [
  run(['tsx', 'watch', 'server/src/main.ts']),
  run(['vite', '--config', 'client/vite.config.ts']),
];
console.log('\n  Hearthfall dev: open http://localhost:5173\n');
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) stop(); });
