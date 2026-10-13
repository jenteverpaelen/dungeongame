// Transient feeds: centre-screen notices, the pickup log and the chat window.

import { useEffect, useRef, useState } from 'preact/hooks';
import { ui, useUI, type ChatLine, type Notice, type PickupLine } from '../store';
import { sendChat } from '../../net/api';
import {CHAT_CHANNELS} from '@shared/social';
import {whisperTo} from '../panels/social';
import {reportMessage} from '../panels/community';
import { itemHover } from '../panels/tooltip';
import { BuildCard } from '../panels/buildcode';
import { fmtInt } from '@shared/format';
import { RARITY_COLORS } from '@shared/items';
import { CoinGlyph, GemMark } from './Glyphs';
import { CLASS_TEXT, gemColor, useNow } from './util';

// ───────────────────────── Notices ─────────────────────────

const NOTICE_MS = 2500;

function NoticeBanner({ n, age }: { n: Notice; age: number }) {
  const paragon = n.kind === 'level' && /paragon/i.test(n.text);
  const legendaryText = n.kind === 'legendary' && !/^legendary/i.test(n.text);
  return (
    <div class={`notice notice-${n.kind}${paragon ? ' paragon' : ''}${n.text.length > 56 ? ' notice-long' : ''}${n.kind === 'level' && n.text.length > 20 ? ' notice-level-long' : ''}`} style={{ '--age': age }}>
      {n.kind === 'level' && <i class="notice-burst" />}
      <div class="notice-body">
        <span class="notice-wing l" />
        <div class="notice-text">
          {legendaryText && <small>Legendary Item!</small>}
          <span>{n.text}</span>
        </div>
        <span class="notice-wing r" />
      </div>
    </div>
  );
}

export function Notices() {
  const notices = useUI((s) => s.notices);
  const now = useNow(250, notices.length > 0);
  const live = notices.filter((n) => now - n.at < NOTICE_MS).slice(-3);
  if (!live.length) return null;
  return (
    <div class="hud-notices">
      {live.map((n, i) => <NoticeBanner key={n.id} n={n} age={live.length - 1 - i} />)}
    </div>
  );
}

// ───────────────────────── Pickup log ─────────────────────────

const PICKUP_MS = 6000;

function PickupRow({ p }: { p: PickupLine }) {
  let color = '#e8e0cf';
  let text = p.name;
  let icon: preact.ComponentChildren = null;
  switch (p.lk) {
    case 'gold': color = '#f2cd5e'; text = `+${fmtInt(p.amount ?? 0)} Gold`; icon = <CoinGlyph />; break;
    case 'item': color = RARITY_COLORS[(p.rarity as keyof typeof RARITY_COLORS) ?? 'normal'] ?? '#ffffff'; break;
    case 'gem': color = gemColor(p.name); icon = <GemMark color={color} />; break;
    case 'mat': color = '#b9d4e8'; text = `${p.amount && p.amount > 1 ? `+${fmtInt(p.amount)} ` : ''}${p.name}`; break;
    case 'globe': color = '#ff6a58'; text = p.name || 'Mending Orb'; break;
  }
  const rare = p.lk === 'item' && (p.rarity === 'legendary' || p.rarity === 'set');
  return (
    <div class={`pickup${rare ? ' pickup-rare' : ''}`} style={{ color, '--pk': color }}>
      <span class="pickup-icon">{icon}</span>
      <span class="pickup-text">{text}</span>
    </div>
  );
}

export function PickupLog() {
  const pickups = useUI((s) => s.pickups);
  const now = useNow(500, pickups.length > 0);
  const live = pickups.filter((p) => now - p.at < PICKUP_MS).slice(-6);
  if (!live.length) return null;
  return <div class="hud-pickups">{live.map((p) => <PickupRow key={p.id} p={p} />)}</div>;
}

// ───────────────────────── Chat ─────────────────────────

const IDLE_FADE_MS = 9000;

/** What players call each channel ('world' reaches everyone online: Global). */
export const CHANNEL_LABEL: Record<string, string> = { world: 'Global', zone: 'Zone', party: 'Party', guild: 'Guild', trade: 'Trade', lfg: 'LFG', whisper: 'Whisper', system: 'System' };
/** One colour per channel (tag, prompt and picker) [P], after WoW's default chat colours. */
export const CHANNEL_COLOR: Record<string, string> = { world: '#f0c879', zone: '#e9dfcb', party: '#9fb4ff', guild: '#6fdc8c', trade: '#ffb27a', lfg: '#8fd8ff', whisper: '#ff8fe0', system: '#e6c36a' };
const SEND_ORDER = ['world', 'zone', 'party', 'guild', 'trade', 'lfg', 'whisper'] as const;

