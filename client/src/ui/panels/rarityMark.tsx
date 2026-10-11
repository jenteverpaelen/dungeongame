// Rarity shape on an item slot (Settings → Accessibility → rarity shapes; GAG "no essential information by colour
// alone"): ◆ magic, ▲ rare, ★ legendary, ⬢ set, drawn as original light glyphs with a dark edge so the shape reads on
// any rarity colour or gear-tier frame. Top centre of the slot: the corners already hold the upgrade arrow (top left),
// protection (top right), sockets (bottom left) and the +N upgrade (bottom right). Hidden by CSS when switched off.
import type { Item } from '@shared/types';

export function RarityMark({ item }: { item: Pick<Item, 'rarity'> }) {
  if (item.rarity === 'normal') return null;
  return <i class={`rmark rm-${item.rarity}`} aria-hidden="true" />;
}
