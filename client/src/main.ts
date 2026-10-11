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
// The served page has a strict CSP without 'unsafe-eval' (server/src/net/static.ts PAGE_CSP); Pixi then needs its
// eval-free shader/uniform path, which this module installs. Must load before any renderer is created.
import 'pixi.js/unsafe-eval';
import { h, render } from 'preact';
import { Game } from './game/game';
import { startPreviews } from './game/previews';
import { cmd, session } from './net/api';
import { initArt } from './render/art';
import { App } from './ui/App';
import { ui } from './ui/store';
import { preferences } from './game/preferences';
import { GraphicsController, resolutionFor } from './game/quality';

async function boot() {
  await Promise.all([
    document.fonts.load('700 24px Cinzel'),
    document.fonts.load('400 24px Cinzel'),
    document.fonts.load('24px "Lilita One"'),
    document.fonts.load('400 16px "Alegreya Sans"'),
    document.fonts.load('700 16px "Alegreya Sans"'),
  ]).catch(() => undefined);

  const app = new Application();
  const prefs = preferences.get().values;
  await app.init({
    resizeTo: window,
    // Antialiasing is fixed when the renderer is created; the Graphics setting takes effect on the next load.
    antialias: prefs.antialias,
    background: 0x07060a,
    resolution: resolutionFor(prefs),
    autoDensity: true,
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  document.getElementById('game')!.appendChild(app.canvas);
  initArt(app.renderer);

  const game = new Game(app);
  const graphics = new GraphicsController(app, () => game.scene.refreshViewScale());
  session.start = (name, classId, options) => { void game.start(name, classId, options); };
  session.auth = (op, fields) => game.auth(op, fields);
  session.initAccount = () => game.initAccount();
  render(h(App, null), document.getElementById('ui')!);
  void session.initAccount();
  // Animated hero canvases: class select, and in game the gear showcase (character panel, inspect). The observer
  // destroys previews whose canvas left the DOM, so it can stay on for the whole session.
  startPreviews();

  // Dev convenience: ?autostart=Name&class=mage jumps straight into the world.
  const qs = new URLSearchParams(location.search);
  const auto = qs.get('autostart');
  if (auto) session.start(auto, (qs.get('class') as 'warrior' | 'ranger' | 'mage') ?? 'warrior');

  Object.assign(window as object, { __game: game, __cmd: cmd, __ui: ui, __prefs: preferences, __graphics: graphics });
}

void boot();
