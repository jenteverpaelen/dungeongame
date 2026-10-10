import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { licenseNoticesPlugin } from '../scripts/license-notices';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Parallel-instance overrides (defaults unchanged): HF_CLIENT_PORT / HF_SERVER_PORT pick the ports, HF_VITE_CACHE
// moves Vite's dependency cache so two checkouts that share one node_modules never write the same folder.
const clientPort = Number(process.env.HF_CLIENT_PORT ?? 5173);
const serverPort = Number(process.env.HF_SERVER_PORT ?? 2567);
const altCache = process.env.HF_VITE_CACHE;

export default defineConfig({
  plugins: [licenseNoticesPlugin(r('..'))],
  root: r('.'),
  cacheDir: altCache ? r(`../${altCache}`) : undefined,
  resolve: { alias: { '@shared': r('../shared/src') } },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  server: {
    port: clientPort,
    strictPort: Boolean(process.env.HF_CLIENT_PORT),
    host: true,
    fs: { strict: process.env.HF_FS_STRICT !== '0' },
    proxy: { '/ws': { target: `ws://localhost:${serverPort}`, ws: true }, '/api': { target: `http://localhost:${serverPort}` } },
  },
  build: { outDir: r('../dist/client'), emptyOutDir: true, target: 'es2022' },
});
