import { DIFFICULTIES } from '@shared/progression';
import { fmtDuration } from '@shared/format';
import { questText as t } from '@shared/data/questMessages';
import { togglePanel, useUI } from '../store';
import { PanelFrame, SecHead } from './common';
import { openJournal } from './adventure';

export function RunSummaryPanel() {
  const run=useUI(s=>s.lastRun),zone=useUI(s=>s.zone);
  const here=!!run&&zone?.instance===run.instance;
  return <PanelFrame id="runSummary" title={t('run.summary.title')} sub={run?.name} width={490}>
    {!run?<p>{t('run.summary.empty')}</p>:<>
      <SecHead>{t('run.summary.complete')}</SecHead>
      <p>{t(run.kind==='rift'?'run.summary.guardian':'run.summary.chambers')}{run.stages===null?'':` · ${run.stages}/${run.stages}`}</p>
      <p><strong>{t('run.summary.difficulty')}</strong> {DIFFICULTIES[run.difficulty]?.name??'—'}</p>
      <p><strong>{t('run.summary.time')}</strong> {run.elapsedMs===null?'—':fmtDuration(run.elapsedMs)}</p>
      <p class="pn-note">{t(run.kind==='rift'?'run.summary.riftClock':'run.summary.dungeonClock')}</p>
      <SecHead>{t('run.summary.next')}</SecHead>
      <p>{t(here?'run.summary.collect':'run.summary.left')}</p>
      {run.kind==='dungeon'&&<p>{t('run.summary.journalNote')}</p>}
      <button class="btn" onClick={openJournal}>{t('quest.journal.title')}</button>
      {here&&<button class="btn" onClick={()=>togglePanel('worldmap',true)}>{t('run.summary.map')}</button>}
      <p class="pn-note">{t('run.summary.session')}</p>
    </>}
  </PanelFrame>;
}
