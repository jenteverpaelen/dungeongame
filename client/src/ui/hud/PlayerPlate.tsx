// Top-left: class portrait, name, level / paragon, DPS meter and the small fps / ping read-out.

import { useUI } from '../store';
import { fmtCompact } from '@shared/format';
import { MAX_LEVEL } from '@shared/constants';
import { CLASSES } from '@shared/data/classes';
import { ClassEmblem } from './Glyphs';
import { CLASS_NAME, hex } from './util';

export function PlayerPlate() {
  const v = useUI((s) => (s.char && s.me ? { name: s.char.name, cls: s.char.classId, lv: s.me.lv, pl: s.me.pl } : null));
  const showNumbers=useUI(s=>!s.char?.onboarding||s.char.onboarding.status!=='active'||s.char.onboarding.done.includes('kill'));
  const dps = useUI((s) => s.dps);
  const fps = useUI((s) => s.fps);
  const ping = useUI((s) => s.ping);
  if (!v) return null;
  const paragon = v.lv >= MAX_LEVEL;
  const theme = hex(CLASSES[v.cls].themeColor);
  const pingTone = ping < 90 ? 'good' : ping < 170 ? 'warn' : 'bad';
  return (
    <div class="hud-player">
      <div class={`portrait${paragon ? ' paragon' : ''}`} style={{ '--cls': theme }}>
        <div class="portrait-well"><ClassEmblem classId={v.cls} /></div>
        <div class="portrait-ring" />
        <div class="portrait-lv"><span>{paragon ? v.pl : v.lv}</span></div>
      </div>
      <div class="player-info">
        <div class="pi-name">{v.name}</div>
        <div class="pi-sub">
          {paragon ? <span class="pi-paragon">Paragon {v.pl}</span> : <span>Level {v.lv}</span>}
          <i />
          <span style={{ color: theme === '#c0392b' ? '#e0705a' : undefined }}>{CLASS_NAME[v.cls]}</span>
        </div>
        {showNumbers&&<div class="pi-dps" title="Damage per second (5 s window)">
          <span class="dps-label">DPS</span>
          <span class="dps-val">{fmtCompact(dps)}</span>
        </div>}
        {showNumbers&&<div class="pi-net">
          <span>{Math.round(fps)} fps</span>
          <i />
          <span class={`ping ${pingTone}`}>{Math.round(ping)} ms</span>
        </div>}
      </div>
    </div>
  );
}
