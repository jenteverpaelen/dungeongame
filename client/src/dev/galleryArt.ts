import { Application, Graphics } from 'pixi.js';
const app = new Application();
await app.init({ resizeTo: window, antialias: true, background: 0x14110e, preference: 'webgl' });
document.getElementById('stage')!.appendChild(app.canvas);
const g = new Graphics().circle(200, 200, 60).fill(0x6fbf4a).stroke({ color: 0x1b1410, width: 3 });
app.stage.addChild(g);
(window as any).__ready = true;
