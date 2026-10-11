// HUD root. Mounted once into #ui by main.ts; switches between the class select, the connecting screen and the in-game HUD.

import '../styles/hud.css';
import '../styles/account.css';
import '../styles/quests.css';
import { useUI } from '../store';
import { preferences } from '../../game/preferences';
import { useLocal } from '../panels/state';
import { ClassSelect, Connecting } from './ClassSelect';
import { BottomBar } from './SkillBar';
import { TopRight } from './Minimap';
import { TargetFrame } from './Target';
import { Chat, Notices, PickupLog } from './Feed';
import { PlayerPlate } from './PlayerPlate';
import { AfkModal, DeathScreen, HelpPanel, InteractPrompt } from './Overlays';
import { BenchReadout } from '../panels/bench';
import { ContextualGuidance } from './Guidance';
import {PartyFrames} from '../panels/party';
import { MenuBar } from './MenuBar';
import { HoldBar, ReadingCard } from './QuestMoments';

function GameHud() {
  const ready = useUI((s) => !!(s.char && s.me));
  return (
    <>
      {ready && <PlayerPlate />}
      {ready && <PartyFrames />}
      <TargetFrame />
      <TopRight />
      <Notices />
      <div class="hud-leftcol">
        <PickupLog />
        <Chat />
      </div>
      {ready && <BottomBar />}
      {ready && <MenuBar />}
      <InteractPrompt />
      <BenchReadout />
      <ReadingCard />
      <HoldBar />
      <ContextualGuidance />
      <DeathScreen />
      <HelpPanel />
      <AfkModal />
    </>
  );
}

export function HudRoot() {
  const screen = useUI((s) => s.screen);
  const k = useLocal(preferences, (s) => s.values.uiScale);
  return (
    <div class={`hud-root screen-${screen}`} style={k === 1 ? undefined : { '--ui-k': k }}>
      {screen === 'select' && <ClassSelect />}
      {screen === 'connecting' && <Connecting />}
      {screen === 'game' && <GameHud />}
    </div>
  );
}
