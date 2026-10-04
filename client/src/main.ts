// Boot: fonts, renderer, UI, class-select previews, game controller.

import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/400-italic.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import './ui/styles/tokens.css';

import { Application } from 'pixi.js';
import { h, render } from 'preact';
import { Game } from './game/game';
import { startPreviews, stopPreviews } from './game/previews';
import { cmd, session } from './net/api';
import { initArt } from './render/art';
import { App } from './ui/App';
import { ui } from './ui/store';

async function boot() {
  await Promise.all([
    document.fonts.load('700 24px Cinzel'),
    document.fonts.load('400 24px Cinzel'),
    document.fonts.load('24px "Lilita One"'),
    document.fonts.load('400 16px "Alegreya Sans"'),
    document.fonts.load('700 16px "Alegreya Sans"'),
  ]).catch(() => undefined);

  const app = new Application();
  await app.init({
    resizeTo: window,
    antialias: true,
    background: 0x07060a,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  document.getElementById('game')!.appendChild(app.canvas);
  initArt(app.renderer);

  const game = new Game(app);
  session.start = (name, classId) => { void game.start(name, classId); };
  render(h(App, null), document.getElementById('ui')!);
  startPreviews();
  ui.subscribe(() => { if (ui.get().screen === 'game') stopPreviews(); });

  // Dev convenience: ?autostart=Name&class=mage jumps straight into the world.
  const qs = new URLSearchParams(location.search);
  const auto = qs.get('autostart');
  if (auto) session.start(auto, (qs.get('class') as 'warrior' | 'ranger' | 'mage') ?? 'warrior');

  Object.assign(window as object, { __game: game, __cmd: cmd, __ui: ui });
}

void boot();
