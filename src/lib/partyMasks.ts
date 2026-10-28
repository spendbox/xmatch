// @ts-nocheck -- generated SVG drawing code: shapes and paths built from numbers and strings
/**
 * Party masks: premium half masks that cover the eyes, brows and nose (the mouth and chin stay
 * uncovered). Same drawing area as the full masks (-26,-44 252×252), with the eye holes at
 * (78,102) and (122,102); lib/maskPlace fits them to the face.
 *
 * They're built to look real: a moulded shape lit from the top left (raised edges catch the light),
 * a real material (satin, glitter, sequins, velvet, lace, lacquer), a polished metal edge, and
 * cut crystals, pearls, feathers, ribbons or roses. Colour and trim come from the mask editor.
 */

// ---------- Shapes: the right half (top centre → bottom centre), mirrored for the left ----------
type Seg = number[];
function sym(start: number[], segs: Seg[]) {
  let d = `M${start[0]} ${start[1]}`;
  for (const s of segs) d += ` C${s[0]} ${s[1]} ${s[2]} ${s[3]} ${s[4]} ${s[5]}`;
  const from = [start, ...segs.map((s) => [s[4], s[5]])];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const a = from[i];
    d += ` C${200 - s[2]} ${s[3]} ${200 - s[0]} ${s[1]} ${200 - a[0]} ${a[1]}`;
  }
  return d + "Z";
}
/** Points along the edge (both sides), pulled in a little so ornaments sit on the mask */
function edge(start, segs, per = 4, pull = 0.94, skip = 0) {
  const out = [];
  let a = start;
  segs.forEach((s, k) => {
    for (let i = k === 0 ? 1 : 0; i < per; i++) {
      const t = i / per;
      const u = 1 - t;
      const x = u * u * u * a[0] + 3 * u * u * t * s[0] + 3 * u * t * t * s[2] + t * t * t * s[4];
      const y = u * u * u * a[1] + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5];
      out.push([100 + (x - 100) * pull, 104 + (y - 104) * pull]);
    }
    a = [s[4], s[5]];
  });
  const right = out.slice(skip);
  return [...right, ...right.map(([x, y]) => [200 - x, y])];
}

const SHAPES = {
  classic: [[100, 74], [[110, 64, 126, 58, 144, 60], [156, 61, 168, 54, 176, 44], [180, 39, 185, 36, 191, 33], [188, 46, 184, 62, 176, 76], [170, 88, 168, 100, 160, 112], [152, 124, 136, 130, 122, 126], [118, 125, 116, 126, 115, 128], [114, 134, 108, 146, 100, 148]]],
  cat: [[100, 76], [[112, 66, 132, 60, 150, 60], [166, 60, 180, 48, 195, 25], [193, 52, 184, 74, 170, 92], [162, 106, 152, 122, 138, 128], [128, 132, 120, 128, 116, 126], [114, 134, 108, 146, 100, 148]]],
  wings: [[100, 80], [[106, 60, 124, 38, 150, 36], [174, 34, 188, 52, 182, 72], [178, 84, 168, 92, 170, 102], [174, 116, 164, 134, 146, 134], [132, 134, 122, 128, 116, 124], [114, 134, 108, 146, 100, 148]]],
  flame: [[100, 70], [[106, 62, 112, 56, 116, 44], [118, 56, 124, 62, 130, 62], [136, 58, 141, 48, 141, 34], [147, 50, 151, 58, 157, 60], [165, 56, 171, 44, 172, 28], [182, 46, 182, 64, 176, 80], [170, 96, 166, 108, 156, 118], [146, 128, 130, 130, 118, 126], [114, 134, 108, 146, 100, 148]]],
  crown: [[100, 50], [[102, 60, 106, 68, 112, 72], [118, 68, 122, 58, 126, 46], [128, 58, 134, 66, 142, 68], [150, 64, 156, 56, 163, 46], [166, 60, 174, 72, 176, 84], [174, 98, 166, 110, 156, 118], [146, 128, 130, 130, 118, 126], [114, 134, 108, 146, 100, 148]]],
  domino: [[100, 78], [[116, 70, 140, 66, 160, 70], [176, 74, 183, 88, 179, 102], [175, 116, 160, 126, 142, 126], [130, 126, 120, 122, 116, 122], [114, 134, 108, 146, 100, 148]]],
};
const shapeOf = (k) => sym(SHAPES[k][0], SHAPES[k][1]);
const edgeOf = (k, per, pull, skip) => edge(SHAPES[k][0], SHAPES[k][1], per, pull, skip);

