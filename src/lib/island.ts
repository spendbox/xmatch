/**
 * Your Island: every chat grows little islands, one piece per message. It's worked out from the
 * chat's messages only (nothing extra is saved), the same way on both phones, so you both always
 * see the same islands.
 *
 * - Each message adds a piece; its words pick what ("jollof" a food stall, "football" a pitch).
 * - Pieces level up as you keep talking: a cottage becomes a two-storey house, then flats.
 * - Every 30 pieces a new island rises next to the last one, joined by a bridge.
 */

export type PieceKind = "house" | "palm" | "tree" | "stall" | "bus" | "lamp" | "flowers" | "rocks" | "office" | "pitch" | "stage" | "cafe";

/** What the database sends: how many messages, and the latest ones as [kind, first words] */
export type IslandData = {
  total: number;
  since: string | null;
  items: [string, string][];
  unmasked: boolean;
  names: [string, string] | null;
};

export type Piece = {
  kind: PieceKind;
  level: 1 | 2 | 3;
  x: number;
  y: number;
  scale: number;
  roof: string;
  wall: string;
  from: string;
  label: string;
};

export type IslandOne = { index: number; ox: number; oy: number; size: number; pieces: Piece[] };

/** A small, steady hash: the same text always gives the same number, on every phone */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** What each piece is called, by level */
const NAMES: Record<PieceKind, [string, string, string]> = {
  house: ["a cottage", "a two-storey house", "a block of flats"],
  palm: ["a palm tree", "two palm trees", "a palm grove"],
  tree: ["a tree", "a big tree", "a shady spot"],
  stall: ["a food stall", "a Mama Put", "a busy restaurant"],
  bus: ["a danfo", "a bus stop", "a motor park"],
  lamp: ["a street lamp", "a lamp and bench", "a little square"],
  flowers: ["flowers", "a garden", "a garden with a fountain"],
  rocks: ["some rocks", "a well", "a statue"],
  office: ["an office", "an office block", "a tower"],
  pitch: ["a football pitch", "a pitch with stands", "a stadium"],
  stage: ["a stage", "a stage with lights", "a party"],
  cafe: ["a kiosk", "a café", "a busy café"],
};

// Words that build something special (the first one found wins)
const WORDS: [PieceKind, RegExp][] = [
  ["stall", /\b(jollof|suya|rice|food|eat|eating|hungry|chop|amala|pizza|shawarma|bole|dinner|lunch|breakfast|cook|cooking|kitchen|snack|restaurant|mama put|meat)\b/i],
  ["cafe", /\b(coffee|tea|cafe|café|date|brunch|cake|ice cream|smoothie|drinks?)\b/i],
  ["pitch", /\b(football|match|arsenal|chelsea|united|madrid|barca|goal|fifa|ball|super eagles|league)\b/i],
  ["office", /\b(work|working|office|school|class|exam|meeting|boss|job|study|studying|lecture|deadline)\b/i],
  ["stage", /\b(party|owambe|concert|music|song|songs|dance|dancing|club|dj|afrobeats|wizkid|burna|davido|tems|asake)\b/i],
  ["bus", /\b(danfo|bus|traffic|car|drive|driving|road|okada|uber|bolt|keke|trip|travel|go-slow)\b/i],
  ["palm", /\b(beach|sea|swim|swimming|ocean|island|vacation|holiday|sunny|chill|relax)\b/i],
  ["house", /\b(home|house|room|bed|sleep|sleeping|family|mum|mom|dad|sister|brother)\b/i],
  ["lamp", /\b(night|vibe|vibes|photo|pic|selfie|walk|evening)\b/i],
  ["flowers", /(\blove\b|❤|💕|😍|🥰|\bheart\b|\bmiss you\b|\bcute\b|\bbeautiful\b|\bsweet\b)/i],
];

const DEFAULTS: PieceKind[] = ["tree", "house", "flowers", "palm", "tree", "rocks", "house", "flowers", "cafe", "lamp"];
const ROOFS = ["#6d4ff0", "#e0477e", "#1aa774", "#2f80ed", "#ef6a3a", "#b4532a"];
const WALLS = ["#fff3e0", "#ffe3d6", "#e2f6ec", "#ece6ff", "#fff6c4", "#dcefff"];

/** The piece one message adds, and the word that chose it */
export function pieceFor(kind: string, body: string, salt = ""): { kind: PieceKind; word: string | null } {
  if (kind === "gift") return { kind: "flowers", word: null };
  if (kind === "sticker" || kind === "scribble" || kind === "draw") return { kind: "tree", word: null };
  if (kind === "image" || kind === "video") return { kind: "lamp", word: null };
  if (kind === "game") return { kind: "pitch", word: null };
  for (const [k, re] of WORDS) {
    const m = body.match(re);
    if (m) return { kind: k, word: m[0].toLowerCase() };
  }
  return { kind: DEFAULTS[hash(body + salt) % DEFAULTS.length], word: null };
}

