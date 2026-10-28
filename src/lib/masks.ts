// @ts-nocheck -- generated SVG drawing code: shapes and paths built from numbers and strings
/**
 * Masquerade masks for photos. Each mask is drawn as an SVG from one chosen colour and a metal
 * trim. Every full mask's outline contains the face oval (centre 100,112; radii 48 × 54 in a
 * -26,-44 252×252 drawing), so it fully hides a face. Party masks (half: true) only cover the eyes,
 * brows and nose: their eye holes are at (78,102) and (122,102), and lib/maskPlace fits them.
 */
// The mask library. Each mask has its own outline, eyes and details, all derived from one
// chosen colour and a metal trim. Every outline contains the face oval (centre 100,112;
// radii 48 × 54), so any mask fully hides a face. Drawing area: -26,-44 252×252.
import { PARTY_MASKS } from "./partyMasks";

const F = "M100 58 C132 58 148 78 148 104 C148 138 128 162 100 166 C72 162 52 138 52 104 C52 78 68 58 100 58 Z";
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(200 - Number(x)).toFixed(2)} ${y}`);
const both = (d) => `${d} ${mirror(d)}`;

// --- Colour: everything comes from the chosen colour ---
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(3, Math.min(97, l)) / 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}
function palette(hex) {
  const [h, s, l] = hexToHsl(hex);
  return {
    base: hex,
    light: hslToHex(h, s, l + 15),
    pale: hslToHex(h, s * 0.55, Math.max(l + 32, 88)),
    dark: hslToHex(h, s, l - 15),
    deep: hslToHex(h, s, l - 30),
    line: hslToHex(h, Math.min(s, 60), Math.max(8, l - 42)),
    alt: hslToHex(h + 38, Math.max(s, 55), Math.min(Math.max(l, 45), 62)),
    alt2: hslToHex(h - 38, Math.max(s, 55), Math.min(Math.max(l, 40), 58)),
    jewel: hslToHex(h + 180, 75, 50),
  };
}
const TRIMS = {
  gold: { name: "Gold", hi: "#fff6d6", mid: "#e8b143", lo: "#7a4e00" },
  silver: { name: "Silver", hi: "#ffffff", mid: "#c3c9d4", lo: "#4e5562" },
  rose: { name: "Rose gold", hi: "#fff0ea", mid: "#e4a493", lo: "#7c4033" },
  black: { name: "Black", hi: "#8a8396", mid: "#2b2533", lo: "#060408" },
};

// --- Drawing pieces ---
const gem = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r + 1.6}" fill="url(#metal)" filter="url(#emb)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gem)"/><ellipse cx="${x - r * 0.32}" cy="${y - r * 0.38}" rx="${r * 0.38}" ry="${r * 0.24}" fill="#fff" opacity="0.85" transform="rotate(-30 ${x} ${y})"/>`;
const trimLine = (d, w = 1.8) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="${w + 1}" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 0.8)"/><path d="${d}" fill="none" stroke="url(#metal)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ink = (d, c, w = 2, extra = "") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const star = (x, y, r, fill, extra = "") => `<path d="M${x} ${y - r} L${x + r * 0.26} ${y - r * 0.26} L${x + r} ${y} L${x + r * 0.26} ${y + r * 0.26} L${x} ${y + r} L${x - r * 0.26} ${y + r * 0.26} L${x - r} ${y} L${x - r * 0.26} ${y - r * 0.26}Z" fill="${fill}" ${extra}/>`;
const star5 = (x, y, r, fill, extra = "") => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)} `; } return `<path d="${d}Z" fill="${fill}" stroke-linejoin="round" ${extra}/>`; };
const heart = (x, y, s) => `M${x} ${y + s * 0.9} C${x - s * 1.5} ${y - s * 0.1} ${x - s * 0.9} ${y - s * 1.2} ${x} ${y - s * 0.4} C${x + s * 0.9} ${y - s * 1.2} ${x + s * 1.5} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`;
const glossy = (x, y, rx, ry, rot = -25, o = 0.8) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}" transform="rotate(${rot} ${x} ${y})"/>`;
function feather(bx, by, a, l, w, c1, c2, id) {
  const r = (a * Math.PI) / 180, tx = bx + Math.cos(r) * l, ty = by + Math.sin(r) * l, px = -Math.sin(r) * w, py = Math.cos(r) * w;
  const mx = bx + Math.cos(r) * l * 0.55, my = by + Math.sin(r) * l * 0.55;
  let barbs = "";
  for (let k = 0; k < 16; k++) {
    const t = 0.12 + k * 0.052, cx = bx + Math.cos(r) * l * t, cy = by + Math.sin(r) * l * t, sw = Math.max(0.15, 1 - Math.abs(t - 0.55) * 1.5);
    barbs += `<path d="M${cx} ${cy} q${px * sw * 0.5 + Math.cos(r) * 2} ${py * sw * 0.5 + Math.sin(r) * 2} ${px * sw + Math.cos(r) * 6} ${py * sw + Math.sin(r) * 6} M${cx} ${cy} q${-px * sw * 0.5 + Math.cos(r) * 2} ${-py * sw * 0.5 + Math.sin(r) * 2} ${-px * sw + Math.cos(r) * 6} ${-py * sw + Math.sin(r) * 6}" stroke="#fff" stroke-opacity="0.22" stroke-width="0.45" fill="none"/>`;
  }
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}"><stop offset="0" stop-color="${c2}"/><stop offset="0.6" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <path d="M${bx} ${by} Q${mx + px} ${my + py} ${tx} ${ty} Q${mx - px} ${my - py} ${bx} ${by}Z" fill="url(#${id})"/>${barbs}
    <path d="M${bx} ${by} Q${mx + px * 0.1} ${my + py * 0.1} ${tx} ${ty}" stroke="#fff" stroke-opacity="0.6" stroke-width="0.8" fill="none"/>`;
}
const flower = (x, y, r, edge, mid) => [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - r * 0.55}" rx="${r * 0.46}" ry="${r * 0.66}" fill="url(#petal)" stroke="${edge}" stroke-width="0.5" transform="rotate(${a} ${x} ${y})"/>`).join("") + `<circle cx="${x}" cy="${y}" r="${r * 0.32}" fill="${mid}"/><circle cx="${x - r * 0.1}" cy="${y - r * 0.1}" r="${r * 0.12}" fill="#fff" opacity="0.7"/>`;
const peacockEye = (x, y, rot, s, p) => `<g transform="rotate(${rot} ${x} ${y}) translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})"><ellipse cx="${x}" cy="${y}" rx="13" ry="17" fill="${p.dark}"/><ellipse cx="${x}" cy="${y}" rx="11.5" ry="15.5" fill="${p.base}"/><ellipse cx="${x}" cy="${y + 1}" rx="8.5" ry="11.5" fill="url(#metal)"/><ellipse cx="${x}" cy="${y + 2}" rx="6.5" ry="9" fill="${p.alt}"/><ellipse cx="${x}" cy="${y + 3}" rx="3.4" ry="4.8" fill="${p.deep}"/><ellipse cx="${x - 1.5}" cy="${y}" rx="1.4" ry="2" fill="#fff" opacity="0.7"/></g>`;
const scallops = (c, o, y0 = 58, step = 9, x0 = 40, x1 = 162) => { let s = ""; for (let y = y0; y < 182; y += step) for (let x = x0 + ((y / step) % 2) * 6; x < x1; x += 12) s += `<path d="M${x - 6} ${y} Q${x} ${y + 7} ${x + 6} ${y}" fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width="0.9"/>`; return s; };
const whiskers = (c, o = 0.8, y = 134) => [[-1, 0, 50, -8], [-1, 6, 48, 6], [1, 0, 150, -8], [1, 6, 152, 6]].map(([s, dy, x2, dy2]) => `<path d="M${100 + s * 18} ${y + dy} Q${(100 + s * 18 + x2) / 2} ${y + dy - 3} ${x2} ${y + dy + dy2}" stroke="${c}" stroke-opacity="${o}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`).join("");
const nose = (y, c, w = 7) => `<path d="M${100 - w} ${y} Q100 ${y - w * 0.5} ${100 + w} ${y} Q${100 + w * 0.3} ${y + w * 1.1} 100 ${y + w * 1.25} Q${100 - w * 0.3} ${y + w * 1.1} ${100 - w} ${y}Z" fill="${c}"/>${glossy(100 - w * 0.3, y + 0.8, w * 0.3, w * 0.16, -10, 0.55)}`;
const catMouth = (y, c, w = 1.6) => ink(`M100 ${y} L100 ${y + 6} M100 ${y + 6} C96 ${y + 11} 90 ${y + 11} 86 ${y + 7} M100 ${y + 6} C104 ${y + 11} 110 ${y + 11} 114 ${y + 7}`, c, w);
// Cute eyes: white, a big pupil and two sparkles
const cuteEye = (x, y, r, iris = "#1c1828") => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.12}" fill="#fff"/><ellipse cx="${x}" cy="${y + r * 0.12}" rx="${r * 0.72}" ry="${r * 0.82}" fill="${iris}"/><circle cx="${x - r * 0.28}" cy="${y - r * 0.28}" r="${r * 0.26}" fill="#fff"/><circle cx="${x + r * 0.26}" cy="${y + r * 0.3}" r="${r * 0.12}" fill="#fff"/>`;
const cuteEyes = (y, r, iris, dx = 22) => cuteEye(100 - dx, y, r, iris) + cuteEye(100 + dx, y, r, iris);
const happyEyes = (y, c, w = 3, dx = 22) => ink(`M${100 - dx - 9} ${y + 3} Q${100 - dx} ${y - 8} ${100 - dx + 9} ${y + 3} M${100 + dx - 9} ${y + 3} Q${100 + dx} ${y - 8} ${100 + dx + 9} ${y + 3}`, c, w);
const blush = (y, c, o = 0.5, dx = 30, r = 9) => `<ellipse cx="${100 - dx}" cy="${y}" rx="${r}" ry="${r * 0.65}" fill="${c}" opacity="${o}"/><ellipse cx="${100 + dx}" cy="${y}" rx="${r}" ry="${r * 0.65}" fill="${c}" opacity="${o}"/>`;
// Eye holes (dark), with a metal or soft rim
const ALMOND = both("M61 104 C67 92 86 90 96 101 C88 112 69 114 61 104Z");
const holes = (d, rim = "metal") => `<path d="${d}" fill="url(#hole)"/>` + (rim === "metal" ? trimLine(d, 1.8) : `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1.2"/>`) + `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="0.8" transform="translate(0 -1.2)"/>`;
const smileMouth = (c = "#3a0d16", tongue = "#ff6b8a") => `<path d="M72 134 C80 160 120 160 128 134 C116 140 84 140 72 134Z" fill="${c}"/><path d="M84 148 C92 156 108 156 116 148 C108 145 92 145 84 148Z" fill="${tongue}"/><path d="M76 136 C88 140 112 140 124 136 L123 139 C112 142 88 142 77 139Z" fill="#fff"/>`;

