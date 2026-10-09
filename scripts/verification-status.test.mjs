import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageStatus, verificationOutcome } from './verification-status.mjs';

const knownOutput = `  FAIL  server shuts down gracefully on SIGTERM (exit code 0)  -> null
  FAIL  shutdown saved characters
731 passed, 2 failed in 87.3 s
`;
const run = { platform:'win32', name:'server', exitCode:1, output:knownOutput };
test('known shutdown failures stay failures by default and never become a clean pass', () => {
  const results = [{ status:stageStatus(run) }];
  assert.equal(results[0].status, 'known-windows-failures');
  assert.equal(verificationOutcome(results, 1), 'failed');
  assert.equal(verificationOutcome(results, 1, {allowKnown:true}), 'passed-with-known-failures');
});
test('additional failures, different errors, crashes and incomplete runs cannot be allowlisted', () => {
  for (const patch of [
    {output:knownOutput+'  FAIL  inventory lost\n'},
    {output:knownOutput.replace('shutdown saved characters','inventory lost')},
    {output:knownOutput.replace('2 failed','3 failed')},
    {output:knownOutput.replace(/731 passed[^\n]+/,'')},
    {output:knownOutput+'731 passed, 2 failed in 87.3 s\n'},
    {exitCode:-1}, {exitCode:2}, {platform:'linux'}, {name:'simulation'},
  ]) assert.equal(stageStatus({...run,...patch}), 'failed', JSON.stringify(patch));
  assert.equal(verificationOutcome([{status:'passed'}],2,{allowKnown:true}),'failed');
  assert.equal(verificationOutcome([{status:'passed'}],1,{allowKnown:true,interrupted:true}),'failed');
  assert.equal(verificationOutcome([{status:'failed'}],1,{allowKnown:true}),'failed');
});
