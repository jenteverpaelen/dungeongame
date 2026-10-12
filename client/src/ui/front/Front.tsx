// Front-end screens (docs/rework/ui/CHARACTER_SCREENS.md §2): title and log in → hero select (3 places by the fire) →
// class choice (the lineup around the fire, a full-screen focus per class) → appearance → play. The camp itself is
// drawn by render/front/frontScene.ts behind these DOM screens; both read `ui.front`.
import { useEffect, useState } from 'preact/hooks';
import { text, type MessageKey } from '../../i18n/messages';
import { ui, useUI, type FrontView } from '../store';
import { session } from '../../net/api';
import { CLASSES, CLASS_IDS } from '@shared/data/classes';
import { SKILLS } from '@shared/data/skills';
import { ZONES } from '@shared/data/zones';
import type { AuthCharacter } from '@shared/protocol';
import type { ClassId } from '@shared/types';
import { BEARD_STYLES, EYE_COLORS, FACE_ACCESSORIES, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, classAppearance, randomAppearance, type HeroAppearanceV2 } from '@shared/appearance';
import { ClassEmblem, Divider, SkillGlyph } from '../hud/Glyphs';
import { RESOURCE_STYLES, hex, safeGet, safeSet } from '../hud/util';
import { AccountDialog, SignedOut } from '../hud/Account';
import { CAMS, CREATOR, HERO_SCALE, SPOTS, toScreen } from '../../render/front/frontScene';

