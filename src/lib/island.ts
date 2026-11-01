/**
 * Your Island: every chat grows a little island, one piece per message. It's worked out from the
 * chat's messages only (nothing extra is saved), the same way on both phones, so you both always
 * see the same island.
 */

export type PieceKind = "house" | "palm" | "tree" | "stall" | "bus" | "lamp" | "flowers" | "rocks";

/** What the database sends: how many messages, and the latest ones as [kind, first words] */
export type IslandData = {
  total: number;
  since: string | null;
  items: [string, string][];
  unmasked: boolean;
  names: [string, string] | null;
};

export type Piece = { kind: PieceKind; x: number; y: number; scale: number; color: string; from: string; label: string };

/** A small, steady hash: the same text always gives the same number, on every phone */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const LABELS: Record<PieceKind, string> = {
  house: "a little house",
  palm: "a palm tree",
  tree: "a tree",
  stall: "a food stall",
  bus: "a danfo",
  lamp: "a street lamp",
  flowers: "flowers",
  rocks: "some rocks",
};

// Words that build something special (the first one found wins)
const WORDS: [PieceKind, RegExp][] = [
  ["stall", /\b(jollof|suya|rice|food|eat|eating|hungry|chop|amala|pizza|shawarma|bole|dinner|lunch|breakfast|cook|cooking|kitchen|snack|restaurant|mama put)\b/i],
  ["bus", /\b(danfo|bus|traffic|car|drive|driving|road|okada|uber|bolt|keke|trip|travel|go-slow)\b/i],
  ["palm", /\b(beach|sea|swim|swimming|ocean|island|vacation|holiday|sunny|chill|relax)\b/i],
  ["house", /\b(home|house|room|bed|sleep|sleeping|family|mum|mom|dad|sister|brother)\b/i],
  ["lamp", /\b(music|song|songs|dance|dancing|party|owambe|club|vibe|vibes|concert|night)\b/i],
  ["flowers", /(\blove\b|❤|💕|😍|🥰|\bheart\b|\bmiss you\b|\bcute\b|\bbeautiful\b|\bsweet\b)/i],
];

const DEFAULTS: PieceKind[] = ["tree", "house", "flowers", "palm", "tree", "rocks", "house", "flowers"];
const ROOFS = ["#6d4ff0", "#e0477e", "#1fae7a", "#3b8cf0", "#ef6a3a"];

/** The piece one message adds, and what to say about it ("'jollof' built a food stall") */
export function pieceFor(kind: string, body: string, salt = ""): { kind: PieceKind; label: string; word: string | null } {
  if (kind === "gift") return { kind: "flowers", label: LABELS.flowers, word: null };
  if (kind === "sticker" || kind === "scribble" || kind === "draw") return { kind: "tree", label: LABELS.tree, word: null };
  if (kind === "image" || kind === "video") return { kind: "lamp", label: LABELS.lamp, word: null };
  if (kind === "game") return { kind: "rocks", label: LABELS.rocks, word: null };
  for (const [k, re] of WORDS) {
    const m = body.match(re);
    if (m) return { kind: k, label: LABELS[k], word: m[0].toLowerCase() };
  }
  const k = DEFAULTS[hash(body + salt) % DEFAULTS.length];
  return { kind: k, label: LABELS[k], word: null };
}

/** A short line for a new message: "'jollof' built a food stall" or "a voice note brought a bird" */
export function pieceLine(kind: string, body: string) {
  if (kind === "audio") return "A voice note brought a bird";
  const p = pieceFor(kind, body);
  return p.word ? `"${p.word}" built ${p.label}` : `Your island got ${p.label}`;
}

// Where pieces can stand: points on the grass, the middle first. The lighthouse and the signpost
// have their own spots.
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
      if (Math.hypot(x - 302, (y - 444) * 1.6) < 36) continue; // the lighthouse
      // Middle first, but loosely, so the island fills out naturally instead of in rings
      const d = Math.hypot(x - CX, (y - CY) * 2.2);
      out.push({ x, y, r: d * (0.55 + (hash(`${x},${y}`) % 1000) / 1100) });
    }
  }
  return out.sort((a, b) => a.r - b.r).map(({ x, y }) => ({ x, y }));
})();

export const ISLAND_SLOTS = SLOTS.length;

export type IslandLayout = {
  pieces: Piece[];
  /** How big the island is drawn (it grows as you chat) */
  size: number;
  birds: number;
  boat: boolean;
  lighthouse: boolean;
  /** 0 (clear) to 0.9 (thick fog) */
  fog: number;
  total: number;
  days: number;
};

/** Lay the island out from the chat */
export function layoutIsland(d: IslandData): IslandLayout {
  const items = d.items ?? [];
  const voices = items.filter(([k]) => k === "audio").length;
  const built = items.filter(([k]) => k !== "audio" && k !== "system");
  const shown = built.slice(-SLOTS.length);
  // Each piece's place comes from its position in the chat, so it stays put as new ones arrive
  const offset = built.length - shown.length;
  const pieces = shown
    .map(([kind, body], i) => {
      const n = offset + i;
      const p = pieceFor(kind, body, String(n));
      const h = hash(`${n}:${body}`);
      const slot = SLOTS[i];
      return {
        kind: p.kind,
        x: slot.x + ((h % 7) - 3),
        y: slot.y + (((h >> 4) % 5) - 2),
        scale: 0.74 + ((h >> 8) % 18) / 100,
        color: ROOFS[(h >> 12) % ROOFS.length],
        from: body,
        label: p.label,
      };
    })
    // Back to front, so nearer things sit in front
    .sort((a, b) => a.y - b.y);
  const days = d.since ? Math.max(1, Math.ceil((Date.now() - new Date(d.since).getTime()) / 86400000)) : 1;
  return {
    pieces,
    size: 0.5 + 0.5 * Math.min(1, built.length / (SLOTS.length * 0.75)),
    birds: Math.min(5, voices),
    boat: d.total >= 20,
    lighthouse: d.total >= 100,
    fog: d.unmasked ? 0 : Math.max(0.06, 0.9 * (1 - d.total / 150)),
    total: d.total,
    days,
  };
}

/** Day, sunset or night, from the time on this phone */
export function skyNow(date = new Date()): "day" | "sunset" | "night" {
  const h = date.getHours();
  if (h >= 7 && h < 17) return "day";
  if ((h >= 17 && h < 19) || h === 6) return "sunset";
  return "night";
}
