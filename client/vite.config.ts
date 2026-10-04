import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('.'),
  resolve: { alias: { '@shared': r('../shared/src') } },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:2567', ws: true } },
  },
  build: { outDir: r('../dist/client'), emptyOutDir: true, target: 'es2022' },
});
