// Minimal static file server for the production client build (dist/client): MIME types, gzip for text
// assets (cached in memory), immutable caching for hashed assets and an index.html fallback for routes.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.txt', '.webmanifest', '.wasm']);

const gzipCache = new Map<string, Buffer>();

/** Headers every response gets (OWASP HTTP Headers Cheat Sheet [S]): no MIME sniffing, no framing, no referrer leaks. */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
});
/** The game page only loads its own bundle, fonts and images; WebSocket to the same host; Pixi may use blob workers
 *  and data/blob images; Preact sets inline styles through the CSSOM (allowed), but some components set style text. */
export const PAGE_CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self' data:", "connect-src 'self' ws: wss:", "worker-src 'self' blob:", "media-src 'self' data: blob:",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

/**
 * Returns a request handler that serves files from `root`; it resolves true when it handled the request.
 * The directory is checked per request so a client build that appears while the server runs is picked up.
 */
export function createStaticHandler(root: string): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const rootAbs = path.resolve(root);

  const statFile = async (file: string): Promise<fs.Stats | null> => {
    try {
      const st = await fs.promises.stat(file);
      return st.isFile() ? st : null;
    } catch {
      return null;
    }
  };

  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return true;
    }
    if (pathname.includes('\0')) { res.writeHead(400).end('Bad request'); return true; }

    let rel = path.posix.normalize(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = path.join(rootAbs, rel);
    if (file !== rootAbs && !file.startsWith(rootAbs + path.sep)) { res.writeHead(403).end('Forbidden'); return true; }

    let st = await statFile(file);
    if (!st) {
      // Unknown path without an extension: single-page-app fallback. With an extension: a real 404.
      if (path.extname(rel)) return false;
      file = path.join(rootAbs, 'index.html');
      st = await statFile(file);
      if (!st) return false;
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    const hashed = /[./-][A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(path.basename(file)) && rel.startsWith('/assets/');
    const headers: Record<string, string | number> = {
      ...BASE_SECURITY_HEADERS,
      'Content-Type': type,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Last-Modified': st.mtime.toUTCString(),
      ...(ext === '.html' ? { 'Content-Security-Policy': PAGE_CSP } : {}),
    };

    const wantsGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? '')) && st.size > 512;
    try {
      if (wantsGzip) {
        const cacheKey = `${file}:${st.mtimeMs}:${st.size}`;
        let gz = gzipCache.get(cacheKey);
        if (!gz) {
          gz = zlib.gzipSync(await fs.promises.readFile(file), { level: 6 });
          if (gzipCache.size > 256) gzipCache.clear();
          gzipCache.set(cacheKey, gz);
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        headers['Content-Length'] = gz.length;
        res.writeHead(200, headers);
        res.end(req.method === 'HEAD' ? undefined : gz);
        return true;
      }
      headers['Content-Length'] = st.size;
      res.writeHead(200, headers);
      if (req.method === 'HEAD') { res.end(); return true; }
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      return true;
    } catch {
      if (!res.headersSent) res.writeHead(500).end('Server error');
      else res.destroy();
      return true;
    }
  };
}
