const knownFailures = [
  'server shuts down gracefully on SIGTERM (exit code 0)  -> null',
  'shutdown saved characters',
];

export function stageStatus({ platform, name, exitCode, output }) {
  if (exitCode === 0) return 'passed';
  const failures = [...output.matchAll(/^\s*FAIL\s+(.+)$/gm)].map(m => m[1].trim());
  const summaries = [...output.matchAll(/^\d+ passed, (\d+) failed in .+$/gm)];
  return platform === 'win32' && name === 'server' && exitCode === 1
    && summaries.length === 1 && summaries[0][1] === '2' && failures.length === 2
    && knownFailures.every(f => failures.includes(f)) ? 'known-windows-failures' : 'failed';
}

export function verificationOutcome(results, expectedCount, { allowKnown = false, interrupted = false } = {}) {
  if (interrupted || results.length !== expectedCount
    || results.some(r => r.status !== 'passed' && !(allowKnown && r.status === 'known-windows-failures')))
    return 'failed';
  return results.some(r => r.status !== 'passed') ? 'passed-with-known-failures' : 'passed';
}
