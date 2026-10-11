// Bounty board window (docs/rework/quests/DESIGN.md §5; REFERENCES R15, R18, R22): the zone's three bounties with progress
// and reward, and the board cache once all three are done. Nothing to accept: bounties count as soon as you do them.
import { useState } from 'preact/hooks';
import { questText as t } from '@shared/data/questMessages';
import { ZONES } from '@shared/data/zones';
import { BOUNTY_BOARDS, CACHE_GOLD_UNITS, boardComplete, boardState, boardUnlocked, bountyDef, bountyGold, bountyKey, bountyNeed, bountyObjective, bountyXp } from '@shared/bounties';
import { QUESTS } from '@shared/data/quests';
import { pushNotice, useUI } from '../store';
import { PanelFrame } from './common';
import { UiIcon } from '../hud/UiIcons';
import { run } from './util';
import { QUEST_COLORS } from '../../render/art/questBadges';

export function BountyPanel() {
  const save = useUI((s) => s.char), zone = useUI((s) => s.zone), interact = useUI((s) => s.interact);
  const [busy, setBusy] = useState(false);
  if (!save || !zone) return null;
  const z = zone.zone, board = BOUNTY_BOARDS[z];
  const present = interact?.name?.toLowerCase().includes('bounty board') ?? false;
  if (!board) return <PanelFrame id="bounty" title={t('bounty.board.title')} sub={zone.name} width={720}><p class="pn-note">{t('bounty.board.locked')}</p></PanelFrame>;
  const open = boardUnlocked(save, z), s = boardState(save, z), unlock = QUESTS.find((q) => q.id === board.unlock);
  const claim = async () => { setBusy(true); try { const r = await run('quest', { action: 'bountyClaim', target: 'bounty_board' }); const text = (r.data as { text?: string } | undefined)?.text; if (r.ok && text) pushNotice(text, 'info'); } finally { setBusy(false); } };
  return <PanelFrame id="bounty" title={t('bounty.board.title')} sub={<>{ZONES[z]?.name} · {t('bounty.board.sub')}</>} width={760}>
    {!open ? <p class="pn-note">{t('bounty.board.locked')} {unlock ? `(${t(unlock.title)})` : ''}</p> : <>
      <div class="bty-grid">
        {s.picks.map((id, i) => {
          const d = bountyDef(z, id)!, need = bountyNeed(d), have = s.progress[i], paid = !!(s.done & (1 << i));
          return <section key={id} class={`card bty-card ${paid ? 'paid' : ''}`}>
            <header class="card-h"><span class="bty-kind" style={{ color: QUEST_COLORS.bounty.fill }}>{t(`bounty.kind.${d.kind}` as Parameters<typeof t>[0])}</span>{paid && <em class="chip good">{t('bounty.board.paid')}</em>}</header>
            <h3>{t(bountyKey(z, id))}</h3>
            <p>{bountyObjective(z, d)}</p>
            <span class="qt-bar" aria-label={`${have} of ${need}`}><i style={{ width: `${Math.min(100, have / need * 100)}%` }} /></span>
            <p class="bty-reward"><span class="jr-coin" /> {bountyGold(z).toLocaleString()} · <UiIcon name="star" size={13} /> {bountyXp(save.level).toLocaleString()} XP <small>{have}/{need}</small></p>
          </section>;
        })}
      </div>
      <section class={`card bty-cache ${boardComplete(s) ? 'ready' : ''}`}>
        <header class="card-h"><span>{t('bounty.board.cache')}</span><em>{s.picks.filter((_, i) => s.done & (1 << i)).length}/{s.picks.length}</em></header>
        <p>{t('bounty.board.cacheText')}</p>
        <p class="bty-reward"><span class="jr-coin" /> {bountyGold(z, CACHE_GOLD_UNITS).toLocaleString()} · <UiIcon name="star" size={13} /> {bountyXp(save.level).toLocaleString()} XP · 1 rare + 1 magic item</p>
        <button class="btn primary" disabled={busy || !present || !boardComplete(s)} onClick={() => void claim()}>{t('bounty.board.claim')}</button>
      </section>
    </>}
  </PanelFrame>;
}
