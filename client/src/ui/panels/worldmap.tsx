import { useMemo, useState } from 'preact/hooks';
import { TILE } from '@shared/constants';
import { ZONES } from '@shared/data/zones';
import { QUESTS } from '@shared/data/quests';
import { questText } from '@shared/data/questMessages';
import { CollisionWorld } from '@shared/movement';
import { questCompleted, questMarker, questObjective, questPoint, questUnlocks, trackedQuest, zoneLevelAllowed, zoneUnlocked } from '@shared/quests';
import { worldConnections, zoneRoute } from '@shared/worldNavigation';
import type { MapData } from '@shared/mapgen';
import type { CharacterSave } from '@shared/types';
import { text as t } from '../../i18n/messages';
import { togglePanel, useUI, worldReader } from '../store';
import { bakeMapTerrain } from '../mapTerrain';
import { ACT_LABELS, MAP_H, MAP_W, WORLD_LAYOUT, worldMapImage, type MapNode } from '../worldMapArt';
import { UiIcon, type UiIconName } from '../hud/UiIcons';
import { PanelFrame, Tabs } from './common';
import { openJournal } from './adventure';
import { run } from './util';

// Roads are the real exit graph (unique pairs); waypoints are marked on the node instead of drawn as spokes.
const ROADS = (() => {
  const seen = new Set<string>(), out: [string, string][] = [];
  for (const e of worldConnections()) if (e.kind === 'exit' && WORLD_LAYOUT[e.from] && WORLD_LAYOUT[e.to]) {
    const k = [e.from, e.to].sort().join('|'); if (!seen.has(k)) { seen.add(k); out.push([e.from, e.to]); }
  }
  return out;
})();
const WAYPOINTS = new Set(worldConnections().filter((e) => e.kind === 'waypoint').map((e) => e.to));
const PLACES = Object.keys(WORLD_LAYOUT).filter((id) => ZONES[id]);

function routeLock(save: CharacterSave, id: string) {
  return QUESTS.find((q) => questUnlocks(q).includes(id) && !questCompleted(save, q.id));
}
function road(a: MapNode, b: MapNode, bend: number) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return `M${a.x},${a.y} Q${mx - (dy / len) * bend},${my + (dx / len) * bend} ${b.x},${b.y}`;
}
const bendOf = (a: string, b: string) => ((a.length * 7 + b.length * 3) % 2 ? 1 : -1) * 14;
const kindIcon = (kind: string): UiIconName => (kind === 'town' ? 'house' : kind === 'dungeon' ? 'gate' : 'field');