function ChatRow({ l, idle }: { l: ChatLine; idle: boolean }) {
  const open=useUI(s=>s.chatOpen),me=useUI(s=>s.char?.name);
  if (l.ch === 'system') return <div class={`chat-line sys${idle ? ' idle' : ''}`}>{l.role === 'dev' && <span class="chat-staff">✦ DEV</span>}{l.text}</div>;
  return (
    <div class={`chat-line${idle ? ' idle' : ''}`}>
      <span class="chat-tag" style={{ color: CHANNEL_COLOR[l.ch] }}>[{l.ch==='whisper'?`Whisper → ${l.to}`:CHANNEL_LABEL[l.ch] ?? l.ch}]</span>
      {l.role === 'dev' && <span class="chat-staff" title="Hearthfall developer">✦ DEV</span>}
      <button class={`chat-name interactive${l.role === 'dev' ? ' staff' : ''}`} style={{ color: l.role === 'dev' ? undefined : l.cls ? CLASS_TEXT[l.cls] : '#d9ccb2' }} onClick={()=>{if(l.from)whisperTo(l.from===ui.get().char?.name?(l.to??l.from):l.from);}} title="Whisper to this character">{l.from ?? '?'}</button>
      <span class="chat-sep">:</span> {l.build ? <BuildCard l={l} /> : l.item ? <button class="chat-name interactive" style={{color:RARITY_COLORS[l.item.rarity]}} {...itemHover(()=>l.item??null,{compare:true})}>{l.text}</button> : <span class="chat-text">{l.text}</span>}
      {open&&l.messageId&&l.from&&l.from!==me&&<button class="chat-name interactive" onClick={()=>{ui.set({chatOpen:false});reportMessage(l.from!,l.messageId!);}} title="Report this received message"> · Report</button>}
    </div>
  );
}

function ChatInput() {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const ch=useUI(s=>s.chatChannel),target=useUI(s=>s.chatTarget);
  useEffect(() => { ref.current?.focus(); }, []);

  const close = () => ui.set({ chatOpen: false });
  const onKeyDown = (e: KeyboardEvent) => {
    // main.ts owns the global keys; keep typing (and Enter / Esc) from leaking into movement and hotkeys.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = text.trim();
      if (t) sendChat(t.slice(0, 200),ch,target); // slash commands (/w, /p, /g, /global …) are the server's (session.slash)
      setText('');
      close();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setText('');
      close();
    }
  };
  return (
    <div class="interactive" onKeyDown={e=>e.stopPropagation()}>
    {ch==='whisper'&&<label class="chat-recipient">To <input aria-label="Whisper recipient" maxLength={16} value={target} onInput={e=>ui.set({chatTarget:e.currentTarget.value})}/></label>}
    <div class="chat-input">
      <select class="chat-prompt" aria-label="Send to channel" value={ch} style={{ color: CHANNEL_COLOR[ch] }}
        onChange={(e) => { ui.set({ chatChannel: (e.currentTarget as HTMLSelectElement).value as (typeof CHAT_CHANNELS)[number] }); ref.current?.focus(); }}>
        {SEND_ORDER.filter((c) => (CHAT_CHANNELS as readonly string[]).includes(c)).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
      </select>
      <input
        ref={ref}
        value={text}
        maxLength={200}
        spellcheck={false}
        autocomplete="off"
        placeholder={ch === 'world' ? 'Everyone online sees this · Enter sends, Esc cancels' : 'Enter sends, Esc cancels'}
        onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        onKeyDown={onKeyDown}
      />
    </div>
    </div>
  );
}

// Channel view tabs (MMO convention): filter what the log shows; a channel tab also becomes the send channel.
const CHAT_VIEWS = ['all', ...CHAT_CHANNELS, 'system'] as const;
type ChatView = (typeof CHAT_VIEWS)[number];
const VIEW_LABEL = (v: ChatView) => v === 'all' ? 'All' : CHANNEL_LABEL[v] ?? v;
let rememberedView: ChatView = 'all';

export function Chat() {
  const all = useUI((s) => s.chat);
  const open = useUI((s) => s.chatOpen);
  const [view, setView] = useState<ChatView>(rememberedView);
  const shown = view === 'all' ? all : all.filter((l) => l.ch === view);
  const lines = shown.slice(open ? -14 : -8);
  const now = useNow(1000, lines.length > 0 && !open);
  const newest = lines.length ? lines[lines.length - 1].at : 0;
  const idle = !open && now - newest > IDLE_FADE_MS;

  const pick = (v: ChatView) => { rememberedView = v; setView(v); if ((CHAT_CHANNELS as readonly string[]).includes(v)) ui.set({ chatChannel: v as (typeof CHAT_CHANNELS)[number] }); };
  return (
    <div class={`hud-chat${open ? ' is-open' : ''}${idle ? ' is-idle' : ''}`}>
      {open && <div class="chat-tabs interactive" role="tablist" aria-label="Chat channels">
        {CHAT_VIEWS.map((v) => <button key={v} role="tab" aria-selected={view === v} class={`chat-tab${view === v ? ' on' : ''}`} onClick={() => pick(v)}>{VIEW_LABEL(v)}</button>)}
      </div>}
      {(lines.length > 0 || open) && <div class="chat-lines">
        {lines.map((l) => <ChatRow key={l.id} l={l} idle={!open && now - l.at > IDLE_FADE_MS} />)}
        {open && !lines.length && <div class="chat-line sys">No messages in {VIEW_LABEL(view)} yet.</div>}
      </div>}
      {open && <ChatInput />}
      {!open && <div class="chat-hint"><kbd>Enter</kbd> to chat · <b style={{ color: CHANNEL_COLOR.world }}>Global</b></div>}
    </div>
  );
}
