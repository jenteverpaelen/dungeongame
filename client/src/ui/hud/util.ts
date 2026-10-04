// Shared helpers for the HUD: colour conversion, time hooks, class / resource palettes.

import { useEffect, useRef, useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { GEMS } from '@shared/data/items';
import type { ClassId } from '@shared/types';

export const hex = (n: number): string => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Re-renders the caller every `ms` while `active` and returns performance.now(). */
export function useNow(ms: number, active = true): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}

/**
 * Tracks the total length of a running cooldown so a sweep can be drawn from the remaining time alone.
 * A new cooldown is detected when the remaining time jumps up.
 */
export function useCooldownTotal(remaining: number, nominal: number): number {
  const prev = useRef(0);
  const total = useRef(0);
  if (remaining <= 0) total.current = 0;
  else if (total.current === 0) total.current = Math.max(remaining, nominal);
  else if (remaining > prev.current + 60) total.current = Math.max(remaining, 1);
  prev.current = remaining;
  return total.current || remaining;
}

export interface ResourceStyle { name: string; hi: string; mid: string; lo: string; glow: string; text: string }

/** Liquid colour ramps (surface -> body -> depth). Fury is shifted towards orange so it never reads as Life. */
export const LIFE_STYLE: ResourceStyle = { name: 'Life', hi: '#ff7a64', mid: '#d4261e', lo: '#4c0508', glow: '#ff4a38', text: '#ffd9d2' };

export const RESOURCE_STYLES: Record<ClassId, ResourceStyle> = {
  warrior: { name: CLASSES.warrior.resource.name, hi: '#ffc15c', mid: '#ee6a14', lo: '#6a1c04', glow: '#ff9a2e', text: '#ffe6c2' },
  ranger: { name: CLASSES.ranger.resource.name, hi: '#ff86b4', mid: '#c2205a', lo: '#3f0620', glow: '#ff4f8f', text: '#ffd6e6' },
  mage: { name: CLASSES.mage.resource.name, hi: '#8cc0ff', mid: '#3a62f0', lo: '#0c1650', glow: '#6aa0ff', text: '#d6e6ff' },
};

/** Lightened class colours for name text on dark backgrounds. */
export const CLASS_TEXT: Record<ClassId, string> = { warrior: '#ff8a68', ranger: '#86dc72', mage: '#7eb0ff' };
export const CLASS_NAME: Record<ClassId, string> = { warrior: 'Warrior', ranger: 'Ranger', mage: 'Mage' };

export function gemColor(name: string): string {
  const low = name.toLowerCase();
  for (const g of Object.values(GEMS)) if (low.includes(g.name.toLowerCase())) return hex(g.color);
  return '#cfe9ff';
}

export function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function safeSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* storage unavailable */ }
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