// --- Outlines (each contains the face oval) ---
const OUT = {
  egg: F.replace("M100 58 C132 58 148 78 148 104 C148 138 128 162 100 166 C72 162 52 138 52 104 C52 78 68 58 100 58 Z", "M100 54 C134 54 152 76 152 104 C152 142 130 168 100 172 C70 168 48 142 48 104 C48 76 66 54 100 54 Z"),
  venetian: "M100 50 C130 50 154 64 158 90 C160 110 152 132 140 148 C128 164 112 176 100 178 C88 176 72 164 60 148 C48 132 40 110 42 90 C46 64 70 50 100 50Z",
  round: "M100 50 A62 62 0 1 1 99.9 50Z",
  wide: "M100 52 C140 52 162 74 162 106 C162 144 136 172 100 174 C64 172 38 144 38 106 C38 74 60 52 100 52Z",
  furry: "M100 54 C130 54 150 72 152 98 C154 110 162 116 166 124 C158 126 160 132 168 138 C156 140 154 146 156 152 C146 152 136 168 100 174 C64 168 54 152 44 152 C46 146 44 140 32 138 C40 132 42 126 34 124 C38 116 46 110 48 98 C50 72 70 54 100 54Z",
  skull: "M100 46 C140 46 162 72 160 106 C159 124 152 132 150 142 C148 154 138 158 132 160 L130 176 C118 184 82 184 70 176 L68 160 C62 158 52 154 50 142 C48 132 41 124 40 106 C38 72 60 46 100 46Z",
  robot: "M64 48 L136 48 C152 48 160 56 160 72 L160 150 C160 166 152 176 136 176 L64 176 C48 176 40 166 40 150 L40 72 C40 56 48 48 64 48Z",
  pumpkin: "M100 58 C108 50 128 48 140 56 C160 56 172 80 168 110 C166 142 150 172 128 174 C118 178 108 176 100 172 C92 176 82 178 72 174 C50 172 34 142 32 110 C28 80 40 56 60 56 C72 48 92 50 100 58Z",
  ghost: "M100 40 C140 40 160 70 160 108 L160 172 C152 182 146 170 140 172 C134 184 126 172 120 176 C114 186 106 174 100 178 C94 186 86 174 80 176 C74 184 66 172 60 172 C54 182 46 170 40 172 L40 108 C40 70 60 40 100 40Z",
  heron: "M100 52 C132 52 152 74 152 102 C152 140 128 166 100 172 C72 166 48 140 48 102 C48 74 68 52 100 52Z",
};

