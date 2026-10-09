import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedWebSocketOrigin, webSocketOrigins } from '../src/net/origin';

test('local defaults enumerate only the configured game port and documented dev port', () => {
  const origins = webSocketOrigins(undefined, 2577);
  assert.equal(origins.size, 6);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.ok(origins.has(`http://${host}:2577`));
    assert.ok(origins.has(`http://${host}:5173`));
  }
  assert.ok(!origins.has('http://localhost:2567'));
  assert.ok(!origins.has('http://192.168.1.5:2577'));
  assert.ok(webSocketOrigins(undefined, 80).has('http://localhost'));
});

test('explicit canonical origins replace defaults and tolerate separators whitespace', () => {
  assert.deepEqual([...webSocketOrigins(' https://play.example , https://play.example:8443 ', 2567)],
    ['https://play.example', 'https://play.example:8443']);
});

test('empty ambiguous or permissive configuration fails closed', () => {
  for (const value of ['', ' ', '*', 'https://*.example', 'null', 'file:///', 'ws://play.example',
    'https://play.example/', 'https://play.example/path', 'https://u:p@play.example',
    'https://play.example?q=x', 'https://play.example#x', 'https://PLAY.example', 'https://play.example:443',
    'https://play.example,', ',https://play.example', 'https://play.example https://stage.example']) {
    assert.throws(() => webSocketOrigins(value, 2567), /WS_ALLOWED_ORIGINS/, value);
  }
});

test('one exact browser header is required even when Node discards duplicate headers', () => {
  const allowed = webSocketOrigins('https://play.example', 2567);
  const check = (value: string | undefined, rawHeaders: string[]) => allowedWebSocketOrigin({ headers: { origin: value }, rawHeaders }, allowed);
  assert.ok(check('https://play.example', ['Origin', 'https://play.example']));
  assert.ok(!check(undefined, []));
  assert.ok(!check('null', ['Origin', 'null']));
  assert.ok(!check('https://play.example/', ['Origin', 'https://play.example/']));
  assert.ok(!check('https://play.example.evil.example', ['Origin', 'https://play.example.evil.example']));
  assert.ok(!check('https://play.example', ['Origin', 'https://play.example', 'oRiGiN', 'https://evil.example']));
});