const NAME_RE = /^[A-Za-z0-9]{2,16}$/;
const MAX_HEROES = 3;
const MAIN_STAT = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' } as const;
const t = (key: string, args?: Record<string, string>) => (text as (k: MessageKey, a?: Record<string, string>) => string)(key as MessageKey, args);
const setFront = (patch: Partial<FrontView>) => ui.set((s) => ({ front: { ...s.front, ...patch } }));
const live = (c: AuthCharacter[]) => c.filter((h) => h.deleteAt === undefined);
const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => { const on = () => setSize({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return size;
}

function Logo({ small }: { small?: boolean }) {
  return (
    <header class={`fr-logo${small ? ' small' : ''}`}>
      <div class="cs-eyebrow">{t('front.title.eyebrow')}</div>
      <h1 class={`cs-logo${small ? ' small' : ''}`}>Hearthfall</h1>
      <Divider class="cs-logo-div" />
      {!small && <p class="cs-tagline">{t('front.title.tagline')}</p>}
    </header>
  );
}

// ─────────── title: log in, or (accounts off / optional) begin as a guest ───────────
function Title() {
  const { mode } = useUI((s) => s.account);
  const [name, setName] = useState(() => safeGet('hearthfall.name') ?? '');
  const go = () => setFront({ step: 'class', focus: null, hover: null });
  const cont = () => { if (!NAME_RE.test(name)) return; safeSet('hearthfall.name', name); session.start(name, (safeGet('hearthfall.class') as ClassId) ?? 'warrior'); };
  return (
    <div class="fr-title">
      <Logo />
      {mode !== 'off' ? (
        <div class="fr-login ac-card interactive">
          <SignedOut closable={false} />
          {mode === 'optional' && <button type="button" class="ac-link" onClick={go}>{t('front.title.guest')}</button>}
        </div>
      ) : (
        <div class="fr-begin interactive">
          <button type="button" class="btn primary fr-big fr-go-begin" onClick={go}>{t('front.title.begin')}</button>
          <label class="fr-continue">
            <span>{t('front.title.continue')}</span>
            <input value={name} maxLength={16} spellcheck={false} autocomplete="off" placeholder={t('front.title.continueHint')}
              onInput={(e) => setName((e.currentTarget as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, ''))}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') cont(); }} />
            <button type="button" class="btn fr-go-continue" disabled={!NAME_RE.test(name)} onClick={cont}>{t('front.title.continueGo')}</button>
          </label>
        </div>
      )}
    </div>
  );
}

// ─────────── hero select: three places by the fire ───────────
function HeroSlot({ c, selected }: { c: AuthCharacter; selected: boolean }) {
  const def = CLASSES[c.classId], pending = c.deleteAt !== undefined;
  return (
    <button type="button" class={`fr-slot interactive${selected ? ' on' : ''}${pending ? ' gone' : ''}`} style={{ '--theme': hex(def.themeColor) }} disabled={pending}
      onClick={() => setFront({ hero: c.name })} onDblClick={() => !pending && session.start(c.name, c.classId)}>
      <span class="fr-slot-ico"><ClassEmblem classId={c.classId} /></span>
      <span class="fr-slot-t">
        <b>{c.name}</b>
        <small>{t('front.heroes.level', { level: String(c.level), cls: def.name })}</small>
        <em>{pending ? t('front.heroes.pending', { date: dateText(c.deleteAt!) }) : ZONES[c.zone ?? '']?.name ?? ''}</em>
      </span>
    </button>
  );
}

function Heroes() {
  const { username, characters } = useUI((s) => s.account);
  const front = useUI((s) => s.front), error = useUI((s) => s.error), size = useWindowSize();
  const heroes = characters.slice(0, MAX_HEROES), chosen = live(heroes).find((h) => h.name === front.hero) ?? live(heroes)[0];
  const free = MAX_HEROES - heroes.length;
  // Heroes from before accounts can be brought onto the account while the server's legacy window is open (ACCOUNTS.md).
  const [claim, setClaim] = useState<string | null>(null);
  const bring = () => { if (claim && NAME_RE.test(claim)) { ui.set({ error: null }); session.start(claim, 'warrior'); } };
  const play = () => { if (!chosen) return; ui.set({ error: null }); session.start(chosen.name, chosen.classId); };
  useEffect(() => { if (chosen && front.hero !== chosen.name) setFront({ hero: chosen.name }); }, [chosen?.name]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && chosen && !(e.target as HTMLElement)?.closest?.('input')) play(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [chosen?.name]);
  return (
    <div class="fr-heroes-screen">
      <div class="fr-corner interactive">
        <button type="button" class="ac-chip in" onClick={() => ui.set((s) => ({ account: { ...s.account, open: true, error: null } }))}><i aria-hidden="true" /><b>{username}</b><span>Account</span></button>
        <button type="button" class="btn ghost" onClick={() => void session.auth('logout')}>{t('front.heroes.logout')}</button>
      </div>
      <Logo small />
      <aside class="fr-roster interactive" aria-label={t('front.heroes.title')}>
        <h2>{t('front.heroes.title')}</h2>
        <p class="fr-sub">{t('front.heroes.count', { n: String(heroes.length), max: String(MAX_HEROES) })}</p>
        {heroes.map((c) => <HeroSlot key={c.name} c={c} selected={chosen?.name === c.name} />)}
        {Array.from({ length: free }, (_, i) => (
          <button key={`empty${i}`} type="button" class="fr-slot fr-empty interactive" onClick={() => setFront({ step: 'class', focus: null, hover: null })}>
            <span class="fr-slot-ico">+</span><span class="fr-slot-t"><b>{t('front.heroes.empty')}</b><small>{t('front.heroes.emptyNote')}</small></span>
          </button>
        ))}
        {free === 0 && <p class="fr-note">{t('front.heroes.full')}</p>}
        {free > 0 && (claim === null
          ? <button type="button" class="ac-link" onClick={() => setClaim('')}>{t('front.heroes.claim')}</button>
          : <label class="fr-continue fr-claim"><input value={claim} maxLength={16} spellcheck={false} autocomplete="off" placeholder={t('front.heroes.claimHint')}
              onInput={(e) => setClaim((e.currentTarget as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, ''))} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') bring(); }} />
              <button type="button" class="btn" disabled={!NAME_RE.test(claim)} onClick={bring}>{t('front.heroes.claimGo')}</button></label>)}
        <button type="button" class="ac-link" onClick={() => ui.set((s) => ({ account: { ...s.account, open: true, error: null } }))}>{t('front.heroes.manage')}</button>
      </aside>
      {/* the heroes in the scene: click one to choose it (MapleStory and D3 let you pick the hero itself), name below */}
      {live(heroes).map((c) => {
        const i = heroes.indexOf(c), p = toScreen(SPOTS[i].x, SPOTS[i].y, CAMS.heroes, size.w, size.h), hgt = 64 * HERO_SCALE * p.k * 1.1, wid = hgt * 0.6;
        return (
          <button key={c.name} type="button" class={`fr-hot fr-hero interactive${chosen?.name === c.name ? ' on' : ''}`} style={{ left: `${p.x - wid / 2}px`, top: `${p.y - hgt}px`, width: `${wid}px`, height: `${hgt}px`, '--theme': hex(CLASSES[c.classId].themeColor) }}
            aria-label={c.name} onClick={() => setFront({ hero: c.name })} onDblClick={() => session.start(c.name, c.classId)}>
            <span class="fr-plate"><b>{c.name}</b><small>{t('front.heroes.level', { level: String(c.level), cls: CLASSES[c.classId].name })}</small></span>
          </button>
        );
      })}
      {!chosen && (
        <footer class="fr-play interactive">
          <button type="button" class="btn primary fr-big" onClick={() => setFront({ step: 'class', focus: null, hover: null })}>{t('front.heroes.empty')}</button>
          <div class="fr-play-who">{t('front.heroes.emptyNote')}</div>
        </footer>
      )}
      {chosen && (
        <footer class="fr-play interactive">
          <button type="button" class="btn primary fr-big" onClick={play}>{t('front.heroes.play')}</button>
          <div class="fr-play-who"><b>{chosen.name}</b> · {t('front.heroes.level', { level: String(chosen.level), cls: CLASSES[chosen.classId].name })}</div>
          {error && <div class="cs-hint bad">{error}</div>}
        </footer>
      )}
    </div>
  );
}

// ─────────── class choice: the lineup around the fire, then a full-screen focus ───────────
function ClassFocus({ cls }: { cls: ClassId }) {
  const def = CLASSES[cls], sig = SKILLS[def.signatureSkill], theme = hex(def.themeColor), res = RESOURCE_STYLES[cls];
  const step = (d: number) => setFront({ focus: CLASS_IDS[(CLASS_IDS.indexOf(cls) + d + CLASS_IDS.length) % CLASS_IDS.length] });
  const choose = () => ui.set((s) => ({ front: { ...s.front, step: 'look', cls, appearance: classAppearance(cls), yaw: 0, gear: true } }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') setFront({ focus: null }); else if (e.key === 'Enter') choose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [cls]);
  return (
    <aside class="fr-classcard interactive" style={{ '--theme': theme, '--res': res.mid }}>
      <div class="fr-cc-head"><ClassEmblem classId={cls} /><div><h2>{def.name}</h2><div class="fr-cc-title" style={{ color: theme }}>{def.title}</div></div></div>
      <Divider class="cs-div" />
      <p class="fr-cc-blurb">{t(`intro.class.${cls}`)}</p>
      <div class="cs-chips">{def.playstyle.split(' · ').map((c) => <span key={c}>{c}</span>)}</div>
      <div class="fr-cc-facts">
        <div>{sig ? <SkillGlyph glyph={sig.icon.glyph} color={hex(sig.icon.color)} class="cs-sig-glyph" /> : null}<span><small>{t('front.class.signature')}</small><b>{def.signature}</b><em>{t('front.class.unlock', { level: String(sig?.unlock ?? 1) })}</em></span></div>
        <div><i class="fr-orb" style={{ background: `radial-gradient(circle at 35% 30%, ${res.hi}, ${res.mid} 60%, ${res.lo})` }} /><span><small>{t('front.class.resource')}</small><b>{def.resource.name}</b><em>{t('front.class.stat')}: {MAIN_STAT[def.mainStat]}</em></span></div>
      </div>
      <div class="fr-cc-go">
        <button type="button" class="btn" aria-label={t('front.class.prev')} onClick={() => step(-1)}>‹</button>
        <button type="button" class="btn primary fr-big fr-go-choose" onClick={choose}>{t('front.class.choose', { cls: def.name })}</button>
        <button type="button" class="btn" aria-label={t('front.class.next')} onClick={() => step(1)}>›</button>
      </div>
      <button type="button" class="ac-link" onClick={() => setFront({ focus: null })}>{t('front.class.back')}</button>
    </aside>
  );
}

function ClassPick() {
  const front = useUI((s) => s.front), { username, mode } = useUI((s) => s.account), size = useWindowSize();
  const back = () => setFront(username || mode !== 'off' ? { step: username ? 'heroes' : 'title', focus: null } : { step: 'title', focus: null });
  return (
    <div class="fr-class-screen">
      {!front.focus && <div class="fr-heading"><h2>{t('front.class.title')}</h2><p>{t('front.class.hint')}</p></div>}
      {!front.focus && CLASS_IDS.map((cls, i) => {
        const p = toScreen(SPOTS[i].x, SPOTS[i].y, CAMS.class, size.w, size.h), hgt = 64 * HERO_SCALE * p.k * 1.15, wid = hgt * 0.62, def = CLASSES[cls];
        const hover = front.hover === cls;
        return (
          <button key={cls} type="button" class={`fr-hot interactive${hover ? ' on' : ''}`} style={{ left: `${p.x - wid / 2}px`, top: `${p.y - hgt}px`, width: `${wid}px`, height: `${hgt}px`, '--theme': hex(def.themeColor) }}
            aria-label={def.name} data-class={cls} onPointerEnter={() => setFront({ hover: cls })} onPointerLeave={() => setFront({ hover: null })} onFocus={() => setFront({ hover: cls })} onClick={() => setFront({ focus: cls, hover: null })}>
            <span class="fr-hot-label"><b>{def.name}</b><small>{def.title}</small></span>
          </button>
        );
      })}
      {front.focus && <ClassFocus cls={front.focus} />}
      <button type="button" class="btn ghost fr-back interactive" onClick={back}>{t('front.class.back')}</button>
    </div>
  );
}

// ─────────── appearance ───────────
function Swatches({ label, colors, value, onPick }: { label: string; colors: readonly number[]; value: number; onPick: (i: number) => void }) {
  return (
    <div class="fr-row"><span class="fr-row-l">{label}</span>
      <div class="fr-swatches" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => <button key={i} type="button" role="radio" aria-checked={value === i} class={`fr-sw${value === i ? ' on' : ''}`} style={{ background: hex(c) }} onClick={() => onPick(i)} />)}
      </div>
    </div>
  );
}
function Choices<T extends string>({ label, prefix, list, value, onPick }: { label: string; prefix: string; list: readonly T[]; value: T; onPick: (v: T) => void }) {
  const i = list.indexOf(value), step = (d: number) => onPick(list[(i + d + list.length) % list.length]);
  return (
    <div class="fr-row"><span class="fr-row-l">{label}</span>
      <div class="fr-pick">
        <button type="button" class="fr-arrow" aria-label={`${label}: previous`} onClick={() => step(-1)}>‹</button>
        <span class="fr-pick-v">{t(`${prefix}.${value}`)}</span>
        <button type="button" class="fr-arrow" aria-label={`${label}: next`} onClick={() => step(1)}>›</button>
      </div>
    </div>
  );
}

function Creator() {
  const front = useUI((s) => s.front), error = useUI((s) => s.error), size = useWindowSize();
  const a = front.appearance, set = (patch: Partial<HeroAppearanceV2>) => setFront({ appearance: { ...a, ...patch } });
  const [name, setName] = useState(''), [touched, setTouched] = useState(false), [guide, setGuide] = useState(true);
  const valid = NAME_RE.test(name);
  const create = () => {
    setTouched(true); if (!valid) return;
    safeSet('hearthfall.name', name); safeSet('hearthfall.class', front.cls); ui.set({ error: null });
    session.start(name, front.cls, { appearance: a, tutorial: guide });
  };
  const turn = (d: number) => setFront({ yaw: ((front.yaw + d) % 360 + 360) % 360 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.('input')) return; if (e.key === 'ArrowLeft') turn(30); else if (e.key === 'ArrowRight') turn(-30); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [front.yaw]);
  const foot = toScreen(CREATOR.x, CREATOR.y, CAMS.look, size.w, size.h), hgt = 64 * HERO_SCALE * foot.k * 1.1;
  return (
    <div class="fr-look-screen">
      <div class="fr-turn interactive" style={{ left: `${foot.x - hgt * 0.4}px`, top: `${foot.y - hgt}px`, width: `${hgt * 0.8}px`, height: `${hgt + 20}px` }} title={t('front.look.turn')} />
      <aside class="fr-creator interactive">
        <div class="fr-cr-head"><ClassEmblem classId={front.cls} /><div><h2>{t('front.look.title')}</h2><small>{CLASSES[front.cls].name} · {CLASSES[front.cls].title}</small></div></div>
        <div class="fr-cr-tools">
          <button type="button" class="btn" onClick={() => setFront({ appearance: randomAppearance() })}>🎲 {t('front.look.random')}</button>
          <button type="button" class="btn ghost" onClick={() => setFront({ appearance: classAppearance(front.cls) })}>{t('front.look.classLook')}</button>
        </div>
        <Swatches label={t('front.look.skin')} colors={SKIN_TONES} value={a.skin} onPick={(skin) => set({ skin })} />
        <Choices label={t('front.look.hairStyle')} prefix="front.style" list={HAIR_STYLES} value={a.hairStyle} onPick={(hairStyle) => set({ hairStyle })} />
        <Swatches label={t('front.look.hair')} colors={HAIR_COLORS} value={a.hair} onPick={(hair) => set({ hair })} />
        <Swatches label={t('front.look.eyes')} colors={EYE_COLORS} value={a.eyes} onPick={(eyes) => set({ eyes })} />
        <Choices label={t('front.look.beard')} prefix="front.beard" list={BEARD_STYLES} value={a.beard} onPick={(beard) => set({ beard })} />
        <Choices label={t('front.look.face')} prefix="front.face" list={FACE_ACCESSORIES} value={a.face} onPick={(face) => set({ face })} />
        <p class="fr-note">{t('front.look.fixed')}</p>
      </aside>
      <div class="fr-turnbar interactive" style={{ left: `${foot.x}px`, top: `${foot.y + 18}px` }}>
        <button type="button" class="fr-arrow" aria-label={t('front.look.left')} onClick={() => turn(30)}>⟲</button>
        <span>{t('front.look.turn')}</span>
        <button type="button" class="fr-arrow" aria-label={t('front.look.right')} onClick={() => turn(-30)}>⟳</button>
        <label class="settings-check"><input type="checkbox" checked={front.gear} onChange={(e) => setFront({ gear: e.currentTarget.checked })} />{t('front.look.gear')}</label>
      </div>
      <footer class="fr-namebox interactive">
        <label class="cs-name">
          <span>{t('front.look.name')}</span>
          <input value={name} maxLength={16} spellcheck={false} autocomplete="off" placeholder="Hero name"
            onInput={(e) => { setName((e.currentTarget as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, '')); setTouched(true); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') create(); }} />
        </label>
        <label class="settings-check"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.currentTarget.checked)} />{t('front.look.guide')}</label>
        <button type="button" class="btn primary fr-big fr-go-create" disabled={!valid} onClick={create}>{t('front.look.create')}</button>
        <div class={`cs-hint${error || (touched && !valid) ? ' bad' : ''}`}>{error ? error : touched && !valid ? t('front.look.nameBad') : t('front.look.nameHint')}</div>
        <button type="button" class="ac-link" onClick={() => setFront({ step: 'class', focus: front.cls })}>{t('front.look.back')}</button>
      </footer>
    </div>
  );
}

/** The select screen: picks the step from the account state and shows it over the camp scene. */
export function Front() {
  const front = useUI((s) => s.front), account = useUI((s) => s.account);
  // Logging in leads to the heroes; logging out (or a session that expired) back to the title.
  useEffect(() => {
    if (account.username && front.step === 'title') setFront({ step: 'heroes' });
    if (!account.username && account.mode !== 'off' && front.step === 'heroes') setFront({ step: 'title' });
  }, [account.username, account.mode]);
  return (
    <div class="fr-root">
      <div class="cs-vignette" />
      {front.step === 'title' && <Title />}
      {front.step === 'heroes' && <Heroes />}
      {front.step === 'class' && <ClassPick />}
      {front.step === 'look' && <Creator />}
      {(account.username || account.codes) && <AccountDialog />}
    </div>
  );
}