const MASKS = [
  // ============ FUN ============
  {
    id: "hearteyes", name: "Heart eyes", cat: "fun", color: "#ffc61a", shape: OUT.round, rim: "cartoon",
    pattern: (p) => blush(130, "#ff6b6b", 0.45, 36, 10),
    eyes: () => [78, 122].map((x) => `<path d="${heart(x, 101, 13)}" fill="url(#red)"/>${glossy(x - 6, 92, 4, 2.4)}`).join(""),
    front: () => smileMouth(),
  },
  {
    id: "shades", name: "Cool shades", cat: "fun", color: "#ffc61a", shape: OUT.round, rim: "cartoon",
    eyes: (p) => `<path d="M48 92 L152 92 C152 92 152 104 146 112 C140 122 116 122 110 110 C106 102 94 102 90 110 C84 122 60 122 54 112 C48 104 48 92 48 92Z" fill="url(#lens)"/>${ink("M48 92 L152 92", "#1c1828", 3)}<path d="M58 96 L76 96 L64 110Z" fill="#fff" opacity="0.35"/><path d="M114 96 L132 96 L120 110Z" fill="#fff" opacity="0.35"/>`,
    front: (p) => ink("M80 142 C92 150 112 148 124 136", p.line, 3.2),
  },
  {
    id: "cheeky", name: "Cheeky", cat: "fun", color: "#ffc61a", shape: OUT.round, rim: "cartoon",
    pattern: (p) => blush(128, "#ff6b6b", 0.4, 36, 9),
    eyes: (p) => ink("M66 104 Q78 94 90 104", p.line, 3.4) + cuteEye(122, 102, 10),
    front: (p) => `<path d="M74 136 C86 150 114 150 126 136" fill="none" stroke="${p.line}" stroke-width="3" stroke-linecap="round"/><path d="M98 144 C98 162 120 166 122 150 C122 146 120 142 116 141 C110 146 104 147 98 144Z" fill="#ff6b8a" stroke="${p.line}" stroke-width="1.6"/>${ink("M110 147 L112 156", "#d94368", 1.4)}`,
  },
  {
    id: "starstruck", name: "Star struck", cat: "fun", color: "#ffc61a", shape: OUT.round, rim: "cartoon",
    eyes: () => [78, 122].map((x) => star5(x, 102, 15, "url(#metal)", 'stroke="#b9831e" stroke-width="1"') + glossy(x - 4, 96, 3.5, 2)).join(""),
    front: () => `<path d="M76 134 C82 162 118 162 124 134 C112 140 88 140 76 134Z" fill="#3a0d16"/><path d="M80 136 C90 140 110 140 120 136 L119 140 C110 143 90 143 81 140Z" fill="#fff"/>`,
  },
  {
    id: "party", name: "Party", cat: "fun", color: "#ff5fa2", shape: OUT.round, rim: "cartoon",
    back: (p) => `<path d="M100 -24 L72 56 L128 56Z" fill="${p.alt}"/>${[0, 1, 2].map((i) => `<path d="M${91 - i * 7} ${2 + i * 18} L${109 + i * 7} ${-6 + i * 18} L${113 + i * 7} ${6 + i * 18} L${87 - i * 7} ${14 + i * 18}Z" fill="${p.pale}" opacity="0.9"/>`).join("")}<circle cx="100" cy="-24" r="8" fill="url(#metal)"/>`,
    pattern: (p) => Array.from({ length: 26 }, (_, i) => { const x = 46 + ((i * 37) % 108), y = 58 + ((i * 53) % 116); return `<rect x="${x}" y="${y}" width="5" height="2.4" rx="1" fill="${[p.alt, p.alt2, "#fff", p.pale][i % 4]}" transform="rotate(${i * 41} ${x} ${y})" opacity="0.9"/>`; }).join(""),
    eyes: (p) => happyEyes(102, p.line, 3.4),
    front: (p) => `<path d="M80 134 C86 152 114 152 120 134 C110 138 90 138 80 134Z" fill="#3a0d16"/><path d="M116 140 L150 132 L150 140 L118 146Z" fill="${p.alt2}"/><path d="M150 128 C164 126 168 142 154 144 C150 144 148 140 152 138" fill="${p.alt}" stroke="${p.line}" stroke-width="1"/>`,
  },
  {
    id: "clown", name: "Clown", cat: "fun", color: "#e5484d", shape: OUT.round, rim: "cartoon", face: () => "url(#ivory)",
    back: () => [[46, 64, "#ff5fa2"], [36, 86, "#ffc61a"], [40, 110, "#4f86f7"], [60, 48, "#7ad34c"], [154, 64, "#ff5fa2"], [164, 86, "#ffc61a"], [160, 110, "#4f86f7"], [140, 48, "#7ad34c"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="15" fill="${c}"/><circle cx="${x - 4}" cy="${y - 5}" r="5" fill="#fff" opacity="0.35"/>`).join(""),
    pattern: () => `<path d="M72 84 L78 96 L84 84Z M116 84 L122 96 L128 84Z M72 120 L78 108 L84 120Z M116 120 L122 108 L128 120Z" fill="#4f86f7"/>`,
    eyes: () => cuteEyes(102, 9, "#1c1828"),
    front: (p) => `<path d="M66 132 C78 168 122 168 134 132 C120 142 80 142 66 132Z" fill="${p.base}"/><path d="M76 138 C86 156 114 156 124 138 C112 144 88 144 76 138Z" fill="#3a0d16"/><circle cx="100" cy="122" r="11" fill="url(#red)"/>${glossy(96, 117, 4, 2.6)}`,
  },
  {
    id: "disco", name: "Disco ball", cat: "fun", color: "#b9c3d6", shape: OUT.round, rim: "metal", face: () => "url(#chrome)",
    pattern: (p) => { let s = ""; for (let y = 40; y < 180; y += 8) for (let x = 36; x < 166; x += 8) { const k = (x * 7 + y * 13) % 9; s += `<rect x="${x + 0.6}" y="${y + 0.6}" width="6.8" height="6.8" fill="${["#ffffff", p.pale, p.light, "#9aa3b5", p.base, "#e9edf3", p.alt, "#ffffff", p.dark][k]}" opacity="0.92"/>`; } return s; },
    eyes: () => holes(ALMOND, "metal"),
    top: () => star(70, 76, 6, "#fff") + star(132, 140, 5, "#fff") + star(140, 72, 3.5, "#fff"),
  },
  {
    id: "unicorn", name: "Unicorn", cat: "fun", color: "#b44cff", shape: OUT.egg, rim: "metal", face: () => "url(#ivory)",
    back: (p) => `${["#ff5fa2", "#ffc61a", "#7ad34c", "#4f86f7", p.base].map((c, i) => `<path d="M${118 + i * 4} ${56 + i * 2} C${150 + i * 6} ${50 + i * 8} ${164 + i * 6} ${80 + i * 12} ${158 + i * 4} ${118 + i * 10} C${152 + i * 2} ${96 + i * 8} ${138 + i * 2} ${78 + i * 6} ${118 + i * 4} ${72 + i * 3}Z" fill="${c}"/>`).join("")}<path d="M100 -22 L88 54 L112 54Z" fill="url(#metal)"/>${[0, 1, 2, 3].map((i) => ink(`M${91 + i * 0.6} ${42 - i * 16} L${109 - i * 1.4} ${34 - i * 16}`, "#7a4e00", 1, 'stroke-opacity="0.5"')).join("")}${pair2("M64 64 L56 34 L82 56Z", "url(#ivory)", "#ffb3cf", "M66 58 L61 42 L76 55Z")}`,
    pattern: () => blush(128, "#ff9ab5", 0.55, 32, 9),
    eyes: (p) => ink("M64 104 Q78 112 92 104 M108 104 Q122 112 136 104", "#1c1828", 2.6) + ink("M66 106 L62 112 M72 109 L70 115 M78 110 L78 116 M134 106 L138 112 M128 109 L130 115 M122 110 L122 116", "#1c1828", 1.4),
    front: () => ink("M92 146 Q100 151 108 146", "#c2577a", 2),
  },
  {
    id: "pirate", name: "Pirate", cat: "fun", color: "#d92f3a", shape: OUT.egg, rim: "cartoon", face: () => "url(#tan)",
    back: () => "",
    pattern: (p) => `<path d="M40 50 L160 50 L160 84 C130 74 70 74 40 84Z" fill="${p.base}"/>${[[60, 64], [84, 58], [110, 60], [136, 64], [72, 74], [124, 74], [98, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff"/>`).join("")}`,
    eyes: () => `<path d="M60 100 C60 88 92 88 92 100 C92 114 60 114 60 100Z" fill="#1c1828"/>${ink("M50 78 L150 126", "#1c1828", 2.4)}${glossy(70, 95, 6, 3, -10, 0.25)}` + cuteEye(122, 103, 9),
    front: (p) => `${ink("M78 144 C90 154 112 154 124 144", "#3a1a0c", 3)}<rect x="104" y="145" width="6" height="7" rx="1.5" fill="url(#metal)"/>${ink("M84 132 C90 126 96 128 100 132 C104 128 110 126 116 132", "#3a1a0c", 3.4)}`,
    top: (p) => `<path d="M148 72 C160 66 170 70 172 78 C164 76 160 80 162 86 C156 80 150 80 148 72Z" fill="${p.base}"/>`,
  },
  {
    id: "ninja", name: "Ninja", cat: "fun", color: "#d92f3a", shape: OUT.egg, rim: "soft", face: () => "#1d1a26",
    back: (p) => `<path d="M150 82 C168 78 182 84 192 96 C178 92 168 92 156 96Z" fill="${p.base}"/><path d="M150 90 C166 96 176 108 180 124 C170 112 160 106 150 102Z" fill="${p.dark}"/>`,
    pattern: (p) => `<path d="M40 88 C70 82 130 82 160 88 L160 120 C130 114 70 114 40 120Z" fill="#c9926a"/><path d="M40 70 C70 64 130 64 160 70 L160 82 C130 76 70 76 40 82Z" fill="${p.base}"/>${scallops("#fff", 0.04, 126, 8)}`,
    eyes: () => `<path d="M64 102 C70 96 86 96 94 104 C86 106 72 108 64 102Z M136 102 C130 96 114 96 106 104 C114 106 128 108 136 102Z" fill="#1c1828"/>${ink("M62 94 L92 100 M138 94 L108 100", "#1c1828", 3)}`,
    front: () => "",
  },
  {
    id: "hero", name: "Superhero", cat: "fun", color: "#d92f3a", shape: OUT.egg, rim: "metal",
    pattern: (p) => `<path d="M100 54 L100 172" stroke="${p.dark}" stroke-width="2" opacity="0.4"/>`,
    eyes: () => `<path d="${both("M60 100 C66 88 90 88 96 104 C88 110 66 112 60 100Z")}" fill="url(#lensw)" stroke="#1c1828" stroke-width="3" stroke-linejoin="round"/>`,
    front: (p) => `<circle cx="100" cy="76" r="10" fill="url(#metal)" filter="url(#emb)"/>${star5(100, 76.5, 7.5, p.base)}`,
  },
  {
    id: "robot", name: "Robot", cat: "fun", color: "#3df2ff", shape: OUT.robot, rim: "metal", face: () => "url(#chrome)",
    back: (p) => `${trimLine("M100 48 L100 24", 2.4)}<circle cx="100" cy="20" r="6" fill="${p.base}" filter="url(#glow)"/><rect x="28" y="96" width="14" height="30" rx="5" fill="url(#chrome)"/><rect x="158" y="96" width="14" height="30" rx="5" fill="url(#chrome)"/>`,
    pattern: () => [[52, 58], [148, 58], [52, 166], [148, 166]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="url(#metal)"/>${ink(`M${x - 2} ${y} L${x + 2} ${y}`, "#000", 0.8, 'stroke-opacity="0.4"')}`).join("") + ink("M44 84 L156 84", "#000", 1, 'stroke-opacity="0.15"'),
    eyes: (p) => `<rect x="60" y="92" width="80" height="26" rx="13" fill="#0b0f1e"/><g filter="url(#glow)"><circle cx="80" cy="105" r="7" fill="${p.base}"/><circle cx="120" cy="105" r="7" fill="${p.base}"/></g>${glossy(77, 101, 2.4, 1.4, 0, 0.9)}${glossy(117, 101, 2.4, 1.4, 0, 0.9)}`,
    front: (p) => `<rect x="70" y="138" width="60" height="18" rx="6" fill="#0b0f1e"/><g filter="url(#glow)">${[78, 88, 98, 108, 118].map((x, i) => `<rect x="${x}" y="${144 - (i % 2) * 2}" width="5" height="${6 + (i % 2) * 4}" rx="1.5" fill="${p.base}"/>`).join("")}</g>`,
  },
  {
    id: "donut", name: "Donut", cat: "fun", color: "#ff7eb6", shape: OUT.round, rim: "none", face: () => "url(#dough)",
    pattern: (p) => `<path d="M100 56 C126 54 152 70 156 96 C160 112 150 116 152 128 C150 140 140 138 136 150 C128 166 112 160 100 166 C86 160 72 168 62 152 C58 140 48 142 46 128 C44 116 40 110 44 96 C48 70 74 58 100 56Z" fill="url(#face)"/>${Array.from({ length: 24 }, (_, i) => { const x = 54 + ((i * 41) % 92), y = 62 + ((i * 29) % 92); return (x > 64 && x < 136 && y > 90 && y < 150) ? "" : `<rect x="${x}" y="${y}" width="7" height="2.4" rx="1.2" fill="${["#fff", "#4f86f7", "#ffc61a", "#7ad34c", "#b44cff"][i % 5]}" transform="rotate(${i * 47} ${x} ${y})"/>`; }).join("")}`,
    eyes: () => cuteEyes(104, 9),
    front: () => ink("M86 134 Q100 146 114 134", "#3a0d16", 3) + blush(126, "#ff3f7a", 0.35, 30, 8),
  },
  {
    id: "melon", name: "Watermelon", cat: "fun", color: "#ff4a5a", shape: OUT.round, rim: "none", face: () => "#2f8a3e",
    pattern: (p) => `<circle cx="100" cy="112" r="56" fill="#cdeec4"/><circle cx="100" cy="112" r="52" fill="url(#face)"/>${[[72, 76], [128, 76], [62, 140], [138, 140], [100, 160], [84, 70], [116, 70], [56, 112], [144, 112]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="4" fill="#1c1828" transform="rotate(${(x - 100) * 0.8} ${x} ${y})"/>`).join("")}${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2; return ink(`M${100 + Math.cos(a) * 57} ${112 + Math.sin(a) * 57} L${100 + Math.cos(a) * 61} ${112 + Math.sin(a) * 61}`, "#1f5f2a", 2); }).join("")}`,
    eyes: () => happyEyes(104, "#1c1828", 3.2),
    front: () => `<path d="M80 130 C86 148 114 148 120 130 C110 134 90 134 80 130Z" fill="#3a0d16"/><path d="M90 140 C96 146 104 146 110 140 C104 138 96 138 90 140Z" fill="#ff8aa5"/>`,
  },
  {
    id: "pumpkin", name: "Pumpkin", cat: "fun", color: "#f2741f", shape: OUT.pumpkin, rim: "cartoon",
    back: () => `<path d="M96 60 C94 46 98 36 108 30 C112 36 108 46 106 60Z" fill="#3c6b2a"/><path d="M108 34 C122 26 132 34 128 44 C124 38 116 36 108 40Z" fill="#5c9a3a"/>`,
    pattern: (p) => [[-38, 0.7], [-20, 0.85], [0, 1], [20, 0.85], [38, 0.7]].map(([dx, k]) => `<path d="M${100 + dx} 56 C${100 + dx * 1.7} 90 ${100 + dx * 1.7} 140 ${100 + dx} 176" fill="none" stroke="${p.dark}" stroke-opacity="${0.5 * k}" stroke-width="2.4"/>`).join(""),
    eyes: () => `<g filter="url(#glow)"><path d="M64 110 L80 86 L94 110Z M106 110 L120 86 L136 110Z M92 126 L100 114 L108 126Z" fill="#ffd36b"/></g>`,
    front: () => `<g filter="url(#glow)"><path d="M64 134 L76 144 L84 136 L92 146 L100 138 L108 146 L116 136 L124 144 L136 134 C128 160 72 160 64 134Z" fill="#ffd36b"/></g><path d="M64 134 L76 144 L84 136 L92 146 L100 138 L108 146 L116 136 L124 144 L136 134 C128 160 72 160 64 134Z" fill="#ff9a1f" opacity="0.35"/>`,
  },
  {
    id: "ghost", name: "Ghost", cat: "fun", color: "#f2f4ff", shape: OUT.ghost, rim: "cartoon", face: () => "url(#face)",
    eyes: () => `<ellipse cx="80" cy="104" rx="9" ry="13" fill="#1c1828"/><ellipse cx="120" cy="104" rx="9" ry="13" fill="#1c1828"/>${glossy(77, 98, 3, 2)}${glossy(117, 98, 3, 2)}`,
    front: () => `<ellipse cx="100" cy="138" rx="7" ry="9" fill="#1c1828"/>` + blush(124, "#ff9ab5", 0.5, 32, 8),
  },
  {
    id: "smiley", name: "Smiley", cat: "fun", color: "#ffc61a", shape: OUT.round, rim: "cartoon",
    eyes: () => `<ellipse cx="80" cy="100" rx="7" ry="12" fill="#1c1828"/><ellipse cx="120" cy="100" rx="7" ry="12" fill="#1c1828"/>${glossy(78, 94, 2.4, 1.6)}${glossy(118, 94, 2.4, 1.6)}`,
    front: () => `<path d="M66 128 C76 160 124 160 134 128" stroke="#1c1828" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },

  // ============ ANIMALS ============
  {
    id: "fox", name: "Fox", cat: "animals", color: "#f2741f", shape: OUT.furry, rim: "cartoon",
    back: (p) => pair2("M60 84 L46 8 L98 60Z", "url(#face)", "#3a1a0c", "M64 74 L54 26 L88 60Z", p),
    pattern: (p) => `<path d="M30 118 C60 106 84 118 100 136 C116 118 140 106 170 118 L170 182 L30 182Z" fill="url(#cream)"/><path d="M100 54 L88 82 L100 102 L112 82Z" fill="${p.dark}"/>`,
    eyes: () => cuteEyes(102, 9.5, "#3a1a0c", 23) + ink("M64 98 L72 94 M136 98 L128 94", "#1c1828", 2),
    front: () => nose(128, "#1c1828", 7) + catMouth(138, "#3a1a0c"),
  },
  {
    id: "owl", name: "Owl", cat: "animals", color: "#8a5a3c", shape: OUT.egg, rim: "cartoon",
    back: (p) => pair2("M58 74 L46 26 L82 58Z", "url(#face)", p.line, "", p),
    pattern: (p) => `${scallops(p.pale, 0.4, 126, 7)}<circle cx="78" cy="102" r="24" fill="url(#cream)"/><circle cx="122" cy="102" r="24" fill="url(#cream)"/>${Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; return ink(`M${78 + Math.cos(a) * 16} ${102 + Math.sin(a) * 16} L${78 + Math.cos(a) * 23} ${102 + Math.sin(a) * 23} M${122 + Math.cos(a) * 16} ${102 + Math.sin(a) * 16} L${122 + Math.cos(a) * 23} ${102 + Math.sin(a) * 23}`, p.dark, 0.9, 'stroke-opacity="0.45"'); }).join("")}`,
    eyes: () => cuteEye(78, 102, 13, "#1c1828").replace('fill="#fff"', 'fill="#ffc61a"') + cuteEye(122, 102, 13, "#1c1828").replace('fill="#fff"', 'fill="#ffc61a"'),
    front: () => `<path d="M93 118 L107 118 L100 134Z" fill="url(#metal)" filter="url(#emb)"/>`,
  },
  {
    id: "wolf", name: "Wolf", cat: "animals", color: "#7d8597", shape: OUT.furry, rim: "cartoon",
    back: (p) => pair2("M58 88 L48 10 L96 60Z", "url(#face)", p.line, "M63 78 L56 30 L86 60Z", p),
    pattern: (p) => `<path d="M30 120 C60 108 84 118 100 134 C116 118 140 108 170 120 L170 182 L30 182Z" fill="url(#cream)"/><path d="M100 54 L90 82 L100 108 L110 82Z" fill="${p.dark}"/>${ink("M58 92 L76 88 M142 92 L124 88", p.deep, 3)}`,
    eyes: () => `<path d="${both("M64 104 C70 94 86 94 94 102 C86 110 70 112 64 104Z")}" fill="#ffc61a"/><ellipse cx="80" cy="103" rx="3.6" ry="6" fill="#1c1828"/><ellipse cx="120" cy="103" rx="3.6" ry="6" fill="#1c1828"/>${ink(both("M64 104 C70 94 86 94 94 102"), "#1c1828", 1.6)}`,
    front: (p) => nose(128, "#1c1828", 8) + catMouth(138, "#1c1828") + whiskers(p.deep, 0.5),
  },
  {
    id: "tiger", name: "Tiger", cat: "animals", color: "#f2741f", shape: OUT.furry, rim: "cartoon",
    back: (p) => pair2("M60 72 C48 52 62 42 76 56Z", "url(#face)", "#1c1828", "M62 68 C56 58 62 52 70 58Z", p),
    pattern: (p) => `<path d="M30 122 C60 110 84 120 100 134 C116 120 140 110 170 122 L170 182 L30 182Z" fill="url(#cream)"/>${["M100 54 L95 72 L100 80 L105 72Z", "M86 56 L89 74 L94 63Z", "M114 56 L111 74 L106 63Z", "M44 94 L66 100 L46 106Z", "M42 112 L62 114 L44 120Z", "M52 80 L70 88 L54 90Z", "M38 132 L56 130 L42 138Z"].map((d) => `<path d="${both(d)}" fill="#1c1828"/>`).join("")}`,
    eyes: () => cuteEyes(102, 9.5, "#5c7a1a", 23),
    front: (p) => nose(126, "#e86a8a", 8) + catMouth(136, "#1c1828") + whiskers("#1c1828", 0.6),
  },
  {
    id: "lion", name: "Lion", cat: "animals", color: "#e5a23a", shape: OUT.egg, rim: "cartoon",
    back: (p) => Array.from({ length: 26 }, (_, i) => { const a = (i / 26) * Math.PI * 2; const x = 100 + Math.cos(a) * 58, y = 112 + Math.sin(a) * 64; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="12" ry="20" fill="${i % 2 ? p.dark : p.deep}" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join("") + pair2("M60 66 C50 50 64 44 74 56Z", "url(#face)", "", "", p),
    pattern: (p) => `<path d="M60 124 C72 116 88 120 100 130 C112 120 128 116 140 124 C136 152 118 168 100 168 C82 168 64 152 60 124Z" fill="url(#cream)"/>`,
    eyes: () => cuteEyes(102, 9, "#7a4e00", 22),
    front: (p) => nose(124, p.line, 9) + catMouth(136, p.line) + whiskers(p.line, 0.5),
  },
  {
    id: "panda", name: "Panda", cat: "animals", color: "#1c1828", shape: OUT.wide, rim: "cartoon", face: () => "url(#ivory)",
    back: (p) => `<circle cx="56" cy="58" r="18" fill="${p.base}"/><circle cx="144" cy="58" r="18" fill="${p.base}"/>`,
    pattern: (p) => `<ellipse cx="78" cy="106" rx="17" ry="14" fill="${p.base}" transform="rotate(-28 78 106)"/><ellipse cx="122" cy="106" rx="17" ry="14" fill="${p.base}" transform="rotate(28 122 106)"/>` + blush(134, "#ff9ab5", 0.35, 38, 8),
    eyes: () => cuteEyes(104, 8, "#1c1828", 22),
    front: (p) => nose(130, p.base, 8) + catMouth(140, p.base),
  },
  {
    id: "cat", name: "Black cat", cat: "animals", color: "#25222e", shape: OUT.furry, rim: "cartoon",
    back: (p) => pair2("M58 88 L50 16 L96 60Z", "url(#face)", "#ff9ab5", "M63 78 L57 32 L86 60Z", p),
    pattern: () => "",
    eyes: () => `<path d="${both("M62 104 C66 90 88 90 94 102 C88 114 68 116 62 104Z")}" fill="#9be15d"/><ellipse cx="79" cy="103" rx="2.6" ry="9" fill="#1c1828"/><ellipse cx="121" cy="103" rx="2.6" ry="9" fill="#1c1828"/>${glossy(73, 98, 3, 1.8)}${glossy(115, 98, 3, 1.8)}`,
    front: () => nose(126, "#ff9ab5", 6) + catMouth(135, "#ff9ab5") + whiskers("#fff", 0.8),
  },
  {
    id: "bunny", name: "Bunny", cat: "animals", color: "#ff9ab5", shape: OUT.egg, rim: "cartoon", face: () => "url(#ivory)",
    back: (p) => [0, 1].map((s) => { const k = s ? mirror : (x) => x; return `<path d="${k("M80 66 C62 28 62 -18 78 -26 C94 -18 94 28 92 60Z")}" fill="url(#ivory)" stroke="${p.line}" stroke-opacity="0.3"/><path d="${k("M81 56 C70 28 70 -6 78 -14 C87 -6 88 28 87 54Z")}" fill="${p.base}"/>`; }).join(""),
    pattern: (p) => blush(130, p.base, 0.5, 32, 10),
    eyes: () => cuteEyes(104, 9, "#3a1a2a", 22),
    front: (p) => nose(126, p.base, 6) + catMouth(134, p.dark) + `<rect x="95" y="141" width="4.6" height="6" rx="1" fill="#fff" stroke="${p.dark}" stroke-width="0.6"/><rect x="100.4" y="141" width="4.6" height="6" rx="1" fill="#fff" stroke="${p.dark}" stroke-width="0.6"/>` + whiskers(p.dark, 0.5),
  },
  {
    id: "frog", name: "Frog", cat: "animals", color: "#5cc24a", shape: OUT.wide, rim: "cartoon",
    back: (p) => `<circle cx="70" cy="62" r="22" fill="url(#face)"/><circle cx="130" cy="62" r="22" fill="url(#face)"/>`,
    pattern: (p) => `<path d="M40 130 C70 120 130 120 160 130 L160 182 L40 182Z" fill="${p.pale}"/>` + blush(128, "#ff6b8a", 0.4, 40, 8),
    eyes: () => cuteEye(70, 62, 14) + cuteEye(130, 62, 14),
    front: (p) => ink("M58 118 C76 138 124 138 142 118", p.line, 3.2) + `<circle cx="92" cy="104" r="2" fill="${p.line}"/><circle cx="108" cy="104" r="2" fill="${p.line}"/>`,
  },
  {
    id: "penguin", name: "Penguin", cat: "animals", color: "#1d2b4a", shape: OUT.egg, rim: "cartoon",
    pattern: () => `<path d="M100 92 C88 72 60 78 58 104 C56 136 76 166 100 168 C124 166 144 136 142 104 C140 78 112 72 100 92Z" fill="url(#ivory)"/>` + blush(130, "#ff9ab5", 0.45, 30, 8),
    eyes: () => cuteEyes(106, 8, "#1c1828", 20),
    front: () => `<path d="M88 122 C94 116 106 116 112 122 C108 130 92 130 88 122Z" fill="#ff9a1f"/><path d="M90 124 C96 128 104 128 110 124" stroke="#c2580c" stroke-width="1" fill="none"/>`,
  },
  {
    id: "teddy", name: "Teddy bear", cat: "animals", color: "#a8703f", shape: OUT.wide, rim: "cartoon",
    back: (p) => `<circle cx="52" cy="60" r="18" fill="url(#face)"/><circle cx="148" cy="60" r="18" fill="url(#face)"/><circle cx="52" cy="60" r="9" fill="${p.pale}"/><circle cx="148" cy="60" r="9" fill="${p.pale}"/>`,
    pattern: (p) => `<ellipse cx="100" cy="138" rx="28" ry="22" fill="${p.pale}"/>` + blush(128, "#ff6b8a", 0.35, 38, 8),
    eyes: () => cuteEyes(104, 8, "#1c1828", 24),
    front: (p) => nose(128, "#3a1a0c", 9) + catMouth(140, "#3a1a0c"),
  },
  {
    id: "monkey", name: "Monkey", cat: "animals", color: "#7a4a2a", shape: OUT.egg, rim: "cartoon",
    back: (p) => `<circle cx="42" cy="110" r="16" fill="url(#face)"/><circle cx="158" cy="110" r="16" fill="url(#face)"/><circle cx="42" cy="110" r="8" fill="#f2c9a0"/><circle cx="158" cy="110" r="8" fill="#f2c9a0"/>`,
    pattern: () => `<path d="M100 98 C92 76 60 76 60 100 C60 112 68 118 76 120 C60 128 62 162 100 166 C138 162 140 128 124 120 C132 118 140 112 140 100 C140 76 108 76 100 98Z" fill="#f2c9a0"/>`,
    eyes: () => cuteEyes(102, 8.5, "#1c1828", 20),
    front: () => `<circle cx="95" cy="128" r="2.2" fill="#3a1a0c"/><circle cx="105" cy="128" r="2.2" fill="#3a1a0c"/>` + ink("M80 142 C92 154 108 154 120 142", "#3a1a0c", 2.6),
  },
  {
    id: "pig", name: "Piggy", cat: "animals", color: "#ff9ab5", shape: OUT.wide, rim: "cartoon",
    back: (p) => pair2("M56 70 L48 40 L80 58Z", "url(#face)", p.dark, "M58 64 L54 48 L72 58Z", p),
    pattern: (p) => blush(132, p.dark, 0.35, 40, 9),
    eyes: () => cuteEyes(102, 7.5, "#1c1828", 24),
    front: (p) => `<ellipse cx="100" cy="132" rx="17" ry="12" fill="${p.light}" stroke="${p.dark}" stroke-width="1.6"/><ellipse cx="94" cy="132" rx="3" ry="4.4" fill="${p.deep}"/><ellipse cx="106" cy="132" rx="3" ry="4.4" fill="${p.deep}"/>` + ink("M90 152 Q100 158 110 152", p.deep, 2),
  },
  {
    id: "raven", name: "Raven", cat: "animals", color: "#1d1a2b", shape: OUT.egg, rim: "metal",
    back: (p) => Array.from({ length: 9 }, (_, i) => feather(100, 70, -160 + i * 17.5, 72 - Math.abs(i - 4) * 4, 7, p.light, p.deep, `fr${i}`)).join(""),
    pattern: (p) => scallops(p.light, 0.35, 56, 7),
    eyes: () => holes(ALMOND, "metal"),
    front: () => `<path d="M86 112 C94 108 106 108 114 112 L100 158Z" fill="url(#metal)" filter="url(#emb)"/>${ink("M100 112 L100 156", "#000", 0.8, 'stroke-opacity="0.3"')}`,
  },
  {
    id: "hawk", name: "Hawk", cat: "animals", color: "#8a5530", shape: OUT.egg, rim: "metal",
    back: (p) => Array.from({ length: 7 }, (_, i) => feather(100, 72, -150 + i * 20, 62 - Math.abs(i - 3) * 5, 8, p.base, p.deep, `fh${i}`)).join(""),
    pattern: (p) => `<path d="${both("M52 96 C68 82 90 82 98 92 L98 98 C88 92 70 92 54 104Z")}" fill="${p.pale}"/>${scallops(p.pale, 0.3, 124, 7)}`,
    eyes: () => `<path d="${both("M64 104 C70 94 86 94 94 102 C86 110 70 112 64 104Z")}" fill="#ffc61a"/><circle cx="80" cy="103" r="4.4" fill="#1c1828"/><circle cx="120" cy="103" r="4.4" fill="#1c1828"/>${ink(both("M64 104 C70 94 86 94 94 102"), "#1c1828", 1.8)}`,
    front: () => `<path d="M88 112 C96 108 104 108 112 112 C114 126 108 140 98 148 C102 136 100 126 88 112Z" fill="url(#metal)" filter="url(#emb)"/>`,
  },
  {
    id: "dragon", name: "Dragon", cat: "animals", color: "#1f9d6b", shape: OUT.egg, rim: "metal",
    back: (p) => `<path d="M64 72 C48 52 48 28 60 8 C64 30 72 48 82 60Z" fill="url(#metal)"/><path d="${mirror("M64 72 C48 52 48 28 60 8 C64 30 72 48 82 60Z")}" fill="url(#metal)"/>${[0, 1, 2, 3, 4].map((i) => { const x = 42 + i * 2, y = 92 + i * 14; return `<path d="${both(`M${x + 8} ${y} L${x - 8} ${y + 6} L${x + 8} ${y + 10}Z`)}" fill="${p.deep}"/>`; }).join("")}`,
    pattern: (p) => { let s = ""; for (let y = 52; y < 182; y += 8) for (let x = 40 + ((y / 8) % 2) * 5; x < 162; x += 10) s += `<path d="M${x - 5} ${y} Q${x} ${y + 8} ${x + 5} ${y} Q${x} ${y + 3} ${x - 5} ${y}Z" fill="${(x + y) % 3 ? p.dark : p.light}" opacity="0.5"/>`; return s + ink(both("M56 94 C70 84 86 86 98 96"), p.deep, 3); },
    eyes: () => `<path d="${both("M62 102 C70 96 88 98 96 106 C86 112 70 112 62 102Z")}" fill="#ffd36b"/><ellipse cx="80" cy="104" rx="2.2" ry="6" fill="#1c1828"/><ellipse cx="120" cy="104" rx="2.2" ry="6" fill="#1c1828"/>${trimLine(both("M62 102 C70 96 88 98 96 106 C86 112 70 112 62 102Z"), 1.2)}`,
    front: () => `<ellipse cx="93" cy="132" rx="2.8" ry="1.8" fill="#1c1828"/><ellipse cx="107" cy="132" rx="2.8" ry="1.8" fill="#1c1828"/>${ink("M74 148 C88 156 112 156 126 148", "#1c1828", 1.8)}<path d="M84 151 L87 159 L90 152Z M116 151 L113 159 L110 152Z" fill="url(#ivory)"/>`,
  },
  {
    id: "moth", name: "Moth", cat: "animals", color: "#a89a86", shape: OUT.egg, rim: "metal",
    back: () => [0, 1].map((s) => { const k = s ? mirror : (x) => x; return `${trimLine(k("M98 70 C90 44 80 28 64 18"), 1.4)}${Array.from({ length: 8 }, (_, i) => { const x = 98 - i * 4.4, y = 70 - i * 6.6; return trimLine(k(`M${x} ${y} L${x - 7} ${y - 2}`), 0.8); }).join("")}`; }).join(""),
    pattern: (p) => `${scallops(p.pale, 0.25, 56, 6)}${[72, 128].map((x) => `<circle cx="${x}" cy="138" r="10" fill="${p.deep}"/><circle cx="${x}" cy="138" r="6" fill="url(#metal)"/><circle cx="${x}" cy="138" r="3" fill="${p.deep}"/>`).join("")}<path d="M100 54 L100 176" stroke="${p.deep}" stroke-width="5"/>`,
    eyes: () => holes(ALMOND, "metal"),
    front: () => { const up = "M100 100 C84 64 46 60 42 84 C40 104 70 114 100 106Z"; return [up, mirror(up)].map((d) => `<path d="${d}" fill="url(#wing)" opacity="0.9"/>${trimLine(d.replace("Z", ""), 1)}`).join(""); },
  },
  {
    id: "heron", name: "Heron", cat: "animals", color: "#8a97ad", shape: OUT.heron, rim: "metal", face: () => "url(#ivory)",
    back: () => `<path d="M104 60 C126 40 160 32 194 36 C160 40 136 52 112 68Z" fill="#1c1828"/><path d="M106 68 C130 54 158 50 188 56 C158 58 134 64 114 74Z" fill="#1c1828" opacity="0.85"/>`,
    pattern: (p) => `<path d="M40 56 C66 76 88 92 100 100 C112 92 134 76 160 56 L160 40 L40 40Z" fill="${p.base}"/>${ink(both("M56 96 C70 92 86 96 96 104"), "#1c1828", 3)}${scallops(p.base, 0.35, 128, 7)}`,
    eyes: () => holes(ALMOND, "metal"),
    front: () => `<path d="M92 112 C96 110 104 110 108 112 L100 176Z" fill="url(#metal)" filter="url(#emb)"/>`,
  },

  // ============ PARTY (eyes and nose only): see lib/partyMasks ============
  ...PARTY_MASKS,

  // ============ CLASSIC MASQUERADE ============
  {
    id: "venetian", name: "Venetian", cat: "classic", color: "#e8b143", shape: OUT.venetian, rim: "metal",
    back: (p) => [[-98, 98, 10, "alt"], [-82, 106, 11, "base"], [-66, 102, 11, "alt2"], [-50, 94, 10, "alt"], [-34, 78, 9, "base"]].map(([a, l, w, c], i) => feather(134, 70, a, l, w, p[c], p.deep, `fv${i}`)).join(""),
    pattern: () => ["M100 62 C90 68 90 80 100 86 C110 80 110 68 100 62Z", both("M58 90 C66 76 84 74 94 84"), both("M54 120 C60 136 74 142 84 136 C80 128 72 126 68 132"), "M80 154 C92 162 108 162 120 154", "M100 122 L100 142", both("M70 70 C78 64 88 64 94 66")].map((d) => trimLine(d, 1.7)).join(""),
    eyes: () => holes(ALMOND, "metal"),
    front: () => gem(100, 74, 4.4) + gem(134, 70, 5.6) + gem(60, 122, 2.2) + gem(140, 122, 2.2),
  },
  {
    id: "lace", name: "Black lace", cat: "classic", color: "#1d1a26", shape: OUT.venetian, rim: "metal",
    pattern: () => { let s = ""; for (let y = 50; y < 182; y += 11) for (let x = 40 + ((y / 11) % 2) * 5.5; x < 162; x += 11) s += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="url(#metal)" stroke-opacity="0.5" stroke-width="0.8"/><path d="M${x - 4} ${y} L${x + 4} ${y} M${x} ${y - 4} L${x} ${y + 4}" stroke="url(#metal)" stroke-opacity="0.3" stroke-width="0.5"/>`; return s + trimLine("M56 94 C66 72 90 70 100 86 C110 70 134 72 144 94", 2); },
    eyes: () => holes(ALMOND, "metal"),
    front: () => Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * Math.PI * 2; return `<circle cx="${100 + Math.cos(a) * 55}" cy="${114 + Math.sin(a) * 62}" r="2.8" fill="url(#metal)" filter="url(#emb)"/>`; }).join("") + gem(100, 60, 5),
  },
  {
    id: "sun", name: "Sun", cat: "classic", color: "#ffb21f", shape: OUT.egg, rim: "metal",
    back: (p) => Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, w = 0.07, R = i % 2 ? 76 : 92; const q = (ang, r) => `${(100 + Math.cos(ang) * r).toFixed(2)} ${(112 + Math.sin(ang) * r).toFixed(2)}`; return `<path d="M${q(a - w, 52)} L${q(a, R)} L${q(a + w, 52)}Z" fill="${i % 2 ? p.light : "url(#metal)"}" stroke="${p.deep}" stroke-width="0.6"/>`; }).join(""),
    pattern: (p) => `<circle cx="100" cy="112" r="44" fill="none" stroke="url(#metal)" stroke-width="1.4" stroke-dasharray="2 3"/>${blush(132, p.alt2, 0.35, 28, 8)}${trimLine("M84 150 C94 157 106 157 116 150", 1.8)}`,
    eyes: () => holes(ALMOND, "metal"),
    front: () => gem(100, 72, 5),
  },
  {
    id: "moon", name: "Moonlight", cat: "classic", color: "#253a8f", shape: OUT.venetian, rim: "metal",
    back: () => `<path d="M152 -14 A32 32 0 1 0 184 34 A26 26 0 1 1 152 -14Z" fill="url(#metal)" filter="url(#emb)"/>` + star(58, 10, 7, "url(#metal)") + star(80, -6, 4, "url(#metal)") + star(36, 32, 3.5, "url(#metal)"),
    pattern: (p) => [[68, 74, 4], [130, 68, 3.4], [58, 140, 3], [142, 136, 4], [100, 160, 3.2], [86, 62, 2.4], [118, 92, 2], [78, 126, 1.8], [124, 118, 2.2]].map(([x, y, r]) => star(x, y, r, "url(#metal)")).join("") + `<circle cx="62" cy="60" r="22" fill="${p.alt}" opacity="0.18"/>`,
    eyes: () => holes(ALMOND, "metal"),
  },
  {
    id: "flowers", name: "Flower crown", cat: "classic", color: "#ff7eb6", shape: OUT.egg, rim: "metal", face: () => "url(#ivory)",
    back: () => ink("M52 82 C36 60 48 40 66 50 M148 82 C164 60 152 40 134 50", "#2f7a4a", 5),
    pattern: () => blush(130, "#ff9ab5", 0.45, 28, 9) + trimLine("M90 150 C96 154 104 154 110 150", 1.4),
    eyes: () => holes(ALMOND, "metal"),
    front: (p) => trimLine("M56 78 C66 58 88 50 100 50 C112 50 134 58 144 78", 2.4) + [[54, 82, 10], [72, 60, 12], [100, 50, 14], [128, 60, 12], [146, 82, 10]].map(([x, y, r]) => flower(x, y, r, p.dark, "url(#metal)")).join("") + `<ellipse cx="86" cy="54" rx="6.5" ry="3" fill="#2f7a4a" transform="rotate(-30 86 54)"/><ellipse cx="114" cy="54" rx="6.5" ry="3" fill="#2f7a4a" transform="rotate(30 114 54)"/>`,
  },
  {
    id: "butterfly", name: "Butterfly", cat: "classic", color: "#b44cff", shape: OUT.egg, rim: "metal",
    back: () => trimLine(both("M98 80 C94 60 84 48 72 42"), 1.6) + gem(72, 42, 2.6) + gem(128, 42, 2.6),
    pattern: (p) => { let s = ""; for (let y = 130; y < 182; y += 7) for (let x = 44 + ((y / 7) % 2) * 3.5; x < 158; x += 7) s += `<circle cx="${x}" cy="${y}" r="1.9" fill="url(#metal)"/>`; return s; },
    eyes: () => holes(ALMOND, "metal"),
    front: (p) => { const up = "M100 102 C82 56 38 50 34 82 C32 112 70 122 100 110Z", low = "M100 110 C74 120 52 138 60 156 C70 168 96 142 100 118Z"; return [up, low, mirror(up), mirror(low)].map((d) => `<path d="${d}" fill="url(#wing)"/>${trimLine(d.replace("Z", ""), 1.3)}`).join("") + [[56, 78, 5.5], [144, 78, 5.5], [68, 144, 3.6], [132, 144, 3.6], [44, 96, 3], [156, 96, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.pale}" opacity="0.9"/>`).join("") + `<ellipse cx="100" cy="112" rx="3.6" ry="25" fill="url(#metal)" filter="url(#emb)"/>`; },
    top: () => holes(ALMOND, "metal"),
  },
  {
    id: "peacock", name: "Peacock", cat: "classic", color: "#0f8a8a", shape: OUT.venetian, rim: "metal",
    back: (p) => [-156, -128, -100, -80, -52, -24].map((a) => { const r = (a * Math.PI) / 180, x = 100 + Math.cos(r) * 76, y = 66 + Math.sin(r) * 70; return trimLine(`M100 66 L${x.toFixed(1)} ${y.toFixed(1)}`, 1.2) + peacockEye(x, y, a + 90, 1, p); }).join(""),
    pattern: (p) => scallops("url(#metal)", 0.5, 54, 9),
    eyes: () => holes(ALMOND, "metal"),
    front: (p) => peacockEye(100, 76, 0, 0.62, p),
  },
  {
    id: "crystal", name: "Crystal", cat: "classic", color: "#4f86f7", shape: OUT.venetian, rim: "metal",
    pattern: (p) => { const pts = []; for (let j = 0; j < 10; j++) { const row = []; for (let i = 0; i < 9; i++) row.push([36 + i * 16 + ((j * 7 + i * 3) % 5) - 2, 44 + j * 16 + ((i * 5 + j * 3) % 5) - 2]); pts.push(row); } const cols = [p.pale, p.light, p.base, p.dark, "#ffffff", p.light, p.deep, p.base]; let s = ""; for (let j = 0; j < 9; j++) for (let i = 0; i < 8; i++) { const [a, b, c, d] = [pts[j][i], pts[j][i + 1], pts[j + 1][i], pts[j + 1][i + 1]].map(([x, y]) => `${x} ${y}`); s += `<path d="M${a} L${b} L${c}Z" fill="${cols[(i + j * 2) % 8]}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.5"/><path d="M${b} L${d} L${c}Z" fill="${cols[(i * 3 + j + 1) % 8]}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.5"/>`; } return s; },
    eyes: () => holes(ALMOND, "metal"),
    top: () => star(100, 64, 9, "#ffffff") + star(132, 86, 4, "#ffffff") + star(68, 142, 3, "#ffffff"),
  },
  {
    id: "harlequin", name: "Harlequin", cat: "classic", color: "#d92f3a", shape: OUT.egg, rim: "metal",
    back: () => `<path d="M60 78 L36 2 L86 60Z" fill="url(#face)"/><path d="M84 64 L100 -14 L116 64Z" fill="#1c1828"/><path d="${mirror("M60 78 L36 2 L86 60Z")}" fill="url(#face)"/>` + trimLine(both("M60 78 L36 2 L86 60"), 1.4) + trimLine("M84 64 L100 -14 L116 64", 1.4) + gem(36, 2, 5) + gem(100, -14, 5) + gem(164, 2, 5),
    pattern: (p) => { let s = ""; let k = 0; for (let y = 44; y < 188; y += 18) { k++; for (let x = 36 + (k % 2) * 7; x < 168; x += 14) { const c = (Math.round(x / 7) + k) % 3; s += `<path d="M${x} ${y - 9} L${x + 7} ${y} L${x} ${y + 9} L${x - 7} ${y}Z" fill="${c === 0 ? p.base : c === 1 ? "#1c1828" : "#fbf6ee"}"/><path d="M${x} ${y - 9} L${x + 7} ${y} L${x} ${y + 9} L${x - 7} ${y}Z" fill="none" stroke="url(#metal)" stroke-width="0.6"/>`; } } return s; },
    eyes: () => holes(ALMOND, "metal"),
  },
  {
    id: "bauta", name: "Bauta", cat: "classic", color: "#e8b143", shape: "M100 50 C132 50 152 72 152 102 C152 118 148 130 146 138 L132 186 L68 186 L54 138 C52 130 48 118 48 102 C48 72 68 50 100 50Z", rim: "metal",
    pattern: () => [both("M58 84 C68 72 86 70 96 78"), "M100 92 L100 132 L94 138", both("M58 122 C68 130 80 132 88 130"), "M74 176 L126 176"].map((d) => trimLine(d, 1.4)).join(""),
    eyes: () => holes(ALMOND, "metal"),
    front: () => gem(100, 70, 4),
  },
  {
    id: "comet", name: "Comet", cat: "classic", color: "#5b3fd9", shape: OUT.venetian, rim: "metal",
    back: (p) => `<path d="M118 64 C140 38 170 14 204 -14 C180 18 158 44 134 74Z" fill="url(#wing)" opacity="0.9"/><path d="M110 60 C128 30 152 6 178 -20 C160 12 142 38 124 64Z" fill="url(#metal)" opacity="0.7"/><path d="M128 70 C156 54 180 44 206 34 C184 50 162 62 138 80Z" fill="${p.alt}" opacity="0.6"/>`,
    pattern: () => [[62, 70, 2], [140, 100, 2.4], [66, 152, 2], [134, 156, 2.6], [86, 140, 1.4], [118, 130, 1.6], [56, 120, 1.8]].map(([x, y, r]) => star(x, y, r * 1.6, "url(#metal)")).join("") + trimLine(both("M58 90 C68 78 86 80 96 88"), 1.6),
    eyes: () => holes(ALMOND, "metal"),
    front: () => star(100, 70, 12, "url(#metal)") + gem(100, 70, 3.2),
  },

  // ============ WORLD & THEATRE ============
  {
    id: "kitsune", name: "Kitsune", cat: "world", color: "#d92f3a", shape: OUT.furry, rim: "metal", face: () => "url(#ivory)",
    back: (p) => pair2("M60 84 L48 6 L96 60Z", "url(#ivory)", p.base, "M64 74 L54 24 L88 60Z", p),
    pattern: (p) => `<path d="M100 58 C94 68 94 80 100 94 C106 80 106 68 100 58Z" fill="${p.base}"/>${ink("M90 64 C86 72 88 82 92 86 M110 64 C114 72 112 82 108 86", p.base, 2)}${ink(both("M58 102 C66 90 84 90 96 98"), p.base, 4)}${[0, 1, 2].map((i) => ink(both(`M${48 + i * 3} ${124 + i * 8} L${70 + i * 2} ${126 + i * 7}`), p.base, 2.8)).join("")}`,
    eyes: () => holes(both("M64 106 C70 96 86 94 96 100 C86 110 72 112 64 106Z"), "soft"),
    front: (p) => `<path d="M95 128 Q100 125 105 128 L100 134Z" fill="#1c1828"/>${ink("M86 150 C94 157 106 157 114 150", p.base, 2.4)}`,
  },
  {
    id: "oni", name: "Oni", cat: "world", color: "#c8242c", shape: OUT.wide, rim: "metal",
    back: () => `<path d="M70 68 C58 48 56 26 68 2 C72 26 80 44 88 58Z" fill="url(#ivory)"/>${trimLine("M70 68 C58 48 56 26 68 2 C72 26 80 44 88 58", 1.2)}<path d="${mirror("M70 68 C58 48 56 26 68 2 C72 26 80 44 88 58Z")}" fill="url(#ivory)"/>${trimLine(mirror("M70 68 C58 48 56 26 68 2 C72 26 80 44 88 58"), 1.2)}`,
    pattern: (p) => `<path d="${both("M52 92 C66 78 86 82 98 96 C86 90 70 88 54 100Z")}" fill="${p.deep}"/><path d="M84 122 C92 116 108 116 116 122 C112 130 88 130 84 122Z" fill="${p.deep}"/>${ink(both("M62 110 C56 120 56 130 62 138"), p.deep, 2)}`,
    eyes: () => holes(both("M62 100 Q78 100 96 108 Q80 116 64 106Z"), "metal"),
    front: () => `<path d="M68 142 C82 164 118 164 132 142 C118 150 82 150 68 142Z" fill="#1c0a0e"/><path d="M78 144 L83 158 L88 146Z M122 144 L117 158 L112 146Z" fill="url(#ivory)"/>${ink("M90 148 L110 148", "#f4eee4", 2)}`,
  },
  {
    id: "calavera", name: "Sugar skull", cat: "world", color: "#e5484d", shape: OUT.skull, rim: "soft", face: () => "url(#ivory)",
    pattern: (p) => `${flower(100, 66, 11, p.dark, "url(#metal)")}${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = (i / 10) * Math.PI * 2; return `<circle cx="${78 + Math.cos(a) * 21}" cy="${104 + Math.sin(a) * 19}" r="3" fill="${i % 2 ? p.base : p.alt}"/><circle cx="${122 + Math.cos(a) * 21}" cy="${104 + Math.sin(a) * 19}" r="3" fill="${i % 2 ? p.alt : p.base}"/>`; }).join("")}${ink(both("M52 136 C56 126 66 126 68 136 C68 144 58 146 56 138"), p.alt2, 1.8)}`,
    eyes: () => `<path d="${both("M62 104 C62 88 94 88 94 106 C92 120 64 120 62 104Z")}" fill="url(#hole)"/>`,
    front: () => `<path d="M100 132 C96 122 88 126 93 134 L100 142 L107 134 C112 126 104 122 100 132Z" fill="#1c1828"/>${ink("M72 158 L128 158", "#1c1828", 1.6)}${[76, 84, 92, 100, 108, 116, 124].map((x) => ink(`M${x} 153 L${x} 163`, "#1c1828", 1.3)).join("")}`,
  },
  {
    id: "luchador", name: "Luchador", cat: "world", color: "#1f6fe5", shape: OUT.egg, rim: "metal",
    pattern: (p) => `<path d="${both("M50 98 C54 78 78 72 98 90 C86 88 78 96 80 104 C70 102 60 108 54 116Z")}" fill="${p.alt}"/><path d="M92 54 L100 82 L108 54Z" fill="url(#metal)"/><path d="M54 140 C72 134 88 140 100 150 C112 140 128 134 146 140 L146 182 L54 182Z" fill="${p.alt}"/><path d="M84 146 C94 156 106 156 116 146 C106 150 94 150 84 146Z" fill="${p.deep}"/>`,
    eyes: () => holes(both("M64 104 Q78 90 96 102 Q82 112 64 104Z"), "metal"),
    front: () => trimLine(both("M50 98 C54 78 78 72 98 90"), 1.4) + [0, 1, 2, 3].map((i) => ink(`M92 ${156 + i * 4} L108 ${158 + i * 4} M106 ${156 + i * 4} L94 ${158 + i * 4}`, "url(#metal)", 1)).join(""),
  },
  {
    id: "ankara", name: "Ankara", cat: "world", color: "#f2741f", shape: OUT.egg, rim: "metal",
    back: () => trimLine("M46 82 C46 62 70 50 100 50 C130 50 154 62 154 82", 8),
    pattern: (p) => [[72, 152], [128, 152], [100, 64], [46, 108], [154, 108]].map(([x, y], i) => [16, 12, 8, 4].map((r, j) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${[p.alt, "url(#metal)", p.deep, p.pale, p.alt2][(i + j) % 5]}"/>`).join("")).join("") + `<path d="M40 126 Q52 117 64 126 T88 126 T112 126 T136 126 T160 126" fill="none" stroke="${p.deep}" stroke-width="2.6"/><path d="M40 132 Q52 123 64 132 T88 132 T112 132 T136 132 T160 132" fill="none" stroke="url(#metal)" stroke-width="1.2"/>`,
    eyes: () => holes(ALMOND, "metal"),
    front: () => [50, 63, 77, 91, 109, 123, 137, 150].map((x) => { const y = 82 - Math.sin(((x - 46) / 108) * Math.PI) * 26; return `<g transform="rotate(${(x - 100) * 0.5} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="5" ry="7" fill="url(#shell)" filter="url(#emb)"/><path d="M${x} ${y - 5} C${x - 1.6} ${y - 2} ${x - 1.6} ${y + 2} ${x} ${y + 5}" stroke="#7a5a3a" stroke-width="1.2" fill="none"/></g>`; }).join(""),
  },
  {
    id: "comedy", name: "Comedy", cat: "world", color: "#e8b143", shape: OUT.venetian, rim: "metal",
    pattern: (p) => ink(both("M60 86 C70 72 88 74 96 84"), p.deep, 2.4) + blush(126, p.alt2, 0.4, 32, 9),
    eyes: () => holes(both("M62 106 Q78 90 96 104 Q78 100 62 106Z"), "metal"),
    front: () => `<path d="M68 132 C82 170 118 170 132 132 C118 142 82 142 68 132Z" fill="url(#hole)"/>${trimLine("M68 132 C82 170 118 170 132 132 C118 142 82 142 68 132", 1.6)}`,
  },
  {
    id: "tragedy", name: "Tragedy", cat: "world", color: "#6d7a99", shape: OUT.venetian, rim: "metal",
    pattern: (p) => ink(both("M60 92 C70 82 86 82 96 76"), p.deep, 2.4) + ink("M78 112 C77 122 80 128 78 132", "#bfe3ff", 2.4),
    eyes: () => holes(both("M62 100 Q78 112 96 102 Q78 114 62 100Z"), "metal"),
    front: () => `<path d="M70 160 C82 132 118 132 130 160 C118 150 82 150 70 160Z" fill="url(#hole)"/>${trimLine("M70 160 C82 132 118 132 130 160 C118 150 82 150 70 160", 1.6)}`,
  },
  {
    id: "pierrot", name: "Pierrot", cat: "world", color: "#1c1828", shape: OUT.egg, rim: "soft", face: () => "url(#ivory)",
    back: (p) => `<path d="M46 102 C42 58 68 38 100 38 C132 38 158 58 154 102 C142 70 122 62 100 62 C78 62 58 70 46 102Z" fill="${p.base}"/><circle cx="100" cy="34" r="6" fill="url(#metal)"/>`,
    pattern: (p) => ink(both("M66 90 C74 84 86 84 92 90"), p.base, 1.6) + `<path d="M120 114 C116 120 116 126 120 130 C124 126 124 120 120 114Z" fill="${p.base}"/>`,
    eyes: () => holes(both("M66 104 Q80 96 94 104 Q80 108 66 104Z"), "soft"),
    front: () => `<path d="M92 148 C94 144 98 144 100 147 C102 144 106 144 108 148 C104 154 96 154 92 148Z" fill="#c2122a"/>`,
  },

  // ============ EDGY & ICONIC ============
  {
    id: "blank", name: "Blank", cat: "edgy", color: "#f3f2ee", shape: OUT.egg, rim: "soft",
    pattern: (p) => ink(both("M60 94 C72 84 90 85 98 93"), p.deep, 3, 'stroke-opacity="0.18"') + `<path d="M100 96 C96 112 93 124 95 130 C98 134 102 134 105 130" fill="none" stroke="${p.deep}" stroke-opacity="0.28" stroke-width="1.6"/><path d="M104 98 C107 112 109 122 105 130" fill="#fff" opacity="0.35"/>${ink("M84 150 C94 154 106 154 116 150", p.deep, 1.6, 'stroke-opacity="0.26"')}`,
    eyes: () => holes(both("M68 104 Q80 97 94 104 Q80 109 68 104Z"), "soft"),
  },
  {
    id: "rogue", name: "Rogue", cat: "edgy", color: "#1c1828", shape: OUT.egg, rim: "soft", face: () => "url(#ivory)",
    pattern: () => blush(128, "#f08c8c", 0.55, 32, 10),
    eyes: () => holes(both("M66 105 Q80 95 95 105 Q80 101 66 105Z"), "soft"),
    front: (p) => `<path d="${both("M58 92 C68 78 86 80 96 88 C86 84 70 84 60 96Z")}" fill="${p.base}"/><path d="${both("M100 126 C90 120 78 120 68 128 C62 134 56 130 58 124 C52 132 58 144 70 140 C80 136 90 132 100 134Z")}" fill="${p.base}"/>${ink("M72 142 C86 158 114 158 128 142", p.base, 2.2)}<path d="M97 156 L100 174 L103 156Z" fill="${p.base}"/>${ink("M100 98 C98 112 97 118 99 122", "#c9b9a6", 1.2)}`,
  },
  {
    id: "plague", name: "Plague doctor", cat: "edgy", color: "#2a2230", shape: OUT.egg, rim: "metal",
    back: (p) => `<rect x="64" y="0" width="72" height="54" rx="6" fill="${p.deep}"/><rect x="64" y="36" width="72" height="8" fill="url(#metal)"/><ellipse cx="100" cy="56" rx="70" ry="10" fill="${p.dark}"/>${trimLine("M30 56 C60 63 140 63 170 56", 1.2)}`,
    pattern: () => ink("M58 76 C80 70 120 70 142 76", "url(#metal)", 1, 'stroke-dasharray="2 3"'),
    eyes: () => `<circle cx="80" cy="102" r="12" fill="url(#hole)"/><circle cx="120" cy="102" r="12" fill="url(#hole)"/>`,
    front: () => `<path d="M84 114 C112 110 152 128 186 168 C152 162 116 154 90 146Z" fill="url(#face)"/>${trimLine("M84 114 C112 110 152 128 186 168 C152 162 116 154 90 146", 1.6)}${ink("M96 124 C124 126 152 142 174 162", "url(#metal)", 1, 'stroke-dasharray="3 3"')}`,
    top: () => `<circle cx="80" cy="102" r="13.5" fill="none" stroke="url(#metal)" stroke-width="3.4" filter="url(#emb)"/><circle cx="120" cy="102" r="13.5" fill="none" stroke="url(#metal)" stroke-width="3.4" filter="url(#emb)"/>${ink("M93 100 L107 100", "url(#metal)", 2.4)}${glossy(76, 97, 4, 2.4, -20, 0.4)}${glossy(116, 97, 4, 2.4, -20, 0.4)}`,
  },
  {
    id: "skull", name: "Skull", cat: "edgy", color: "#ece4d4", shape: OUT.skull, rim: "soft",
    pattern: (p) => `<path d="M48 112 C56 124 70 128 80 126 C70 132 60 140 54 142Z" fill="${p.dark}" opacity="0.35"/><path d="${mirror("M48 112 C56 124 70 128 80 126 C70 132 60 140 54 142Z")}" fill="${p.dark}" opacity="0.35"/>${ink("M112 50 C108 60 114 66 108 76 L112 82", p.deep, 1.1, 'stroke-opacity="0.45"')}${ink("M70 150 C80 154 120 154 130 150", p.deep, 1, 'stroke-opacity="0.35"')}`,
    eyes: () => `<path d="${both("M58 102 C58 84 96 82 96 104 C96 122 62 124 58 102Z")}" fill="url(#hole)"/><path d="${both("M58 102 C58 84 96 82 96 104")}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2.4"/>`,
    front: (p) => `<path d="M100 122 C96 130 90 138 94 142 C97 144 100 140 100 140 C100 140 103 144 106 142 C110 138 104 130 100 122Z" fill="url(#hole)"/><path d="M72 156 C84 152 116 152 128 156 L126 172 C114 176 86 176 74 172Z" fill="${p.deep}"/>${[80, 88, 96, 104, 112, 120].map((x, i) => `<rect x="${x - 3.4}" y="${154 + (i === 0 || i === 5 ? 1 : 0)}" width="6.8" height="${i === 0 || i === 5 ? 12 : 14}" rx="2" fill="url(#ivory)"/>`).join("")}${ink("M74 164 L126 164", p.deep, 1)}`,
  },
  {
    id: "cyber", name: "Cyber visor", cat: "edgy", color: "#3df2ff", shape: OUT.egg, rim: "metal", face: () => "url(#chrome)",
    back: () => `<circle cx="44" cy="110" r="11" fill="url(#chrome)"/><circle cx="156" cy="110" r="11" fill="url(#chrome)"/>${trimLine("M100 54 L100 30", 2.4)}<circle cx="100" cy="28" r="3.5" fill="url(#gem)"/>`,
    pattern: (p) => `<path d="M42 90 C70 82 130 82 158 90 L156 120 C130 128 70 128 44 120Z" fill="url(#glass)"/>${ink("M54 98 L146 98", p.base, 1.4)}${ink("M60 104 L124 104", p.light, 0.9, 'stroke-opacity="0.6"')}${[70, 86, 102, 118, 134].map((x) => ink(`M${x} 144 L${x} 162`, "#000", 2.2, 'stroke-opacity="0.25"')).join("")}`,
    eyes: () => "",
    front: (p) => trimLine("M42 90 C70 82 130 82 158 90 L156 120 C130 128 70 128 44 120 Z", 1.8) + `<g filter="url(#glow)">${ink("M54 98 L146 98", p.base, 1.2)}</g>`,
  },
  {
    id: "neon", name: "Neon", cat: "edgy", color: "#ff3fa4", shape: OUT.venetian, rim: "none", face: () => "#0e0820",
    back: (p) => `<g filter="url(#glow)">${star(100, 30, 9, p.alt)}</g>`,
    pattern: (p) => `<g filter="url(#glow)" fill="none" stroke-linecap="round">${ink("M66 70 L100 90 L134 70", p.base, 2)}${ink("M56 124 L78 144 L100 132 L122 144 L144 124", p.alt, 2)}${ink("M100 142 L100 164", p.base, 2)}</g>`,
    eyes: (p) => `<path d="${ALMOND}" fill="#05030c"/><g filter="url(#glow)"><path d="${ALMOND}" fill="none" stroke="${p.alt}" stroke-width="2.2"/></g>`,
    front: (p) => `<g filter="url(#glow)"><path d="${OUT.venetian}" fill="none" stroke="${p.base}" stroke-width="3"/></g>`,
  },
  {
    id: "alien", name: "Alien", cat: "edgy", color: "#6fd34c", shape: "M100 46 C142 46 162 76 158 108 C154 140 124 174 100 176 C76 174 46 140 42 108 C38 76 58 46 100 46Z", rim: "metal",
    back: () => trimLine(both("M86 50 C80 30 74 20 66 14"), 1.4) + gem(66, 14, 3.4) + gem(134, 14, 3.4),
    pattern: (p) => scallops(p.deep, 0.15),
    eyes: () => `<path d="${both("M52 96 C56 80 88 84 96 108 C88 122 56 116 52 96Z")}" fill="url(#lens)"/>${glossy(66, 94, 7, 3.6, -25, 0.4)}${glossy(134, 94, 7, 3.6, 25, 0.4)}`,
    front: (p) => ink("M94 144 C98 146 102 146 106 144", p.deep, 1.6),
  },
];
MASKS.forEach((m) => { m.color = m.color || "#e8b143"; });

// Ears and other pairs: one side, then the mirrored side
function pair2(d, fill, innerFill, inner, p) {
  const one = (k) => `<path d="${k(d)}" fill="${fill}"/>` + (inner ? `<path d="${k(inner)}" fill="${innerFill}"/>` : "") + `<path d="${k(d).replace(/Z$/, "")}" fill="none" stroke="${p ? p.line : "#1c1828"}" stroke-opacity="0.55" stroke-width="1.6" stroke-linejoin="round"/>`;
  return one((x) => x) + one(mirror);
}

const CATS = [["all", "All"], ["party", "Party"], ["fun", "Fun"], ["animals", "Animals"], ["classic", "Classic"], ["world", "World"], ["edgy", "Edgy"]];

function maskSvg(m, colorHex, trimId) {
  const p = palette(colorHex || m.color);
  const t = TRIMS[trimId] || TRIMS.gold;
  // Party masks draw themselves (lib/partyMasks)
  if (m.svg) return m.svg(p, t, { hexToHsl, hslToHex });
  const shape = m.shape || OUT.egg;
  const jh = hexToHsl(p.jewel)[0];
  const defs = `
    <radialGradient id="face" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="${p.light}"/><stop offset="0.45" stop-color="${p.base}"/><stop offset="0.85" stop-color="${p.dark}"/><stop offset="1" stop-color="${p.deep}"/></radialGradient>
    <radialGradient id="ivory" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#f4eee4"/><stop offset="0.85" stop-color="#dcd1c0"/><stop offset="1" stop-color="#b9ab96"/></radialGradient>
    <radialGradient id="cream" cx="0.5" cy="0.2" r="0.9"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1e4d0"/></radialGradient>
    <radialGradient id="tan" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="#f3c99c"/><stop offset="0.6" stop-color="#d9a06a"/><stop offset="1" stop-color="#9a6436"/></radialGradient>
    <radialGradient id="dough" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#f7cf8c"/><stop offset="0.7" stop-color="#d99a4a"/><stop offset="1" stop-color="#9a5e22"/></radialGradient>
    <radialGradient id="red" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ff8a8a"/><stop offset="0.6" stop-color="#e5242c"/><stop offset="1" stop-color="#8a0c14"/></radialGradient>
    <linearGradient id="lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3448"/><stop offset="0.5" stop-color="#0b0910"/><stop offset="1" stop-color="#1c1828"/></linearGradient>
    <linearGradient id="lensw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe0f2"/></linearGradient>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#c9ced8"/><stop offset="0.5" stop-color="#6c7383"/><stop offset="0.65" stop-color="#e9edf3"/><stop offset="1" stop-color="#7d8597"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2240"/><stop offset="0.5" stop-color="${p.deep}"/><stop offset="1" stop-color="#05060c"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.hi}"/><stop offset="0.3" stop-color="${t.mid}"/><stop offset="0.5" stop-color="${t.lo}"/><stop offset="0.7" stop-color="${t.mid}"/><stop offset="1" stop-color="${t.hi}"/></linearGradient>
    <radialGradient id="gem" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff"/><stop offset="0.25" stop-color="${hslToHex(jh, 80, 62)}"/><stop offset="0.75" stop-color="${p.jewel}"/><stop offset="1" stop-color="${hslToHex(jh, 80, 22)}"/></radialGradient>
    <radialGradient id="shine" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="under" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient>
    <radialGradient id="hole" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#2a1d4a"/><stop offset="1" stop-color="#05030c"/></radialGradient>
    <linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="0.5" stop-color="${p.base}"/><stop offset="1" stop-color="${p.alt}"/></linearGradient>
    <radialGradient id="petal" cx="0.5" cy="0.8" r="0.9"><stop offset="0" stop-color="${p.pale}"/><stop offset="1" stop-color="${p.alt}"/></radialGradient>
    <radialGradient id="shell" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6d6bd"/></radialGradient>
    <clipPath id="fc"><path d="${shape}"/></clipPath>
    <filter id="ds" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/></filter>
    <filter id="emb" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0.8" stdDeviation="0.5" flood-color="#000" flood-opacity="0.55"/></filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const face = m.face ? m.face(p) : "url(#face)";
  const rim = m.rim === "none" ? "" : m.rim === "soft" ? `<path d="${shape}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="1.3"/>` : m.rim === "cartoon" ? `<path d="${shape}" fill="none" stroke="${p.line}" stroke-opacity="0.75" stroke-width="2.4" stroke-linejoin="round"/>` : trimLine(shape, 2.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -44 252 252" width="1512" height="1512"><defs>${defs}</defs>
    <g filter="url(#ds)">
      ${m.back ? m.back(p) : ""}
      <path d="${shape}" fill="${face}"/>
      <g clip-path="url(#fc)">
        ${m.pattern ? m.pattern(p) : ""}
        <path d="${shape}" fill="url(#under)"/>
        <path d="${shape}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="12" filter="url(#soft)"/>
        <ellipse cx="80" cy="76" rx="32" ry="17" fill="url(#shine)" transform="rotate(-22 80 76)"/>
      </g>
      ${rim}
      ${m.front ? m.front(p) : ""}
      ${m.eyes ? m.eyes(p) : holes(ALMOND)}
      ${m.top ? m.top(p) : ""}
    </g>
  </svg>`;
}

export type MaskDesign = (typeof MASKS)[number];

/** Party masks cover only the eyes, brows and nose (placed from those points, not the whole face) */
export const isHalfMask = (id: string) => !!MASKS.find((x) => x.id === id)?.half;
/** A mask's outline, in the drawing's own units */
export const maskShape = (id: string): string => (MASKS.find((x) => x.id === id)?.shape ?? OUT.egg) as string;
export type TrimId = keyof typeof TRIMS;
export { MASKS, CATS, TRIMS, maskSvg, palette };

/** The mask as an image URL, for <img> or drawing on a canvas */
export function maskUrl(id: string, color?: string | null, trim: string = "gold") {
  const m = MASKS.find((x) => x.id === id) ?? MASKS[0];
  // Round long decimals so the drawing is identical wherever it's made (server or phone)
  const svg = maskSvg(m, color, trim).replace(/-?\d+\.\d{3,}/g, (n: string) => String(+Number(n).toFixed(2)));
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
