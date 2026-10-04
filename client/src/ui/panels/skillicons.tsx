// Skill glyphs (coloured, per SkillDef.icon.glyph) and Cube function icons (line, currentColor).

import { Svg, hex, lighten, darken } from './icons';
import type { CubeOp } from '@shared/cube';

// ─────────────────────────── Skill glyphs ───────────────────────────

export function SkillGlyph({ glyph, color, size = 40 }: { glyph: string; color: number; size?: number }) {
  const c = hex(color), hi = lighten(color, 0.5), lo = darken(color, 0.45);
  const sw = { stroke: lo, 'stroke-width': 1.2, 'stroke-linejoin': 'round' as const };
  let body;
  switch (glyph) {
    case 'arc':
      body = (
        <>
          <path d="M3 24 C5 11 17 3 29 8 C19 9 11 15 9 27 Z" fill={c} {...sw} />
          <path d="M8 27 C10 16 18 11 28 12 C20 14 15 19 14 28 Z" fill={hi} opacity=".75" />
          <path d="M5 21 C8 12 15 7 23 6" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7" />
        </>
      );
      break;
    case 'spiral':
      body = (
        <>
          <path d="M16 16 C16 14 19.4 14 19.4 17 C19.4 21 13.4 22 11.4 18 C9 13.4 13 7.6 18.4 7.6 C25 7.6 28 14.4 25.4 20.4 C23 26 15 28.6 9 24.6" fill="none" stroke={lo} stroke-width="5" stroke-linecap="round" />
          <path d="M16 16 C16 14 19.4 14 19.4 17 C19.4 21 13.4 22 11.4 18 C9 13.4 13 7.6 18.4 7.6 C25 7.6 28 14.4 25.4 20.4 C23 26 15 28.6 9 24.6" fill="none" stroke={c} stroke-width="3" stroke-linecap="round" />
          <path d="M18.4 8.4 C23 8.8 26 12 26 16" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".6" />
        </>
      );
      break;
    case 'claw':
      body = (
        <>
          {[0, 8, 16].map((x) => (
            <path d={`M${5 + x} 3 C${8.6 + x} 11 ${9.4 + x} 20 ${7 + x} 29 C${3.4 + x} 20 ${2.6 + x} 11 ${5 + x} 3 Z`} fill={c} {...sw} />
          ))}
          {[0, 8, 16].map((x) => <path d={`M${5 + x} 6 C${6.4 + x} 12 ${6.8 + x} 18 ${6 + x} 24`} stroke="#fff" stroke-width="1" fill="none" opacity=".55" stroke-linecap="round" />)}
        </>
      );
      break;
    case 'stomp':
      body = (
        <>
          <path d="M16 6 L18.4 12 L25 10.6 L21.6 16.4 L28 19.6 L21 20.6 L21.6 27 L16 22.6 L10.4 27 L11 20.6 L4 19.6 L10.4 16.4 L7 10.6 L13.6 12 Z" fill={c} {...sw} />
          <path d="M16 11 L17.4 15.4 L22 16.4 L18 18.6 L18.4 23 L16 20.6 L13.6 23 L14 18.6 L10 16.4 L14.6 15.4 Z" fill={hi} opacity=".8" />
          <path d="M2 29 H30" stroke={lo} stroke-width="2" stroke-linecap="round" />
        </>
      );
      break;
    case 'fissure':
      body = (
        <>
          <path d="M16 29 L5 5 Q16 -1 27 5 Z" fill={lo} opacity=".5" />
          <path d="M16 29 L5 5 M16 29 L27 5" stroke={c} stroke-width="1.6" fill="none" stroke-linecap="round" />
          <path d="M16 29 L13 22 L17.6 18 L12.6 12.6 L16.6 8 L14 3" stroke={hi} stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M16 29 L13 22 L17.6 18 L12.6 12.6 L16.6 8 L14 3" stroke={c} stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </>
      );
      break;
    case 'rage':
      body = (
        <>
          <path d="M16 2 C18 8 25 10 25 18 C25 24 21 29 16 29 C11 29 7 24 7 18 C7 14 10 12 11 8 C12 11 14 11 14 8 C14 6 15 4 16 2 Z" fill={c} {...sw} />
          <path d="M16 12 C17 16 21 17 21 21.4 C21 25 19 27 16 27 C13 27 11 25 11 21.6 C11 18 14 17 14.6 14 Z" fill={hi} opacity=".85" />
          <path d="M12 19 L15 20.6 M20 19 L17 20.6" stroke="#2a0a06" stroke-width="1.8" stroke-linecap="round" />
        </>
      );
      break;
    case 'arrow':
      body = (
        <>
          <path d="M4 28 L22 10" stroke={lo} stroke-width="4.2" stroke-linecap="round" />
          <path d="M4 28 L22 10" stroke="#c9b48a" stroke-width="2.2" stroke-linecap="round" />
          <path d="M28 4 L16.8 7.6 L24.4 15.2 Z" fill={c} {...sw} />
          <path d="M3 22 L4 28 L10 29 L8 24 Z M3 22 L9 20 L10 25 L4 28 Z" fill={hi} {...sw} />
        </>
      );
      break;
    case 'turret':
      body = (
        <>
          <path d="M16 15 L7 29 M16 15 L25 29 M16 15 V29" stroke={lo} stroke-width="3.6" stroke-linecap="round" />
          <path d="M16 15 L7 29 M16 15 L25 29 M16 15 V29" stroke="#8a6a3c" stroke-width="1.8" stroke-linecap="round" />
          <path d="M3 8 C10 4 22 4 29 8 C22 7 10 7 3 8 Z" fill={c} {...sw} />
          <path d="M3 8 L16 14 L29 8" stroke="#e8e0cc" stroke-width="1" fill="none" />
          <path d="M16 3 L18.4 9 H13.6 Z" fill={hi} {...sw} />
          <rect x="13.4" y="9" width="5.2" height="9" rx="1.4" fill={c} {...sw} />
        </>
      );
      break;
    case 'fan':
      body = (
        <>
          {[-34, 0, 34].map((a) => (
            <g transform={`rotate(${a} 16 28)`}>
              <path d="M16 28 V9" stroke={lo} stroke-width="3.6" stroke-linecap="round" />
              <path d="M16 28 V9" stroke="#c9b48a" stroke-width="1.8" stroke-linecap="round" />
              <path d="M16 2 L19.6 10 H12.4 Z" fill={c} {...sw} />
            </g>
          ))}
        </>
      );
      break;
    case 'cluster':
      body = (
        <>
          <circle cx="13" cy="19" r="9" fill="#3a3a44" stroke="#0e0e12" stroke-width="1.2" />
          <circle cx="13" cy="19" r="9" fill={c} opacity=".35" />
          <path d="M9 14 A6 6 0 0 1 14 11.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7" />
          <path d="M18 11 C20 7 22 8 23.6 5" stroke="#c9a46a" stroke-width="1.8" fill="none" stroke-linecap="round" />
          <path d="M23.6 1.6 L24.8 4.4 L27.6 4.6 L25.4 6.4 L26.2 9 L23.6 7.4 L21 9 L21.8 6.4 L19.6 4.6 L22.4 4.4 Z" fill={hi} {...sw} />
          <circle cx="27" cy="24" r="2.4" fill={c} {...sw} /><circle cx="24" cy="29" r="1.8" fill={c} {...sw} />
        </>
      );
      break;
    case 'rain':
      body = (
        <>
          <path d="M4 10 C4 5 9 4 11 6 C12 2 19 2 20 7 C25 6 28 10 25 13 H6 C4 13 3 12 4 10 Z" fill={lo} opacity=".6" />
          {[8, 16, 24].map((x, i) => (
            <g transform={`translate(${x} ${i % 2 ? 4 : 0})`}>
              <path d="M0 14 V28" stroke="#c9b48a" stroke-width="1.8" stroke-linecap="round" />
              <path d="M0 31 L-3 25 H3 Z" fill={c} {...sw} />
              <path d="M0 14 L-2.4 11 M0 14 L2.4 11 M0 17 L-2.4 14 M0 17 L2.4 14" stroke={hi} stroke-width="1.2" stroke-linecap="round" />
            </g>
          ))}
        </>
      );
      break;
    case 'paw':
      body = (
        <>
          <path d="M16 15 C21 15 25.6 20 25 24.6 C24.6 28 21 28 16 26.4 C11 28 7.4 28 7 24.6 C6.4 20 11 15 16 15 Z" fill={c} {...sw} />
          {[[6.5, 12, -18], [12, 6.6, -6], [20, 6.6, 6], [25.5, 12, 18]].map(([x, y, r]) => <ellipse cx={x} cy={y} rx="3" ry="3.8" transform={`rotate(${r} ${x} ${y})`} fill={c} {...sw} />)}
          <path d="M11 19 C13 17 16 17 18 18" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".6" />
        </>
      );
      break;
    case 'missile':
      body = (
        <>
          <path d="M3 29 C8 24 12 22 18 18" stroke={c} stroke-width="3" stroke-linecap="round" opacity=".5" />
          <path d="M6 24 C10 22 12 20 15 18" stroke={hi} stroke-width="1.4" stroke-linecap="round" opacity=".8" />
          <circle cx="21" cy="12" r="8.4" fill={c} {...sw} />
          <circle cx="21" cy="12" r="5" fill={hi} opacity=".8" />
          <circle cx="19" cy="10" r="2.2" fill="#fff" opacity=".9" />
          <path d="M5 8 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 z" fill="#fff" opacity=".85" />
        </>
      );
      break;
    case 'meteor':
      body = (
        <>
          <path d="M3 6 C10 8 14 12 20 16 L16 20 C12 14 8 9 3 6 Z" fill="#ffb347" opacity=".75" />
          <path d="M6 3 C12 6 17 10 22 15 L19 18 C14 12 10 7 6 3 Z" fill={hi} opacity=".7" />
          <path d="M16 12 C21 9 28 14 27 21 C26 27 18 29 14 25 C10 21 12 14 16 12 Z" fill={c} {...sw} />
          <path d="M15 17 C16 15 19 14 21 15.4" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7" />
          <circle cx="22" cy="23" r="1.6" fill={lo} opacity=".7" /><circle cx="17.6" cy="22" r="1.1" fill={lo} opacity=".7" />
        </>
      );
      break;
    case 'vortex':
      body = (
        <>
          <circle cx="16" cy="16" r="13" fill={lo} opacity=".55" />
          {[0, 120, 240].map((a) => (
            <path d="M16 16 C16 10 20 6 26 7 C22 9 21 12 22 16" transform={`rotate(${a} 16 16)`} fill="none" stroke={c} stroke-width="3" stroke-linecap="round" />
          ))}
          <circle cx="16" cy="16" r="3.4" fill="#0a0612" stroke={hi} stroke-width="1" />
        </>
      );
      break;
    case 'snowflake':
      body = (
        <>
          {[0, 60, 120].map((a) => (
            <g transform={`rotate(${a} 16 16)`}>
              <path d="M16 2.5 V29.5" stroke={lo} stroke-width="4" stroke-linecap="round" />
              <path d="M16 2.5 V29.5 M16 8 L12 4.6 M16 8 L20 4.6 M16 24 L12 27.4 M16 24 L20 27.4" stroke={c} stroke-width="2" stroke-linecap="round" fill="none" />
            </g>
          ))}
          <circle cx="16" cy="16" r="2.6" fill="#fff" opacity=".9" />
        </>
      );
      break;
    case 'hydra':
      body = (
        <>
          <path d="M5 29 C7 22 4 16 7 9 M16 29 C16 22 16 14 16 7 M27 29 C25 22 28 16 25 9" stroke={lo} stroke-width="6.4" stroke-linecap="round" fill="none" />
          <path d="M5 29 C7 22 4 16 7 9 M16 29 C16 22 16 14 16 7 M27 29 C25 22 28 16 25 9" stroke={c} stroke-width="4" stroke-linecap="round" fill="none" />
          {[[7, 8], [16, 6], [25, 8]].map(([x, y]) => (
            <g>
              <ellipse cx={x} cy={y} rx="4.4" ry="3.6" fill={c} {...sw} />
              <circle cx={x - 1.4} cy={y - 0.6} r=".9" fill="#ffe28a" />
              <circle cx={x + 1.4} cy={y - 0.6} r=".9" fill="#ffe28a" />
            </g>
          ))}
          <path d="M3 29.5 H29" stroke="#ff7a3a" stroke-width="2" stroke-linecap="round" opacity=".8" />
        </>
      );
      break;
    default: // rune
      body = (
        <>
          <circle cx="16" cy="16" r="12.6" fill={lo} opacity=".35" stroke={c} stroke-width="1.6" />
          <circle cx="16" cy="16" r="9.4" fill="none" stroke={c} stroke-width=".8" stroke-dasharray="2 2" opacity=".7" />
          <path d="M12 7 V25 M12 11 L20.4 16 L12 21" stroke={hi} stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <path d="M12 7 V25 M12 11 L20.4 16 L12 21" stroke={c} stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </>
      );
  }
  return <Svg size={size} class="skill-glyph">{body}</Svg>;
}

