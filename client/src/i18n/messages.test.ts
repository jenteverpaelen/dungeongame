import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGLISH } from './en';
import { formatMessage, text, validateMessages } from './messages';

assert.ok(process.env.DATA_DIR, 'Catalogue checks require isolated DATA_DIR');

test('catalogue validation rejects missing, inherited, unknown and empty messages', () => {
  assert.deepEqual(validateMessages(), []);
  const missing: Record<string, string> = { ...ENGLISH };
  delete missing['settings.title'];
  assert.match(validateMessages(missing).join('\n'), /missing or empty settings.title/);
  assert.ok(validateMessages(Object.create(ENGLISH)).length > 0, 'Inherited messages are not entries');
  assert.match(validateMessages({ ...ENGLISH, unexpected: 'Text' }).join('\n'), /unexpected key/);
  assert.match(validateMessages({ ...ENGLISH, 'settings.title': '  ' }).join('\n'), /missing or empty/);
  assert.ok(validateMessages(null).length > 0);
});

test('catalogue parameters can move but cannot disappear, rename or contain malformed syntax', () => {
  assert.deepEqual(validateMessages({ ...ENGLISH, 'controls.dash.assigned': '{key}: Dash assigned.' }), []);
  for (const value of ['Assigned.', '{other} assigned.', '{key', '{{key}}', '{key :number}']) {
    assert.ok(validateMessages({ ...ENGLISH, 'controls.dash.assigned': value }).length > 0, value);
  }
});

test('runtime values remain literal and formatting errors fail explicitly', () => {
  assert.equal(formatMessage('{second} then {first}', { first: 'one', second: 'two' }), 'two then one');
  const literal = '$& {key} <img src=x>';
  assert.equal(text('controls.dash.assigned', { key: literal }), `Dash assigned to ${literal}.`);
  assert.throws(() => formatMessage('{key}'), /Missing string/);
  assert.throws(() => formatMessage('Text', { extra: 'x' }), /Unexpected/);
  assert.throws(() => formatMessage('{key}', Object.create({ key: 'x' })), /Missing string/);
  assert.throws(() => formatMessage('{broken'), /Malformed/);
  // @ts-expect-error Unknown keys must also fail during typecheck.
  assert.throws(() => text('missing'), /Unknown message/);
  // @ts-expect-error The known runtime-key message requires its parameter.
  assert.throws(() => text('controls.dash.assigned'), /Missing string/);
  // @ts-expect-error A static message must not accept unrelated parameters.
  assert.throws(() => text('settings.title', { extra: 'x' }), /Unexpected/);
});
