// Originality gate (F-CON-03): finds player-facing strings that use a signature term of another game. Terms are kept
// only as SHA-256 digests (docs/originality/signature-terms.json; D3 skill/rune labels in reference-name-hashes.json)
// and compared with 1–3-word n-grams of every string literal and JSX text in shipped source. Known matches waiting for
// a rename live in docs/originality/allowlist.json with a reason; anything new fails `npm run content:check`.
//
//   npx tsx scripts/originality-check.ts                 report
//   npx tsx scripts/originality-check.ts --write-allow   accept every current match (reason: pending rename)

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const labelNorm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

interface Term { h: string; words: number; game: string; kind: string }
export interface OriginalityMatch { file: string; line: number; text: string; game: string; kind: string }
interface AllowEntry { file: string; text: string; reason: string }

const SOURCE_DIRS = ['shared/src', 'client/src', 'server/src'];
const SKIP = (rel: string) => rel.includes('/dev/') || /\.test\.tsx?$/.test(rel);

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(e.name) && !SKIP(rel)) out.push(rel);
    }
  };
  for (const d of SOURCE_DIRS) walk(d);
  return out.sort();
}

/** String literal contents and JSX text with their line numbers; comments are skipped. */
export function extractTexts(code: string, jsx: boolean): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let i = 0, line = 1, stripped = '';
  while (i < code.length) {
    const c = code[i], n = code[i + 1];
    if (c === '\n') { line++; stripped += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const end = code.indexOf('*/', i + 2); const chunk = code.slice(i, end < 0 ? code.length : end + 2); line += chunk.split('\n').length - 1; stripped += '\n'.repeat(chunk.split('\n').length - 1); i += chunk.length; continue; }
    if (c === "'" || c === '"' || c === '`') {
      const start = line; let j = i + 1, text = '', depth = 0;
      while (j < code.length) {
        const d = code[j];
        if (d === '\\') { text += code[j + 1] === 'n' ? ' ' : code[j + 1] ?? ''; j += 2; continue; }
        if (c === '`' && d === '$' && code[j + 1] === '{') { depth++; text += ' '; j += 2; continue; }
        if (depth > 0) { if (d === '{') depth++; else if (d === '}') depth--; if (d === '\n') line++; j++; continue; }
        if (d === c) break;
        if (d === '\n') { if (c !== '`') break; line++; }
        text += d; j++;
      }
      out.push({ text, line: start });
      stripped += ' '.repeat(Math.max(0, j + 1 - i)).replace(/ /g, ' ');
      i = j + 1;
      continue;
    }
    stripped += c; i++;
  }
  if (jsx) {
    const lines = stripped.split('\n');
    lines.forEach((l, k) => { for (const m of l.matchAll(/>([^<>{}=;]*[A-Za-z][^<>{}=;]*)</g)) out.push({ text: m[1], line: k + 1 }); });
  }
  return out;
}

export function originalityMatches(): OriginalityMatch[] {
  const termFile = JSON.parse(fs.readFileSync(path.join(root, 'docs/originality/signature-terms.json'), 'utf8')) as { terms: Term[] };
  const terms = new Map(termFile.terms.map(t => [t.h, t]));
  const labels = new Set<string>();
  const refs = JSON.parse(fs.readFileSync(path.join(root, 'docs/originality/reference-name-hashes.json'), 'utf8')) as { records: { labels: { normalized: string }[] }[] };
  for (const r of refs.records) for (const l of r.labels) labels.add(l.normalized);
  const out: OriginalityMatch[] = [];
  for (const file of sourceFiles()) {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    for (const { text, line } of extractTexts(code, file.endsWith('.tsx'))) {
      if (!/[A-Z]/.test(text) && !/ /.test(text)) continue; // identifiers and ids are lower-case single words
      if (/^[A-Za-z0-9_.:-]+$/.test(text) && text.includes('.')) continue; // message keys like controls.paragon.label
      if (text.length > 400) continue;
      const words = norm(text).split(' ').filter(Boolean);
      const found = new Set<string>();
      for (let n = 1; n <= 3; n++) for (let k = 0; k + n <= words.length; k++) {
        const gram = words.slice(k, k + n).join(' ');
        // Also the singular of a plain English plural ("goblins" → "goblin").
        for (const g of gram.endsWith('s') && !gram.endsWith('ss') ? [gram, gram.slice(0, -1)] : [gram]) {
          const t = terms.get(sha(g));
          if (t && t.words === n) found.add(`${t.game}|${t.kind}`);
        }
      }
      if (text.length <= 40 && labels.has(sha(labelNorm(text)))) found.add('D3|skill or rune label');
      for (const f of found) { const [game, kind] = f.split('|'); out.push({ file, line, text: text.trim(), game, kind }); }
    }
  }
  return out;
}

const allowFile = path.join(root, 'docs/originality/allowlist.json');
export function originalityProblems(): { errors: string[]; stale: string[]; matches: OriginalityMatch[] } {
  const matches = originalityMatches();
  const allow: AllowEntry[] = fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, 'utf8')).entries : [];
  const key = (file: string, text: string) => `${file}\u0000${text}`;
  const allowed = new Set(allow.map(a => key(a.file, a.text)));
  const seen = new Set(matches.map(m => key(m.file, m.text)));
  const errors = matches.filter(m => !allowed.has(key(m.file, m.text)))
    .map(m => `originality: ${m.file}:${m.line} "${m.text.slice(0, 80)}" uses a ${m.game} ${m.kind}; choose an original term (docs/rework/partials/NAME-REGISTER.md) or add a reasoned allowlist entry`);
  const stale = allow.filter(a => !seen.has(key(a.file, a.text))).map(a => `${a.file}: "${a.text.slice(0, 60)}"`);
  return { errors: [...new Set(errors)], stale, matches };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write-allow')) {
    const matches = originalityMatches();
    const old: AllowEntry[] = fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, 'utf8')).entries : [];
    const reason = (m: OriginalityMatch) => old.find(o => o.file === m.file && o.text === m.text)?.reason ?? 'pending rename; see docs/rework/partials/NAME-REGISTER.md';
    const entries = [...new Map(matches.map(m => [`${m.file}\u0000${m.text}`, { file: m.file, text: m.text, reason: reason(m) }])).values()];
    fs.writeFileSync(allowFile, JSON.stringify({ note: 'Known matches of other games\' signature terms, each waiting for a rename or kept with a reason. New matches fail content:check.', entries }, null, 2) + '\n');
    console.log(`${entries.length} allowlist entries written`);
  } else {
    const { errors, stale, matches } = originalityProblems();
    for (const m of matches) console.log(`${m.file}:${m.line}  ${m.game} ${m.kind}  "${m.text.slice(0, 90)}"`);
    if (stale.length) console.log(`\n${stale.length} stale allowlist entries (already renamed): \n  ${stale.join('\n  ')}`);
    if (errors.length) { console.error(`\n${errors.length} new match(es):\n${errors.join('\n')}`); process.exitCode = 1; }
    else console.log(`\n${matches.length} known match(es), none new.`);
  }
}