export function WorldMapPanel() {
  const save = useUI((s) => s.char), zone = useUI((s) => s.zone), me = useUI((s) => s.me);
  const [view, setView] = useState<'chart' | 'area'>('chart');
  const [selected, setSelected] = useState(zone?.zone && WORLD_LAYOUT[zone.zone] ? zone.zone : 'hearthmere');
  const [busy, setBusy] = useState(false);
  const map = worldReader.current?.map() ?? null;
  const terrain = useMemo(() => (map ? bakeMapTerrain(map).canvas.toDataURL() : null), [map]);
  const chart = useMemo(() => worldMapImage(), []);
  const cw = useMemo(() => (map ? new CollisionWorld(map) : null), [map]);
  if (!save || !zone) return null;
  const def = ZONES[selected] ?? ZONES.hearthmere;
  const quest = trackedQuest(save), objective = quest && questObjective(save, quest);
  const point = map && objective && questPoint(map, objective, save);
  const route = objective ? zoneRoute(zone.zone, objective.zone, (id) => zoneUnlocked(save, id)) : [];
  const toSelected = zoneRoute(zone.zone, def.id, (id) => zoneUnlocked(save, id));
  const locked = routeLock(save, def.id), tooLow = !zoneLevelAllowed(save, def.id), here = zone.zone === def.id;
  const near = (p: { x: number; y: number }, r: number) => !!me && !me.dead && me.hp > 0 && Math.hypot(me.x - p.x, me.y - p.y) <= r && !cw?.segmentBlocked(me.x, me.y, p.x, p.y);
  const waypoint = map?.town?.npcs.find((n) => n.role === 'waypoint');
  const besideWaypoint = !!waypoint && near(waypoint, waypoint.interactionRadius);
  const besideExit = map?.portals.some((p) => p.to === def.id && near(p, 110));
  const canTravel = !here && !locked && !tooLow && !me?.dead && ((besideWaypoint && def.kind !== 'dungeon') || besideExit);
  const travel = async () => { setBusy(true); try { const r = await run('travel', { zone: def.id }); if (r.ok) togglePanel('worldmap', false); } finally { setBusy(false); } };
  const open = (id: string) => zoneUnlocked(save, id);
  const routePairs = new Set(route.slice(1).map((id, i) => [route[i], id].sort().join('|')));
  const levels = (id: string) => { const z = ZONES[id]; return z.kind === 'town' ? t('map.kind.town') : t('map.levels', { from: String(z.levelBand[0]), to: String(z.levelBand[1]) }); };

  return <PanelFrame id="worldmap" title={t('map.title')} width={1320} sub={zone.name}>
    <Tabs tabs={[{ id: 'chart', label: t('map.chart') }, { id: 'area', label: t('map.areaTab') }]} value={view} onChange={setView} />
    {view === 'chart' ? <div class="wmx">
      <div class="wmx-chart" role="group" aria-label={t('map.chart')}>
        <img src={chart} alt="" draggable={false} />
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="wmx-fog"><stop offset="0" stop-color="#16120e" stop-opacity=".82" /><stop offset=".62" stop-color="#16120e" stop-opacity=".55" /><stop offset="1" stop-color="#16120e" stop-opacity="0" /></radialGradient>
          </defs>
          {ROADS.map(([a, b]) => { const d = road(WORLD_LAYOUT[a], WORLD_LAYOUT[b], bendOf(a, b)), live = open(a) && open(b);
            return <g key={`${a}|${b}`} class={`wmx-road ${live ? '' : 'locked'}`}><path d={d} class="edge" /><path d={d} class="bed" /></g>; })}
          {ROADS.filter(([a, b]) => routePairs.has([a, b].sort().join('|'))).map(([a, b]) => <path key={`r${a}|${b}`} class="wmx-route" d={road(WORLD_LAYOUT[a], WORLD_LAYOUT[b], bendOf(a, b))} />)}
          {PLACES.filter((id) => !open(id)).map((id) => <circle key={`f${id}`} cx={WORLD_LAYOUT[id].x} cy={WORLD_LAYOUT[id].y} r={112} fill="url(#wmx-fog)" />)}
        </svg>
        {ACT_LABELS.map((a) => <span key={a.act} class="wmx-act" style={{ left: `${(a.x / MAP_W) * 100}%`, top: `${(a.y / MAP_H) * 100}%` }}>{a.text}</span>)}
        {PLACES.map((id) => {
          const n = WORLD_LAYOUT[id], z = ZONES[id], current = zone.zone === id, isOpen = open(id), lowLevel = !zoneLevelAllowed(save, id);
          const pinned = objective?.zone === id;
          return <button key={id} class={`wmx-node ${z.kind} ${current ? 'current' : ''} ${selected === id ? 'selected' : ''} ${isOpen ? '' : 'fogged'}`}
            style={{ left: `${(n.x / MAP_W) * 100}%`, top: `${(n.y / MAP_H) * 100}%` }} onClick={() => setSelected(id)} aria-pressed={selected === id}
            title={`${z.name} · ${levels(id)}`}>
            <span class="wmx-medal"><UiIcon name={isOpen ? kindIcon(z.kind) : 'lock'} size={18} /></span>
            <span class="wmx-label"><strong>{isOpen ? z.name : z.name}</strong><small>{!isOpen ? t('map.unexplored') : lowLevel ? t('map.level', { level: String(z.levelBand[0]) }) : levels(id)}</small></span>
            {WAYPOINTS.has(id) && isOpen && <span class="wmx-wp" title={t('map.legend.waypoint')}><UiIcon name="waypoint" size={13} /></span>}
            {pinned && <span class="wmx-pin" title={t('map.legend.quest')}>!</span>}
            {current && <span class="wmx-here"><span>{t('map.here')}</span></span>}
          </button>;
        })}
      </div>
      <aside class="wmx-detail">
        <header>
          <span class="wmx-medal big"><UiIcon name={open(def.id) ? kindIcon(def.kind) : 'lock'} size={24} /></span>
          <div><h3>{def.name}</h3><span class="chip">{def.kind === 'town' ? t('map.kind.town') : def.kind === 'dungeon' ? t('map.kind.dungeon') : t('map.kind.field')}</span>{def.kind !== 'town' && <span class="chip">{levels(def.id)}</span>}</div>
        </header>
        <p class="wmx-blurb">{def.blurb}</p>
        <div class="wmx-status">
          {here && <span class="chip good">{t('map.here')}</span>}
          {!here && !locked && !tooLow && <span class="chip">{t('map.available')}</span>}
          {locked && <span class="chip bad"><UiIcon name="lock" size={12} /> {t('map.locked')}</span>}
          {tooLow && <span class="chip bad">{t('map.level', { level: String(def.levelBand[0]) })}</span>}
        </div>
        {locked && <p class="wm-status">{t('map.requires', { quest: questText(locked.title) })}</p>}
        {!here && toSelected.length > 1 && <><h4>{t('map.fromHere')}</h4><ol class="wmx-steps">{toSelected.map((id) => <li key={id} class={id === zone.zone ? 'from' : ''}>{ZONES[id]?.name ?? id}</li>)}</ol></>}
        <div class="wmx-actions">
          {!here && <button class="btn primary" disabled={!canTravel || busy} onClick={() => void travel()}>{t(busy ? 'map.travelling' : 'map.travel')}</button>}
          {!here && !canTravel && !locked && !tooLow && <p class="pn-note">{t(me?.dead ? 'map.dead' : 'map.physical')}</p>}
          {besideWaypoint && <button class="btn" onClick={() => togglePanel('waypoint', true)}>{t('map.waypoint')}</button>}
        </div>
        <h4>{t('map.objective')}</h4>
        {quest && objective ? <div class="wmx-quest">
          <strong>{questText(quest.title)}</strong>
          <p>{objective.text} · {ZONES[objective.zone]?.name}</p>
          {objective.zone !== zone.zone && <p class="pn-note">{route.length ? t('map.route', { route: route.map((id) => ZONES[id]?.name ?? id).join(' → ') }) : t('map.noRoute')}</p>}
          <div class="wmx-actions">
            {WORLD_LAYOUT[objective.zone] && objective.zone !== def.id && <button class="btn sm" onClick={() => setSelected(objective.zone)}><UiIcon name="pin" size={14} /> {t('map.showObjective')}</button>}
            <button class="btn sm quiet" onClick={openJournal}>{t('map.journal')}</button>
          </div>
        </div> : <p class="pn-note">{t('map.noObjective')}</p>}
      </aside>
      <footer class="wmx-legend">
        <span><i class="lg here" />{t('map.legend.here')}</span>
        <span><i class="lg pin">!</i>{t('map.legend.quest')}</span>
        <span><i class="lg route" />{t('map.legend.route')}</span>
        <span><i class="lg road" />{t('map.legend.road')}</span>
        <span><UiIcon name="waypoint" size={14} />{t('map.legend.waypoint')}</span>
        <span><UiIcon name="gate" size={14} />{t('map.legend.dungeon')}</span>
        <span><UiIcon name="lock" size={14} />{t('map.legend.locked')}</span>
        <span class="wmx-note">{t('map.chartNote')}</span>
      </footer>
    </div> : map && terrain ? <div class="wmx-area-view">
      <LocalMap map={map} save={save} terrain={terrain} me={me} point={point || undefined} objectiveLabel={objective?.text} />
      <aside class="wmx-detail">
        <h3>{zone.name}</h3>
        <p class="pn-note">{t('map.groundNote')}</p>
        <div class="wm-key"><span>▲ {t('map.here')}</span><span>◆ {t('map.objective')}</span><span>○ {t('map.services')}</span><span>↗ {t('map.exits')}</span></div>
        <h4>{t('map.exits')}</h4>
        <div class="wm-locations">{map.portals.map((p, i) => <button class="btn sm" key={i} onClick={() => { setSelected(WORLD_LAYOUT[p.to] ? p.to : selected); setView('chart'); }}>↗ {p.label}</button>)}</div>
      </aside>
    </div> : <p>{t('map.noArea')}</p>}
  </PanelFrame>;
}