// ---------- Eye holes ----------
const mir = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(200 - Number(x)).toFixed(2)} ${y}`);
const both = (d) => `${d} ${mir(d)}`;
const EYES = {
  almond: both("M61 104 C67 92 86 90 96 101 C88 112 69 114 61 104Z"),
  cat: both("M58 102 C66 91 86 89 96 100 C88 112 70 115 61 107 C58 106 55 104 52 99 C55 101 57 102 58 102Z"),
  round: both("M62 103 C64 92 90 90 95 102 C92 112 66 114 62 103Z"),
};

// ---------- Colour helpers (the editor's colour picks the palette) ----------
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => +v.toFixed(3));
};

// ---------- Defs: lighting, materials and metal ----------
function defs(p, t, id) {
  const [r1, g1, b1] = rgb(p.pale);
  return `
  <linearGradient id="${id}b" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="0.45" stop-color="${p.base}"/><stop offset="1" stop-color="${p.dark}"/></linearGradient>
  <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.hi}"/><stop offset="0.28" stop-color="${t.mid}"/><stop offset="0.5" stop-color="${t.lo}"/><stop offset="0.72" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.hi}"/></linearGradient>
  <linearGradient id="${id}mv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.hi}"/><stop offset="0.45" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.lo}"/></linearGradient>
  <radialGradient id="${id}hole" cx="0.5" cy="0.75" r="0.75"><stop offset="0" stop-color="#22182e"/><stop offset="1" stop-color="#030106"/></radialGradient>
  <radialGradient id="${id}clear" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="#eef3fa"/><stop offset="0.75" stop-color="#b9c4d4"/><stop offset="1" stop-color="#6d7a8e"/></radialGradient>
  <radialGradient id="${id}cont" cx="0.5" cy="0.56" r="0.62"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.32"/></radialGradient>
  <linearGradient id="${id}ridge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="0.38" stop-color="#000" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>
  <radialGradient id="${id}pearl" cx="0.36" cy="0.3" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#f7f1e8"/><stop offset="0.75" stop-color="#d9ccb8"/><stop offset="1" stop-color="#9d8f7c"/></radialGradient>
  <radialGradient id="${id}seq" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${p.pale}"/><stop offset="0.4" stop-color="${p.light}"/><stop offset="0.8" stop-color="${p.base}"/><stop offset="1" stop-color="${p.deep}"/></radialGradient>
  <linearGradient id="${id}sat" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/><stop offset="0.62" stop-color="#fff" stop-opacity="0"/><stop offset="0.72" stop-color="#fff" stop-opacity="0.2"/><stop offset="0.84" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="${id}gloss" cx="0.3" cy="0.2" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="${id}mold" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.1" result="h"/>
    <feDiffuseLighting in="h" surfaceScale="3.2" diffuseConstant="1.18" lighting-color="#fff" result="d"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
    <feSpecularLighting in="h" surfaceScale="3.2" specularConstant="0.7" specularExponent="24" lighting-color="#fff" result="s"><feDistantLight azimuth="235" elevation="52"/></feSpecularLighting>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.15" result="lit"/>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
    <feComposite in="lit" in2="sp" operator="arithmetic" k2="1" k3="0.5" result="all"/>
    <feComposite in="all" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="${id}bev" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="h"/>
    <feSpecularLighting in="h" surfaceScale="2.6" specularConstant="1.1" specularExponent="26" lighting-color="#fff" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
    <feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k2="1" k3="0.8" result="m"/>
    <feDropShadow in="m" dx="0" dy="0.7" stdDeviation="0.5" flood-color="#000" flood-opacity="0.55"/>
  </filter>
  <filter id="${id}ds" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="3.4" stdDeviation="3.2" flood-color="#000" flood-opacity="0.5"/></filter>
  <filter id="${id}glw" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="1" seed="7" result="n"/><feColorMatrix in="n" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  10 0 0 0 -6.1"/></filter>
  <filter id="${id}glc" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="21" result="n"/><feColorMatrix in="n" values="0 0 0 0 ${r1}  0 0 0 0 ${g1}  0 0 0 0 ${b1}  9 0 0 0 -4.9"/></filter>
  <filter id="${id}vel" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 0.75"/></filter>
  <filter id="${id}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
  <filter id="${id}soft2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1"/></filter>`;
}

// ---------- Pieces ----------
/** A cut crystal in a metal setting: eight facets lit from the top left, and a sparkle */
function crystal(id, x, y, r, c, sparkle = true) {
  const pts = (rr, off) => Array.from({ length: 8 }, (_, k) => {
    const a = ((k * 45 + off) * Math.PI) / 180;
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  });
  const o = pts(r, 22.5);
  const tb = pts(r * 0.52, 22.5);
  const f = (v) => v.toFixed(2);
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r + r * 0.28 + 0.5)}" fill="url(#${id}m)" filter="url(#${id}bev)"/>`;
  for (let k = 0; k < 8; k++) {
    const n = (k + 1) % 8;
    // Facing the light (top left) is bright
    const ang = ((k * 45 + 45) * Math.PI) / 180;
    const lightness = 0.5 + 0.5 * -Math.cos(ang - Math.PI / 4 + Math.PI);
    const fill = lightness > 0.7 ? c.light : lightness > 0.4 ? c.base : c.dark;
    s += `<path d="M${f(o[k][0])} ${f(o[k][1])} L${f(o[n][0])} ${f(o[n][1])} L${f(tb[n][0])} ${f(tb[n][1])} L${f(tb[k][0])} ${f(tb[k][1])}Z" fill="${fill}"/>`;
  }
  s += `<path d="M${tb.map((q) => `${f(q[0])} ${f(q[1])}`).join(" L")}Z" fill="${c.base}"/><path d="M${f(tb[4][0])} ${f(tb[4][1])} L${f(tb[5][0])} ${f(tb[5][1])} L${f(tb[6][0])} ${f(tb[6][1])} L${f(x)} ${f(y)}Z" fill="#fff" opacity="0.55"/>`;
  if (sparkle) s += star4(x - r * 0.35, y - r * 0.4, r * 0.7, 0.95);
  return s;
}
/** A small rhinestone (used many times along an edge, so kept simple) */
const stone = (id, x, y, r, clear = false) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 0.55).toFixed(2)}" fill="url(#${id}m)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="url(#${id}${clear ? "clear" : "gem"})"/><circle cx="${(x - r * 0.35).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" r="${(r * 0.32).toFixed(2)}" fill="#fff" opacity="0.9"/>`;
const pearl = (id, x, y, r) => `<circle cx="${x.toFixed(1)}" cy="${(y + r * 0.25).toFixed(1)}" r="${r.toFixed(2)}" fill="#000" opacity="0.25"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="url(#${id}pearl)"/><ellipse cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" rx="${(r * 0.32).toFixed(2)}" ry="${(r * 0.2).toFixed(2)}" fill="#fff" opacity="0.9" transform="rotate(-30 ${(x - r * 0.3).toFixed(1)} ${(y - r * 0.35).toFixed(1)})"/><circle cx="${(x + r * 0.25).toFixed(1)}" cy="${(y + r * 0.3).toFixed(1)}" r="${(r * 0.5).toFixed(2)}" fill="#ffd6e6" opacity="0.18"/>`;
const star4 = (x, y, r, o = 1) => `<path d="M${x} ${y - r} Q${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y} Q${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r} Q${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y} Q${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r}Z" fill="#fff" opacity="${o}"/>`;

/** A spiral curl (filigree): from the centre out */
function curl(cx, cy, r, turns = 1.6, start = 0, dir = 1) {
  let d = "";
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = start + dir * t * turns * Math.PI * 2;
    const rr = r * (0.18 + 0.82 * t);
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return d;
}
const metalLine = (id, d, w = 1.6) => `<path d="${d}" fill="none" stroke="url(#${id}m)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}bev)"/>`;

/** A real-looking feather: a curved shaft with fine barbs either side, fading at the edges */
function plume(id, k, bx, by, ang, len, wid, c1, c2, eye = null) {
  const r = (ang * Math.PI) / 180;
  const ux = Math.cos(r);
  const uy = Math.sin(r);
  const nx = -uy;
  const ny = ux;
  const bend = len * 0.12;
  const at = (t) => {
    const b = Math.sin(t * Math.PI) * bend * t;
    return [bx + ux * len * t + nx * b, by + uy * len * t + ny * b];
  };
  const tip = at(1);
  let barbs = "";
  const N = 72;
  for (let i = 2; i < N; i++) {
    const t = i / N;
    const [x, y] = at(t);
    const env = Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.7;
    for (const side of [1, -1]) {
      const w = wid * env * (0.88 + ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 0.03);
      const ex = x + (nx * side * w + ux * w * 0.55);
      const ey = y + (ny * side * w + uy * w * 0.55);
      const mx = x + nx * side * w * 0.5 + ux * w * 0.1;
      const my = y + ny * side * w * 0.5 + uy * w * 0.1;
      barbs += `M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
  }
  const g = `${id}f${k}`;
  let shaft = "M" + Array.from({ length: 11 }, (_, i) => at(i / 10).map((v) => v.toFixed(1)).join(" ")).join(" L");
  const eyeSvg = eye
    ? (() => {
        const [ex, ey] = at(0.86);
        return `<g transform="rotate(${ang + 90} ${ex.toFixed(1)} ${ey.toFixed(1)})"><ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${(wid * 0.62).toFixed(1)}" ry="${(wid * 0.85).toFixed(1)}" fill="${eye[0]}" opacity="0.95"/><ellipse cx="${ex.toFixed(1)}" cy="${(ey + 0.6).toFixed(1)}" rx="${(wid * 0.44).toFixed(1)}" ry="${(wid * 0.6).toFixed(1)}" fill="url(#${id}m)"/><ellipse cx="${ex.toFixed(1)}" cy="${(ey + 1).toFixed(1)}" rx="${(wid * 0.32).toFixed(1)}" ry="${(wid * 0.44).toFixed(1)}" fill="${eye[1]}"/><ellipse cx="${ex.toFixed(1)}" cy="${(ey + 1.4).toFixed(1)}" rx="${(wid * 0.16).toFixed(1)}" ry="${(wid * 0.24).toFixed(1)}" fill="#0a0612"/></g>`;
      })()
    : "";
  // A soft body under the barbs, so the feather looks full
  const body = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const [x, y] = at(t);
    const w = wid * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.7 * 0.85;
    body.push([x + nx * w + ux * w * 0.5, y + ny * w + uy * w * 0.5]);
  }
  for (let i = 20; i >= 0; i--) {
    const t = i / 20;
    const [x, y] = at(t);
    const w = wid * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.7 * 0.85;
    body.push([x - nx * w + ux * w * 0.5, y - ny * w + uy * w * 0.5]);
  }
  const bodyD = "M" + body.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L") + "Z";
  return `<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="${bx}" y1="${by}" x2="${tip[0].toFixed(1)}" y2="${tip[1].toFixed(1)}"><stop offset="0" stop-color="${c2}"/><stop offset="0.5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <path d="${bodyD}" fill="url(#${g})" opacity="0.55" filter="url(#${id}soft2)"/>
    <path d="${barbs}" fill="none" stroke="url(#${g})" stroke-width="0.75" stroke-linecap="round" opacity="0.9"/>${eyeSvg}
    <path d="${shaft}" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="0.7" stroke-linecap="round"/>`;
}

/** A satin ribbon hanging from the side of the mask */
function ribbon(id, x, y, side, p) {
  const s = side;
  const band = `M${x} ${y} C${x + s * 10} ${y + 8} ${x + s * 6} ${y + 26} ${x + s * 16} ${y + 44} L${x + s * 24} ${y + 40} C${x + s * 15} ${y + 24} ${x + s * 19} ${y + 8} ${x + s * 9} ${y - 3}Z`;
  const tail = `M${x} ${y} C${x + s * 4} ${y + 14} ${x - s * 2} ${y + 34} ${x + s * 4} ${y + 54} L${x + s * 11} ${y + 50} C${x + s * 6} ${y + 32} ${x + s * 12} ${y + 14} ${x + s * 8} ${y - 2}Z`;
  return `<path d="${tail}" fill="${p.dark}"/><path d="${tail}" fill="url(#${id}sat)"/><path d="${band}" fill="url(#${id}b)"/><path d="${band}" fill="url(#${id}sat)"/>`;
}

/** A fabric rose: layered petals, darker in the middle */
function rose(id, x, y, r, p) {
  let s = "";
  for (let k = 0; k < 6; k++) {
    const a = k * 60 + 15;
    s += `<ellipse cx="${x}" cy="${(y - r * 0.5).toFixed(1)}" rx="${(r * 0.52).toFixed(1)}" ry="${(r * 0.62).toFixed(1)}" fill="${k % 2 ? p.base : p.light}" stroke="${p.deep}" stroke-opacity="0.35" stroke-width="0.5" transform="rotate(${a} ${x} ${y})"/>`;
  }
  for (let k = 0; k < 4; k++) {
    const a = k * 90 + 50;
    s += `<ellipse cx="${x}" cy="${(y - r * 0.3).toFixed(1)}" rx="${(r * 0.36).toFixed(1)}" ry="${(r * 0.42).toFixed(1)}" fill="${p.base}" stroke="${p.deep}" stroke-opacity="0.45" stroke-width="0.5" transform="rotate(${a} ${x} ${y})"/>`;
  }
  s += `<circle cx="${x}" cy="${y}" r="${(r * 0.34).toFixed(1)}" fill="${p.dark}"/><path d="${curl(x, y, r * 0.32, 1.4, 0, 1)}" fill="none" stroke="${p.deep}" stroke-width="0.8"/><ellipse cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.45).toFixed(1)}" rx="${(r * 0.25).toFixed(1)}" ry="${(r * 0.12).toFixed(1)}" fill="#fff" opacity="0.35" transform="rotate(-30 ${x} ${y})"/>`;
  return s;
}
const leaf = (x, y, ang, l) => `<g transform="rotate(${ang} ${x} ${y})"><path d="M${x} ${y} C${x + l * 0.3} ${y - l * 0.32} ${x + l * 0.75} ${y - l * 0.28} ${x + l} ${y} C${x + l * 0.75} ${y + l * 0.28} ${x + l * 0.3} ${y + l * 0.32} ${x} ${y}Z" fill="#2f6b3a"/><path d="M${x} ${y} L${x + l * 0.95} ${y}" stroke="#a6d39a" stroke-opacity="0.6" stroke-width="0.6"/></g>`;

// ---------- Materials (inside the mask) ----------
const MAT = {
  satin: (id, p, d) => `<path d="${d}" fill="url(#${id}b)"/><path d="${d}" fill="url(#${id}sat)"/>`,
  glitter: (id, p, d) => `<path d="${d}" fill="url(#${id}b)"/><rect x="-26" y="-44" width="252" height="252" filter="url(#${id}glc)" opacity="0.9"/><rect x="-26" y="-44" width="252" height="252" filter="url(#${id}glw)" opacity="0.95"/>`,
  velvet: (id, p, d) => `<path d="${d}" fill="url(#${id}b)"/><rect x="-26" y="-44" width="252" height="252" filter="url(#${id}vel)" opacity="0.22"/><path d="${d}" fill="none" stroke="${p.light}" stroke-opacity="0.45" stroke-width="5" filter="url(#${id}soft)"/>`,
  lacquer: (id, p, d) => `<path d="${d}" fill="url(#${id}b)"/><ellipse cx="78" cy="70" rx="46" ry="18" fill="url(#${id}gloss)" transform="rotate(-12 78 70)"/>`,
  sequins: (id, p, d) => {
    // One tile of overlapping sequins (some lighter, some darker, a few sparkling), repeated
    const W = 24;
    const H = 23.4;
    let tile = "";
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        const x = c * 4.8 + (r % 2) * 2.4;
        const y = r * 3.9;
        const o = Math.abs((Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1);
        for (const [dx, dy] of [[0, 0], [-W, 0], [W, 0], [0, -H], [0, H], [-W, -H], [W, -H], [-W, H], [W, H]]) {
          const cx = +(x + dx).toFixed(1);
          const cy = +(y + dy).toFixed(1);
          if (cx < -3 || cx > W + 3 || cy < -3 || cy > H + 3) continue;
          tile += `<circle cx="${cx}" cy="${cy}" r="2.95" fill="url(#${id}seq)"/>${o < 0.18 ? `<circle cx="${cx}" cy="${cy}" r="2.95" fill="#000" opacity="0.25"/>` : o > 0.7 && o <= 0.86 ? `<circle cx="${cx}" cy="${cy}" r="2.95" fill="#fff" opacity="0.22"/>` : ""}${o > 0.86 ? `<circle cx="${(cx - 0.8).toFixed(1)}" cy="${(cy - 0.9).toFixed(1)}" r="0.9" fill="#fff"/>` : ""}`;
        }
      }
    }
    return `<pattern id="${id}sq" patternUnits="userSpaceOnUse" x="4" y="26" width="${W}" height="${H}">${tile}</pattern><path d="${d}" fill="${p.dark}"/><path d="${d}" fill="url(#${id}sq)"/>`;
  },
  lace: (id, p, d) => {
    // A fine net, with small lace flowers on it (one tile, repeated)
    let fl = "";
    for (const [x, y] of [[0, 0], [13, 0], [6.5, 13], [0, 26], [13, 26]]) {
      for (let k = 0; k < 5; k++) {
        const a = (k * 72 * Math.PI) / 180;
        const px = (x + Math.cos(a) * 2.6).toFixed(1);
        const py = (y + Math.sin(a) * 2.6).toFixed(1);
        fl += `<ellipse cx="${px}" cy="${py}" rx="1.9" ry="1.15" transform="rotate(${k * 72} ${px} ${py})"/>`;
      }
      fl += `<circle cx="${x}" cy="${y}" r="0.8" fill="${p.pale}" fill-opacity="0.5"/>`;
    }
    return `<pattern id="${id}net" patternUnits="userSpaceOnUse" width="3.6" height="3.6"><path d="M0 0 L3.6 3.6 M3.6 0 L0 3.6" stroke="${p.pale}" stroke-opacity="0.16" stroke-width="0.32"/></pattern>
      <pattern id="${id}lc" patternUnits="userSpaceOnUse" x="8" y="30" width="13" height="26"><g fill="none" stroke="${p.pale}" stroke-opacity="0.5" stroke-width="0.45">${fl}</g></pattern>
      <path d="${d}" fill="url(#${id}b)"/><path d="${d}" fill="url(#${id}net)"/><path d="${d}" fill="url(#${id}lc)"/>`;
  },
};

