import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, GRAPHICS_PRESETS } from './preferences';
import { CVD_PALETTES, LowSpecMonitor, LOW_FPS_SECONDS, ambientShare, applyColorVision, effectsFactor, fpsCapFor, resolutionFor } from './quality';
import { RARITY_COLORS } from '@shared/items';

assert.ok(process.env.DATA_DIR, 'Client checks require an isolated DATA_DIR');

test('render resolution: automatic follows screen density up to 2, presets fix it', () => {
  assert.equal(resolutionFor({ renderScale: 0 }, 1), 1);
  assert.equal(resolutionFor({ renderScale: 0 }, 3), 2);
  assert.equal(resolutionFor(GRAPHICS_PRESETS.low, 2), 0.75);
  assert.equal(resolutionFor(GRAPHICS_PRESETS.medium, 2), 1);
});

test('frame caps: the unfocused cap only applies when set, and never raises the main cap', () => {
  assert.equal(fpsCapFor({ maxFps: 0, backgroundFps: 0 }, false), 0);
  assert.equal(fpsCapFor({ maxFps: 60, backgroundFps: 15 }, true), 60);
  assert.equal(fpsCapFor({ maxFps: 60, backgroundFps: 15 }, false), 15);
  assert.equal(fpsCapFor({ maxFps: 15, backgroundFps: 30 }, false), 15, 'the unfocused cap never exceeds the main cap');
  assert.equal(fpsCapFor({ maxFps: 0, backgroundFps: 5 }, false), 5);
});

test('effect and ambient density factors; reduce motion removes background movement', () => {
  assert.equal(effectsFactor({ ...DEFAULT_PREFERENCES }), 1);
  assert.equal(effectsFactor({ ...DEFAULT_PREFERENCES, ...GRAPHICS_PRESETS.low }), 0.2);
  assert.equal(ambientShare({ ...DEFAULT_PREFERENCES, motion: 'full', ambientDensity: 'reduced' }), 0.5);
  assert.equal(ambientShare({ ...DEFAULT_PREFERENCES, motion: 'reduce' }), 0);
});

test('low-spec suggestion: 20 slow in-game seconds, once, never while hidden, capped by the player or already Low', () => {
  const m = new LowSpecMonitor(), p = { ...DEFAULT_PREFERENCES };
  for (let i = 0; i < LOW_FPS_SECONDS - 1; i++) assert.equal(m.sample(30, true, true, p), false);
  assert.equal(m.sample(55, true, true, p), false, 'a fast second resets the count');
  for (let i = 0; i < LOW_FPS_SECONDS - 1; i++) m.sample(30, true, true, p);
  assert.equal(m.sample(30, true, true, p), true);
  assert.equal(m.sample(30, true, true, p), false, 'offered once per session');
  const hidden = new LowSpecMonitor();
  for (let i = 0; i < 40; i++) assert.equal(hidden.sample(10, true, false, p), false, 'hidden tabs pause rAF; their numbers mean nothing');
  const capped = new LowSpecMonitor();
  for (let i = 0; i < 40; i++) assert.equal(capped.sample(30, true, true, { ...p, maxFps: 30 }), false);
  const low = new LowSpecMonitor();
  for (let i = 0; i < 40; i++) assert.equal(low.sample(30, true, true, { ...p, ...GRAPHICS_PRESETS.low, graphicsPreset: 'low' }), false);
});

test('colour-vision presets swap the shared rarity colours and restore the defaults', () => {
  const before = { ...RARITY_COLORS };
  applyColorVision('deutan', null);
  assert.equal(RARITY_COLORS.set, CVD_PALETTES.deutan.set);
  applyColorVision('default', null);
  assert.deepEqual({ ...RARITY_COLORS }, before);
});
