// PANELS root: item tooltip, inventory + paperdoll, skills, paragon, cube, waypoint, obelisk and the debug panel.
// Mounted by ui/App.tsx next to the HUD. Open/close goes through the store (togglePanel / closeAllPanels).

import '../styles/panels.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { togglePanel, type PanelId } from '../store';
import { useU } from './state';
import { CubePanel } from './cube';
import { DebugPanel, ObeliskPanel, WaypointPanel } from './dialogs';
import { DragLayer } from './dnd';
import { InventoryPanel } from './inventory';
import { StashPanel } from './stash';
import { ParagonPanel } from './paragon';
import { SkillsPanel } from './skills';
import { SettingsPanel } from './settings';
import { AdventurePanel } from './adventure';
import { WorldMapPanel } from './worldmap';
import { RunSummaryPanel } from './runSummary';
import { TipLayer, hideTip, installAltTracking } from './tooltip';

export { ItemTooltip, showItemTooltip, hideItemTooltip, moveItemTooltip, itemHover } from './tooltip';
export type { ItemTooltipProps } from './tooltip';

/** Panels docked on the left; opening one closes the others (Diablo 3 behaviour). */
const LEFT_DOCK: PanelId[] = ['cube', 'stash', 'skills', 'paragon', 'waypoint', 'obelisk', 'settings', 'adventure', 'worldmap', 'runSummary'];

/** Panel scale from the viewport height: 1.0 at ~1000px, shrinking towards 720p, growing a little on tall screens. */
function useScale(): number {
  // Proportional to 1080p (where docks clear the HUD globes) down to 0.6, so 720p panels never cover the bottom bar.
  const calc = () => Math.max(0.6, Math.min(1.1, window.innerHeight / 1080));
  const [s, set] = useState(calc);
  useEffect(() => {
    const on = () => set(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

export function PanelsRoot() {
  const panels = useU((s) => s.panels);
  const ready = useU((s) => s.screen === 'game' && !!s.char);
  const scale = useScale();
  const prev = useRef<Partial<Record<PanelId, boolean>>>({});

  useEffect(() => installAltTracking(), []);

  useEffect(() => {
    const newly = LEFT_DOCK.filter((id) => panels[id] && !prev.current[id]);
    if (newly.length) {
      const keep = newly[newly.length - 1];
      for (const id of LEFT_DOCK) if (id !== keep && panels[id]) togglePanel(id, false);
      // The Cube works on items: bring the bag along so they can be clicked in.
      if ((keep === 'cube' || keep === 'stash') && !panels.inventory) togglePanel('inventory', true);
    }
    prev.current = panels;
  }, [panels]);

  useEffect(() => { if (!ready) hideTip(); }, [ready]);

  return (
    <div class="pn-root" style={{ '--pz': scale }}>
      {ready && (
        <>
          {panels.inventory && <div class="pn-dock right"><InventoryPanel /></div>}
          <div class="pn-dock left">
            {panels.cube && <CubePanel />}
            {panels.stash && <StashPanel />}
            {panels.skills && <SkillsPanel />}
            {panels.paragon && <ParagonPanel />}
            {panels.waypoint && <WaypointPanel />}
            {panels.obelisk && <ObeliskPanel />}
            {panels.settings && <SettingsPanel />}
            {panels.adventure && <AdventurePanel />}
            {panels.worldmap && <WorldMapPanel />}
            {panels.runSummary && <RunSummaryPanel />}
          </div>
          {panels.debug && <div class="pn-dock top"><DebugPanel /></div>}
        </>
      )}
      <DragLayer />
      <TipLayer />
    </div>
  );
}
