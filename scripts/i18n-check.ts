// Localization ratchet (F-CON-01 / F-CON-02): files listed in scripts/i18n-localized.json must take every visible
// string from the message catalogue (client/src/i18n). Inline JSX text and literal aria-label / title / placeholder /
// alt attributes in those files fail content:check, so an extracted screen cannot silently regain hard-coded English.
// Missing keys are already a type error (text() is typed by the catalogue), and validateMessages() checks the catalogue.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = path.join(root, 'scripts/i18n-localized.json');

/** Inline visible text in TSX source (comments and string literals removed before looking for JSX text). */
export function inlineTexts(code: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let stripped = '', i = 0;
  while (i < code.length) {
    const c = code[i], n = code[i + 1];
    if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const end = code.indexOf('*/', i + 2), chunk = code.slice(i, end < 0 ? code.length : end + 2); stripped += chunk.replace(/[^\n]/g, ' '); i += chunk.length; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) { if (code[j] === '\\') j++; if (code[j] === '\n' && c !== '`') break; j++; }
      const chunk = code.slice(i, j + 1);
      // Keep attribute string values visible for the attribute rule below; blank every other literal.
      const before = stripped.slice(-20);
      stripped += /\b(aria-label|title|placeholder|alt)=$/.test(before) ? chunk : chunk.replace(/[^\n]/g, ' ');
      i = j + 1;
      continue;
    }
    stripped += c; i++;
  }
  stripped.split('\n').forEach((l, k) => {
    for (const m of l.matchAll(/>([^<>{}=;()]*[A-Za-z][^<>{}=;()]*)</g)) if (m[1].trim()) out.push({ line: k + 1, text: m[1].trim() });
    for (const m of l.matchAll(/\b(?:aria-label|title|placeholder|alt)=(["'])([^"']*[A-Za-z][^"']*)\1/g)) out.push({ line: k + 1, text: m[2] });
  });
  return out;
}

export function localizationProblems(): { errors: string[]; files: number } {
  const files: string[] = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, 'utf8')).files : [];
  const errors: string[] = [];
  for (const rel of files) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) { errors.push(`i18n: ${rel} is listed as localized but does not exist`); continue; }
    for (const t of inlineTexts(fs.readFileSync(file, 'utf8'))) errors.push(`i18n: ${rel}:${t.line} has inline text "${t.text.slice(0, 60)}"; move it to the message catalogue`);
  }
  return { errors, files: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = localizationProblems();
  if (r.errors.length) { console.error(r.errors.join('\n')); process.exitCode = 1; }
  else console.log(`${r.files} localized file(s), no inline text.`);
}
