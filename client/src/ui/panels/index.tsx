// PANELS root: item tooltip, inventory + paperdoll, skills, paragon, cube, waypoint, obelisk and the debug panel.
// Mounted by ui/App.tsx next to the HUD. Open/close goes through the store (togglePanel / closeAllPanels).

import '../styles/panels.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { togglePanel, useUI, type PanelId } from '../store';
import { CubePanel } from './cube';
import { DebugPanel, ObeliskPanel, WaypointPanel } from './dialogs';
import { DragLayer } from './dnd';
import { InventoryPanel } from './inventory';
import { ParagonPanel } from './paragon';
import { SkillsPanel } from './skills';
import { TipLayer, hideTip, installAltTracking } from './tooltip';

export { ItemTooltip, showItemTooltip, hideItemTooltip, moveItemTooltip, itemHover } from './tooltip';
export type { ItemTooltipProps } from './tooltip';

/** Panels docked on the left; opening one closes the others (Diablo 3 behaviour). */
const LEFT_DOCK: PanelId[] = ['cube', 'skills', 'paragon', 'waypoint', 'obelisk'];

/** Panel scale from the viewport height: 1.0 at ~1000px, shrinking towards 720p, growing a little on tall screens. */
function useScale(): number {
  const calc = () => Math.max(0.74, Math.min(1.15, window.innerHeight / 1000));
  const [s, set] = useState(calc);
  useEffect(() => {
    const on = () => set(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

export function PanelsRoot() {
  const panels = useUI((s) => s.panels);
  const ready = useUI((s) => s.screen === 'game' && !!s.char);
  const scale = useScale();
  const prev = useRef<Partial<Record<PanelId, boolean>>>({});

  useEffect(() => installAltTracking(), []);

  useEffect(() => {
    const newly = LEFT_DOCK.filter((id) => panels[id] && !prev.current[id]);
    if (newly.length) {
      const keep = newly[newly.length - 1];
      for (const id of LEFT_DOCK) if (id !== keep && panels[id]) togglePanel(id, false);
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
            {panels.skills && <SkillsPanel />}
            {panels.paragon && <ParagonPanel />}
            {panels.waypoint && <WaypointPanel />}
            {panels.obelisk && <ObeliskPanel />}
          </div>
          {panels.debug && <div class="pn-dock top"><DebugPanel /></div>}
        </>
      )}
      <DragLayer />
      <TipLayer />
    </div>
  );
}
