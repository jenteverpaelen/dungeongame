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
import { FrontScene } from './render/front/frontScene';
import { bakeStats } from './render/art/player';
import { App } from './ui/App';
import { ui } from './ui/store';
import { preferences } from './game/preferences';
import { GraphicsController, applyFirstRunGraphics, resolutionFor } from './game/quality';
import { applyWeaponArtPreview } from './game/weaponArtPreview';

/** The WebGL driver's renderer name (unmasked when the browser allows it). */
function webglRendererName(app: Application): string {
  try {
    const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch { return ''; }
}

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
  // First visit on a software rasteriser (blocklisted GPU): start on the Low preset (docs/rework/PERF.md §Low-end defaults).
  applyFirstRunGraphics(preferences, webglRendererName(app));
  applyWeaponArtPreview(); // before the first view or icon: the weapon drawings are chosen once per page load
  initArt(app.renderer);

  const game = new Game(app);
  new FrontScene(app); // the camp behind the title, hero select and creator (docs/rework/ui/CHARACTER_SCREENS.md)
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

  // __bakes: hero sheets still queued for baking (the client perf gate measures once they are done)
  Object.assign(window as object, { __game: game, __cmd: cmd, __ui: ui, __prefs: preferences, __graphics: graphics, __bakes: bakeStats });
}

void boot();
