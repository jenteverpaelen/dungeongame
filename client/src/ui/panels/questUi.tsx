// Small pieces shared by the dialogue window, the journal and the tracker (docs/rework/quests/DESIGN.md §2, §9).
import { questText as t } from '@shared/data/questMessages';
import { ZONES } from '@shared/data/zones';
import { questHasItem, questHasPick, questState, questUnlocks } from '@shared/quests';
import type { QuestDef } from '@shared/questTypes';
import type { CharacterSave } from '@shared/types';
import { UiIcon } from '../hud/UiIcons';
import { itemHover } from './tooltip';
import { affixText } from './util';
import { RARITY_COLORS } from '@shared/items';
import type { Item } from '@shared/types';
import { QUEST_COLORS, type MarkCat } from '../../render/art/questBadges';

export function QuestGlyph({ cat, glyph }: { cat: MarkCat; glyph: string }) {
  const c = QUEST_COLORS[cat];
  return <i class={'qt-glyph ' + cat} style={{ background: 'radial-gradient(circle at 40% 30%, #fff6dc, ' + c.fill + ' 45%, ' + c.deep + ')', color: c.text }}>{glyph}</i>;
}
export const categoryLabel = (cat: MarkCat) => t(cat === 'story' ? 'ui.quest.story' : cat === 'side' ? 'ui.quest.side' : cat === 'lesson' ? 'ui.quest.lesson' : 'ui.quest.bounty');

/** XP, gold, route and the item reward; both choices of a pick are previewed before the turn-in (REFERENCES R24, R27). */
export function RewardPreview({ save, q, pick, onPick, compact }: { save: CharacterSave; q: QuestDef; pick?: 'main' | 'alt'; onPick?: (p: 'main' | 'alt') => void; compact?: boolean }) {
  const reward = typeof q.reward === 'object' ? q.reward : undefined, state = questState(save, q.id);
  const items = state?.claimed ? [] : [state?.reward, questHasPick(q) ? state?.rewardAlt : undefined].filter((i): i is NonNullable<typeof i> => !!i);
  return <div class={'dlg-reward' + (compact ? ' compact' : '')}>
    <span class="dlg-reward-line">
      {!!reward?.xp && <span><UiIcon name="star" size={13} /> {reward.xp.toLocaleString()} XP</span>}
      {!!reward?.gold && <span><i class="jr-coin" /> {reward.gold.toLocaleString()} gold</span>}
      {questUnlocks(q).map((z) => <span key={z}><UiIcon name="map" size={13} /> {ZONES[z]?.name}</span>)}
      {!items.length && questHasItem(q) && <span><UiIcon name="bag" size={13} /> {questHasPick(q) ? t('ui.quest.weapon') + ' / ' + t('ui.quest.armour') : t(q.rewardText)}</span>}
    </span>
    {items.length > 0 && <div class={'dlg-picks n' + items.length}>
      {items.map((item, i) => { const id = i === 0 ? 'main' : 'alt'; return <label key={item.id} class={'dlg-pick ' + ((pick ?? 'main') === id ? 'on' : '')}>
        {items.length > 1 && <span class="dlg-pick-h"><input type="radio" name={'pick-' + q.id} checked={(pick ?? 'main') === id} disabled={!onPick} onChange={() => onPick?.(id)} /> {t(i === 0 ? 'ui.quest.weapon' : 'ui.quest.armour')}</span>}
        <RewardItemCard item={item} />
      </label>; })}
    </div>}
  </div>;
}

/** Compact reward card (name, the number that matters, affixes); hover shows the full tooltip with comparison. Keeps the
 *  dialogue inside the screen (no scrolling windows) where two full tooltips side by side would not fit. */
function RewardItemCard({ item }: { item: Item }) {
  const main = item.weapon ? `${(((item.weapon.min + item.weapon.max) / 2) * item.weapon.aps).toFixed(1)} damage per second` : item.armor ? `${item.armor} armour` : '';
  return <span class="rw-card" {...itemHover(() => item, { compare: true })}>
    <b style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</b>
    <small>{item.kind.replace(/([0-9])h$/, ' ($1-handed)').replace(/^weapon/, 'weapon')} · item level {item.ilvl}</small>
    {main && <em>{main}</em>}
    {item.affixes.map((a, i) => <span key={i} class="rw-affix">{affixText(a, item)}</span>)}
  </span>;
}