// ─────────────────────────── Cube function icons ───────────────────────────

export function CubeFnIcon({ op, size = 20 }: { op: CubeOp; size?: number }) {
  const a = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const };
  let body;
  switch (op) {
    case 'salvage': // anvil
      body = (
        <>
          <path d="M3 8 H17.6 C19.6 8 21.4 9 22.2 10.4 C20.6 11 19 11 17.8 12 L16.6 14 H15 V17 H18 V20 H6 V17 H9 V14 H8 C6 14 3.6 11.6 3 8 Z" {...a} />
          <path d="M6.4 11 H15" {...a} opacity=".5" />
        </>
      );
      break;
    case 'fuse': // gem + merge
      body = (
        <>
          <path d="M6.4 8.6 L9.2 4 H14.8 L17.6 8.6 L12 20 Z" {...a} />
          <path d="M6.4 8.6 H17.6 M9.2 4 L12 8.6 L14.8 4 M12 8.6 V20" {...a} opacity=".6" />
        </>
      );
      break;
    case 'enchant': // sparkles
      body = (
        <>
          <path d="M10 4 L12 10 L18 12 L12 14 L10 20 L8 14 L2 12 L8 10 Z" {...a} />
          <path d="M18 3 L19 6 L22 7 L19 8 L18 11 L17 8 L14 7 L17 6 Z" {...a} />
        </>
      );
      break;
    case 'upgrade': // empower
      body = (
        <>
          <path d="M12 3 L19 11 H15 V16 H9 V11 H5 Z" {...a} />
          <path d="M8 19.4 H16 M9.6 22 H14.4" {...a} />
        </>
      );
      break;
    case 'transmute': // alchemical triangle in circle
      body = (
        <>
          <circle cx="12" cy="12" r="9" {...a} />
          <path d="M12 6 L18 16.4 H6 Z" {...a} />
          <path d="M8.6 12.6 H15.4" {...a} opacity=".6" />
        </>
      );
      break;
    case 'extract': // flask with rising essence
      body = (
        <>
          <path d="M9.4 3 H14.6 M10.2 3 V9 L4.6 18.4 C3.8 20 4.8 21 6.4 21 H17.6 C19.2 21 20.2 20 19.4 18.4 L13.8 9 V3" {...a} />
          <path d="M7.4 15 C9.6 13.6 11 16.4 13.4 15 C15 14.2 16 14.4 17 15" {...a} opacity=".7" />
          <path d="M12 12 V8.6 M10.4 10 L12 8.4 L13.6 10" {...a} opacity=".7" />
        </>
      );
      break;
    case 'reforge': // hammer
      body = (
        <>
          <path d="M13.6 3.4 L20.6 10.4 L17.6 13.4 L15.2 11 L5 21 L3 19 L13 8.8 L10.6 6.4 Z" {...a} />
        </>
      );
      break;
    default: // socket
      body = (
        <>
          <circle cx="12" cy="12" r="8.6" {...a} />
          <circle cx="12" cy="12" r="4.4" {...a} />
          <path d="M12 3.4 V6 M12 18 V20.6 M3.4 12 H6 M18 12 H20.6" {...a} />
        </>
      );
  }
  return <Svg size={size} vb={24} class="cubefn-icon">{body}</Svg>;
}