/** A short line about a message: "'jollof' built a food stall" or "a voice note brought a bird" */
export function pieceLine(kind: string, body: string) {
  if (kind === "audio") return "A voice note brought a bird";
  const p = pieceFor(kind, body);
  return p.word ? `"${p.word}" built ${NAMES[p.kind][0]}` : `Your island got ${NAMES[p.kind][0]}`;
}

/** How many pieces fit on one island before the next one rises */
export const PER_ISLAND = 30;
/** How far apart the islands sit */
const STEP = 320;

// Where pieces can stand on an island: points on the grass, roughly the middle first. The
// lighthouse has its own spot.
const CX = 195;
const CY = 470;
const SLOTS: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number; r: number }[] = [];
  for (let row = 0; row < 7; row++) {
    const y = 414 + row * 21;
    for (let col = 0; col < 10; col++) {
      const x = 52 + col * 36 + (row % 2 ? 18 : 0);
      const dx = (x - CX) / 146;
      const dy = (y - CY) / 64;
      if (dx * dx + dy * dy > 0.86) continue;
      if (Math.hypot(x - 302, (y - 444) * 1.6) < 36) continue;
      const d = Math.hypot(x - CX, (y - CY) * 2.2);
      out.push({ x, y, r: d * (0.55 + (hash(`${x},${y}`) % 1000) / 1100) });
    }
  }
  return out.sort((a, b) => a.r - b.r).map(({ x, y }) => ({ x, y }));
})();

export type IslandLayout = {
  islands: IslandOne[];
  /** How wide the whole chain of islands is */
  width: number;
  birds: number;
  boat: boolean;
  lighthouse: boolean;
  /** 0 (clear) to 0.9 (thick fog) */
  fog: number;
  total: number;
  days: number;
  pieceCount: number;
};

/** Where island number i sits (they zig-zag across the sea) */
export function islandOffset(i: number) {
  return { ox: i * STEP, oy: i === 0 ? 0 : i % 2 ? -46 : 18 };
}

/** Lay the islands out from the chat */
export function layoutIsland(d: IslandData): IslandLayout {
  const items = d.items ?? [];
  const voices = items.filter(([k]) => k === "audio").length;
  const built = items.filter(([k]) => k !== "audio" && k !== "system");
  const count = Math.max(1, Math.ceil(built.length / PER_ISLAND));
  const islands: IslandOne[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = built.slice(i * PER_ISLAND, (i + 1) * PER_ISLAND);
    const { ox, oy } = islandOffset(i);
    const pieces = chunk
      .map(([kind, body], j) => {
        const n = i * PER_ISLAND + j;
        const p = pieceFor(kind, body, String(n));
        const h = hash(`${n}:${body}`);
        // Older pieces level up as you keep talking
        const age = built.length - 1 - n;
        const level: 1 | 2 | 3 = age >= 120 ? 3 : age >= 40 ? 2 : 1;
        const slot = SLOTS[j];
        return {
          kind: p.kind,
          level,
          x: slot.x + ((h % 7) - 3),
          y: slot.y + (((h >>> 4) % 5) - 2),
          scale: 0.78 + ((h >>> 8) % 16) / 100,
          roof: ROOFS[(h >>> 12) % ROOFS.length],
          wall: WALLS[(h >>> 16) % WALLS.length],
          from: body,
          label: NAMES[p.kind][level - 1],
        };
      })
      // Back to front, so nearer things sit in front
      .sort((a, b) => a.y - b.y);
    // The newest island grows as it fills; the ones before it are full size
    const size = i < count - 1 ? 1 : 0.5 + 0.5 * Math.min(1, chunk.length / (PER_ISLAND * 0.8));
    islands.push({ index: i, ox, oy, size, pieces });
  }
  const days = d.since ? Math.max(1, Math.ceil((Date.now() - new Date(d.since).getTime()) / 86400000)) : 1;
  return {
    islands,
    width: 390 + (count - 1) * STEP,
    birds: Math.min(6, voices),
    boat: d.total >= 20,
    lighthouse: d.total >= 100,
    fog: d.unmasked ? 0 : Math.max(0.06, 0.9 * (1 - d.total / 150)),
    total: d.total,
    days,
    pieceCount: built.length,
  };
}

/** Day, sunset or night, from the time on this phone */
export function skyNow(date = new Date()): "day" | "sunset" | "night" {
  const h = date.getHours();
  if (h >= 7 && h < 17) return "day";
  if ((h >= 17 && h < 19) || h === 6) return "sunset";
  return "night";
}
