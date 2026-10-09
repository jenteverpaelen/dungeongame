// HUD root. Mounted once into #ui by main.ts; switches between the class select, the connecting screen and the in-game HUD.

import '../styles/hud.css';
import { useUI } from '../store';
import { ClassSelect, Connecting } from './ClassSelect';
import { BottomBar } from './SkillBar';
import { TopRight } from './Minimap';
import { TargetFrame } from './Target';
import { Chat, Notices, PickupLog } from './Feed';
import { PlayerPlate } from './PlayerPlate';
import { AfkModal, DeathScreen, HelpPanel, InteractPrompt } from './Overlays';
import { ContextualGuidance } from './Guidance';

function GameHud() {
  const ready = useUI((s) => !!(s.char && s.me));
  return (
    <>
      {ready && <PlayerPlate />}
      <TargetFrame />
      <TopRight />
      <Notices />
      <div class="hud-leftcol">
        <PickupLog />
        <Chat />
      </div>
      {ready && <BottomBar />}
      <InteractPrompt />
      <ContextualGuidance />
      <DeathScreen />
      <HelpPanel />
      <AfkModal />
    </>
  );
}

export function HudRoot() {
  const screen = useUI((s) => s.screen);
  return (
    <div class={`hud-root screen-${screen}`}>
      {screen === 'select' && <ClassSelect />}
      {screen === 'connecting' && <Connecting />}
      {screen === 'game' && <GameHud />}
    </div>
  );
}
