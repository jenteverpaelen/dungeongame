// Run summary: the latest completed rift or dungeon of this session as three stat tiles and a short "before you move on".

import { DIFFICULTIES } from '@shared/progression';
import { fmtDuration } from '@shared/format';
import { questText as t } from '@shared/data/questMessages';
import { togglePanel, useUI } from '../store';
import { PanelFrame } from './common';
import { openJournal } from './adventure';
import { UiIcon } from '../hud/UiIcons';

export function RunSummaryPanel() {
  const run = useUI(s => s.lastRun), zone = useUI(s => s.zone);
  const here = !!run && zone?.instance === run.instance;
  return <PanelFrame id="runSummary" title={t('run.summary.title')} sub={run?.name} width={560}>
    {!run ? <div class="so-empty"><UiIcon name="hourglass" size={40} /><b>No completed run yet</b><span>{t('run.summary.empty')}</span></div> : <div class="rs">
      <header class="rs-hero">
        <span class="rs-seal"><UiIcon name={run.kind === 'rift' ? 'obelisk' : 'gate'} size={36} /></span>
        <div><b>{t('run.summary.complete')}</b><span>{t(run.kind === 'rift' ? 'run.summary.guardian' : 'run.summary.chambers')}{run.stages === null ? '' : ` · ${run.stages}/${run.stages}`}</span></div>
      </header>
      <div class="rs-stats">
        <div class="rs-stat"><span>{t('run.summary.difficulty')}</span><b>{DIFFICULTIES[run.difficulty]?.name ?? '—'}</b></div>
        <div class="rs-stat"><span>{t('run.summary.time')}</span><b>{run.elapsedMs === null ? '—' : fmtDuration(run.elapsedMs)}</b></div>
        <div class="rs-stat"><span>Type</span><b>{run.kind === 'rift' ? 'Rift' : 'Dungeon'}</b></div>
      </div>
      <p class="co-sub">{t(run.kind === 'rift' ? 'run.summary.riftClock' : 'run.summary.dungeonClock')}</p>
      <section class="so-card">
        <h4>{t('run.summary.next')}</h4>
        <p>{t(here ? 'run.summary.collect' : 'run.summary.left')}</p>
        {run.kind === 'dungeon' && <p>{t('run.summary.journalNote')}</p>}
        <div class="rs-actions">
          <button class="btn" onClick={openJournal}><UiIcon name="journal" size={16} /> {t('quest.journal.title')}</button>
          {here && <button class="btn" onClick={() => togglePanel('worldmap', true)}><UiIcon name="map" size={16} /> {t('run.summary.map')}</button>}
        </div>
      </section>
      <p class="st-hint">{t('run.summary.session')}</p>
    </div>}
  </PanelFrame>;
}