function LocalMap({ map, save, terrain, me, point, objectiveLabel }: { map: MapData; save: CharacterSave; terrain: string; me: { x: number; y: number } | null; point?: { x: number; y: number }; objectiveLabel?: string }) {
  const w = map.w * TILE, h = map.h * TILE;
  const [selected, setSelected] = useState<string | null>(null);
  const npcs = map.npcs.filter((n) => n.role !== 'dummy');
  // Frame the walkable ground (plus a margin) instead of the whole canvas, keeping the panel's 1.7:1 shape.
  const floors = map.town?.floors.map((f) => f.polygon) ?? map.adventure?.geometry.floors.map((f) => f.polygon) ?? [];
  const pts = floors.flat();
  let vx = 0, vy = 0, vw = w, vh = h;
  if (pts.length) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = 260;
    vx = Math.max(0, Math.min(...xs) - m); vy = Math.max(0, Math.min(...ys) - m); vw = Math.min(w, Math.max(...xs) + m) - vx; vh = Math.min(h, Math.max(...ys) + m) - vy;
    const aspect = 1.7;
    if (vw / vh > aspect) { const nh = vw / aspect; vy = Math.max(0, vy - (nh - vh) / 2); vh = nh; } else { const nw = vh * aspect; vx = Math.max(0, vx - (nw - vw) / 2); vw = nw; }
  }
  // Glyph dimensions are in map units so they stay legible at the panel's fixed height.
  const r = Math.max(vw, vh) / 110;
  const label = (x: number, y: number, s: string, cls = '') => <text x={x} y={y + r * 2.6} class={`wmx-maplabel ${cls}`} font-size={r * 1.9} stroke-width={r * 0.45}>{s}</text>;
  return <div class="wmx-area-map"><svg class="wm-area" viewBox={`${vx} ${vy} ${vw} ${vh}`} role="img" aria-label={t('map.currentArea', { zone: ZONES[map.zone]?.name ?? map.zone })}>
    <image href={terrain} x="0" y="0" width={w} height={h} />
    {npcs.map((n) => <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => setSelected(n.id)}>
      <title>{n.name} · {n.role}</title><circle r={r * (n.id === selected ? 1.4 : 0.75)} class="service" />
      <text y={-r} text-anchor="middle" fill="#ffdb83" stroke="#140e0a" stroke-width={r / 8} paint-order="stroke" font-size={r * 2.5} font-weight="bold">{questMarker(save, map.zone, n.id)}</text>
      {label(0, 0, n.name.split(' · ')[0], n.id === selected ? 'sel' : '')}
    </g>)}
    {map.portals.map((p, i) => <g key={i} transform={`translate(${p.x},${p.y})`}><title>{p.label}</title><circle r={r} class="exit" />{label(0, 0, `↗ ${ZONES[p.to]?.name ?? p.label}`, 'exit')}</g>)}
    {point && <g transform={`translate(${point.x},${point.y})`}><title>{objectiveLabel}</title><path d={`M0 ${-r * 1.4} L${r} 0 0 ${r * 1.4} ${-r} 0 Z`} class="objective" /></g>}
    {me && <g transform={`translate(${me.x},${me.y})`}><title>{t('map.here')}</title><path d={`M0 ${-r * 1.6} L${r} ${r} 0 ${r * 0.4} ${-r} ${r} Z`} class="player" /></g>}
  </svg>
  {npcs.length > 0 && <div class="wm-locations">{npcs.map((n) => <button key={n.id} class={`btn sm ${n.id === selected ? 'primary' : ''}`} aria-pressed={n.id === selected} onClick={() => setSelected(n.id)}>{n.name}</button>)}</div>}
  </div>;
}
