import '../styles/panels.css';
import { TipLayer, installAltTracking } from './tooltip';
import { useEffect } from 'preact/hooks';

export { ItemTooltip, showItemTooltip, hideItemTooltip, moveItemTooltip } from './tooltip';

export function PanelsRoot() {
  useEffect(() => installAltTracking(), []);
  return <div class="pn-root"><TipLayer /></div>;
}