// ---------- Building a mask ----------
type Party = {
  id: string;
  name: string;
  color: string;
  shape: keyof typeof SHAPES;
  mat: keyof typeof MAT;
  eyes?: keyof typeof EYES;
  back?: (id, p, t) => string;
  over?: (id, p, t) => string;
  front?: (id, p, t) => string;
};

function draw(m: Party, p, t, util) {
  const id = "pm";
  const d = shapeOf(m.shape);
  const eyes = EYES[m.eyes ?? "almond"];
  const jh = util.hexToHsl(p.jewel)[0];
  const gemC = { light: util.hslToHex(jh, 85, 72), base: p.jewel, dark: util.hslToHex(jh, 85, 26) };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -44 252 252" width="1512" height="1512"><defs>${defs(p, t, id)}
    <radialGradient id="${id}gem" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff"/><stop offset="0.3" stop-color="${gemC.light}"/><stop offset="0.75" stop-color="${gemC.base}"/><stop offset="1" stop-color="${gemC.dark}"/></radialGradient>
    <clipPath id="${id}c"><path d="${d}"/></clipPath></defs>
    ${m.back ? m.back(id, p, t, gemC) : ""}
    <g filter="url(#${id}ds)">
      <path d="${d}" fill="${p.deep}" transform="translate(0 1.8)"/>
      <g filter="url(#${id}mold)">
        <g clip-path="url(#${id}c)">${MAT[m.mat](id, p, d)}${m.over ? m.over(id, p, t, gemC) : ""}
          <rect x="80" y="76" width="40" height="78" fill="url(#${id}ridge)" filter="url(#${id}soft)"/>
          <ellipse cx="100" cy="84" rx="44" ry="8" fill="#fff" opacity="0.14" filter="url(#${id}soft)"/>
          <path d="${d}" fill="url(#${id}cont)"/>
          <path d="${d}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="6" filter="url(#${id}soft)"/>
        </g>
      </g>
      <path d="${d}" fill="none" stroke="url(#${id}m)" stroke-width="2.4" stroke-linejoin="round" filter="url(#${id}bev)"/>
      <path d="${eyes}" fill="url(#${id}hole)"/>
      <path d="${eyes}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="3.2" filter="url(#${id}soft)"/>
      <path d="${eyes}" fill="none" stroke="url(#${id}m)" stroke-width="1.7" stroke-linejoin="round" filter="url(#${id}bev)"/>
      ${m.front ? m.front(id, p, t, gemC) : ""}
    </g>
  </svg>`;
}

const DESIGNS: Party[] = [
  {
    id: "pm-gala", name: "Gala", color: "#e8b143", shape: "classic", mat: "glitter",
    front: (id, p, t, c) => edgeOf("classic", 5, 0.92, 2).map(([x, y]) => stone(id, x, y, 1.6, true)).join("") + crystal(id, 100, 86, 4.6, c),
  },
  {
    id: "pm-filigree", name: "Filigree", color: "#253a8f", shape: "classic", mat: "satin",
    over: (id) => metalLine(id, both(curl(66, 82, 9, 1.5, 3.4, -1)), 1.3) + metalLine(id, both(curl(54, 114, 6, 1.4, 2.2, 1)), 1.1) + metalLine(id, both("M98 92 C92 80 80 74 68 74"), 1.3) + metalLine(id, both("M100 140 C100 128 104 118 112 112"), 1.1),
    front: (id, p, t, c) => crystal(id, 100, 84, 5, c) + crystal(id, 52, 116, 2.4, c, false) + crystal(id, 148, 116, 2.4, c, false),
  },
  {
    id: "pm-peacock", name: "Peacock", color: "#0f8a8a", shape: "classic", mat: "satin",
    back: (id, p) => [[-108, 98, 12], [-90, 108, 13], [-72, 102, 12], [-56, 90, 11]].map(([a, l, w], i) => plume(id, i, 152, 60, a, l, w, i % 2 ? p.light : p.base, p.deep, [p.base, p.alt])).join(""),
    over: (id) => metalLine(id, both("M60 88 C66 76 84 74 94 84"), 1.2),
    front: (id, p, t, c) => crystal(id, 152, 60, 6, c) + crystal(id, 100, 86, 3.4, c, false),
  },
  {
    id: "pm-swan", name: "Black swan", color: "#1d1a26", shape: "classic", mat: "lace",
    back: (id, p) => ribbon(id, 28, 88, -1, p) + ribbon(id, 172, 88, 1, p) + [[-132, 74, 10], [-114, 84, 11], [-96, 76, 10]].map(([a, l, w], i) => plume(id, i, 48, 64, a, l, w, "#4a4458", "#05030a")).join(""),
    over: (id) => metalLine(id, "M56 92 C66 72 90 70 100 86 C110 70 134 72 144 92", 1.5),
    front: (id, p, t, c) => [[100, 78], [76, 122], [124, 122]].map(([x, y], i) => pearl(id, x, y, i ? 2.2 : 3)).join("") + crystal(id, 48, 64, 4.4, c),
  },
  {
    id: "pm-sequin", name: "Sequins", color: "#d92f3a", shape: "cat", mat: "sequins", eyes: "cat",
    front: (id, p, t, c) => crystal(id, 186, 34, 3.4, c) + crystal(id, 14, 34, 3.4, c) + crystal(id, 100, 86, 3.8, c),
  },
  {
    id: "pm-crystal", name: "Crystal cat", color: "#1d1a26", shape: "cat", mat: "lacquer", eyes: "cat",
    front: (id, p, t, c) => edgeOf("cat", 6, 0.9, 0).filter(([x, y]) => y < 92).map(([x, y], i) => stone(id, x, y, i % 3 ? 1.4 : 1.9)).join("") + crystal(id, 100, 86, 4.2, c),
  },
  {
    id: "pm-butterfly", name: "Butterfly", color: "#b44cff", shape: "wings", mat: "glitter",
    over: (id, p) => `${[both("M98 92 C84 70 64 52 44 50"), both("M98 96 C82 84 60 76 40 70"), both("M96 112 C80 118 64 124 50 126"), both("M98 116 C90 124 80 130 70 132")].map((d) => `<path d="${d}" fill="none" stroke="${p.deep}" stroke-opacity="0.75" stroke-width="1.2"/>`).join("")}${[[44, 56, 6], [156, 56, 6], [46, 124, 4], [154, 124, 4], [64, 46, 3], [136, 46, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.pale}" opacity="0.85"/>`).join("")}`,
    front: (id, p, t, c) => `<ellipse cx="100" cy="112" rx="3.6" ry="32" fill="url(#${id}mv)" filter="url(#${id}bev)"/>` + metalLine(id, "M99 82 C96 70 90 62 84 58 M101 82 C104 70 110 62 116 58", 0.9) + `<circle cx="84" cy="58" r="1.6" fill="url(#${id}m)"/><circle cx="116" cy="58" r="1.6" fill="url(#${id}m)"/>`,
  },
  {
    id: "pm-pearls", name: "Pearls", color: "#5b3fd9", shape: "domino", mat: "velvet", eyes: "round",
    front: (id) => edgeOf("domino", 6, 0.94, 0).map(([x, y]) => pearl(id, x, y, 2)).join("") + [0, 1, 2, 3, 4, 5].map((i) => pearl(id, 180 + Math.sin(i * 0.5) * 3, 104 + i * 4.4, 1.9 + i * 0.12) + pearl(id, 20 - Math.sin(i * 0.5) * 3, 104 + i * 4.4, 1.9 + i * 0.12)).join("") + pearl(id, 100, 86, 3.4),
  },
  {
    id: "pm-rose", name: "Rose", color: "#c2306b", shape: "classic", mat: "satin",
    over: (id) => metalLine(id, both("M60 88 C66 76 84 74 94 84"), 1.1),
    front: (id, p) => leaf(150, 72, -40, 22) + leaf(160, 80, 20, 20) + leaf(136, 56, -120, 18) + leaf(170, 54, -70, 16) + rose(id, 154, 60, 16, p) + rose(id, 172, 78, 11, p) + rose(id, 136, 48, 10, p),
  },
  {
    id: "pm-phoenix", name: "Phoenix", color: "#f2741f", shape: "flame", mat: "glitter",
    over: (id, p) => `<linearGradient id="${id}fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.alt}" stop-opacity="0.85"/><stop offset="0.55" stop-color="${p.alt}" stop-opacity="0"/></linearGradient><rect x="0" y="20" width="200" height="130" fill="url(#${id}fire)"/>` + [both("M98 88 C96 76 104 66 112 60"), both("M94 86 C88 72 96 56 108 46")].map((d) => `<path d="${d}" fill="none" stroke="${p.pale}" stroke-opacity="0.6" stroke-width="1"/>`).join(""),
    front: (id, p, t, c) => crystal(id, 100, 86, 4.4, c) + [[141, 38], [172, 32], [116, 48], [59, 38], [28, 32], [84, 48]].map(([x, y]) => stone(id, x, y + 4, 1.6, true)).join(""),
  },
  {
    id: "pm-royal", name: "Royal", color: "#7a1430", shape: "crown", mat: "velvet",
    over: (id) => metalLine(id, both(curl(78, 76, 7, 1.4, 1.6, 1)), 1.2) + metalLine(id, "M56 94 C66 74 90 72 100 88 C110 72 134 74 144 94", 1.5),
    front: (id, p, t, c) => [[100, 56], [126, 52], [74, 52], [162, 52], [38, 52]].map(([x, y], i) => crystal(id, x, y, i ? 3.4 : 4.6, c, i === 0)).join("") + [[64, 122], [136, 122]].map(([x, y]) => pearl(id, x, y, 2.4)).join(""),
  },
  {
    id: "pm-satin", name: "Satin bow", color: "#1d1a26", shape: "domino", mat: "satin", eyes: "round",
    back: (id, p) => ribbon(id, 24, 96, -1, p) + ribbon(id, 176, 96, 1, p),
    front: (id, p, t, c) => {
      const bow = (x, s) => `<path d="M${x} 92 C${x + s * 10} 80 ${x + s * 18} 84 ${x + s * 16} 96 C${x + s * 14} 106 ${x + s * 8} 104 ${x} 98Z M${x} 98 C${x - s * 8} 108 ${x - s * 10} 112 ${x - s * 6} 116" fill="url(#${id}b)" stroke="${p.deep}" stroke-opacity="0.5" stroke-width="0.6"/><path d="M${x} 92 C${x + s * 10} 80 ${x + s * 18} 84 ${x + s * 16} 96 C${x + s * 14} 106 ${x + s * 8} 104 ${x} 98Z" fill="url(#${id}sat)"/>`;
      return bow(178, 1) + bow(22, -1) + crystal(id, 178, 95, 2.6, c, false) + crystal(id, 22, 95, 2.6, c, false);
    },
  },
];

/** The party masks, ready for the mask library */
export const PARTY_MASKS = DESIGNS.map((m) => ({
  id: m.id,
  name: m.name,
  cat: "party",
  half: true,
  color: m.color,
  shape: shapeOf(m.shape),
  svg: (p, t, util) => draw(m, p, t, util),
}));
