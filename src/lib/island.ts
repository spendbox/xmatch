/**
 * Your Island: every chat grows one island town, one building per message. It's worked out from
 * the chat's messages only (nothing extra is saved), the same way on both phones, so you both
 * always see the same island.
 *
 * - The island is a grid: roads every few tiles, and plots between them. Each piece gets its own
 *   plot, so nothing ever overlaps.
 * - The land keeps getting bigger as you chat (there's no limit).
 * - Pieces level up as you keep talking: a cottage becomes a two-storey house, then flats.
 * - Every 60 messages a pedestrian bridge goes up over a road.
 */

export type PieceKind = "house" | "palm" | "tree" | "stall" | "bus" | "lamp" | "flowers" | "rocks" | "office" | "pitch" | "stage" | "cafe" | "gym" | "school" | "clinic" | "market" | "cinema" | "pool";

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
  /** Which look it gets (each kind has a few) */
  variant: number;
  gx: number;
  gy: number;
  scale: number;
  roof: string;
  wall: string;
  from: string;
  label: string;
};

export type Road = { gx: number; gy: number; axis: "x" | "y" | "both" };
export type Vehicle = Road & { color: string; type: "car" | "bus" };
export type Spot = { gx: number; gy: number };

export type IslandLayout = {
  /** Land tiles, as "gx,gy" */
  land: Set<string>;
  roads: Road[];
  pieces: Piece[];
  /** Empty plots with a little bush */
  shrubs: Spot[];
  footbridges: Road[];
  cars: Vehicle[];
  lighthouse: Spot | null;
  signpost: Spot | null;
  /** How far the land reaches from the middle, in tiles */
  radius: number;
  birds: number;
  boat: boolean;
  /** 0 (clear) to 0.9 (thick fog) */
  fog: number;
  total: number;
  days: number;
  pieceCount: number;
};

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
  stall: ["a food stall", "a diner", "a busy restaurant"],
  bus: ["a bus stop", "a filling station", "a bus terminal"],
  lamp: ["a street lamp", "a lamp and bench", "a little square"],
  flowers: ["flowers", "a garden", "a garden with a fountain"],
  rocks: ["some rocks", "a well", "a statue"],
  office: ["an office", "an office block", "a tower"],
  pitch: ["a football pitch", "a pitch with stands", "a stadium"],
  stage: ["a stage", "a stage with lights", "a party"],
  cafe: ["a kiosk", "a café", "a busy café"],
  gym: ["a gym", "a sports centre", "a big gym"],
  school: ["a school", "a college", "a university"],
  clinic: ["a clinic", "a hospital", "a big hospital"],
  market: ["market stalls", "a supermarket", "a mall"],
  cinema: ["a little cinema", "a cinema", "a big cinema"],
  pool: ["a pool", "a pool with loungers", "a water park"],
};

// Words that build something special (the first one found wins)
const WORDS: [PieceKind, RegExp][] = [
  ["stall", /\b(jollof|suya|rice|food|eat|eating|hungry|chop|amala|pizza|shawarma|bole|dinner|lunch|breakfast|cook|cooking|kitchen|snack|restaurant|mama put|meat|chicken|burger)\b/i],
  ["cafe", /\b(coffee|tea|cafe|café|date|brunch|cake|ice cream|smoothie|drinks?|juice)\b/i],
  ["pitch", /\b(football|match|arsenal|chelsea|united|madrid|barca|goal|fifa|ball|super eagles|league|basketball|nba)\b/i],
  ["school", /\b(school|class|exam|exams|lecture|study|studying|uni|university|campus|assignment|teacher)\b/i],
  ["office", /\b(work|working|office|meeting|boss|job|deadline|business|client|salary)\b/i],
  ["gym", /\b(gym|workout|work out|exercise|fitness|run|running|jog|jogging|training|abs)\b/i],
  ["clinic", /\b(sick|doctor|hospital|ill|headache|malaria|medicine|nurse|clinic|fever)\b/i],
  ["market", /\b(market|shopping|shop|buy|bought|mall|money|cash|sales?|price)\b/i],
  ["cinema", /\b(movie|movies|film|netflix|cinema|series|show|episode|anime|nollywood)\b/i],
  ["pool", /\b(swim|swimming|pool|splash)\b/i],
  ["stage", /\b(party|owambe|concert|music|song|songs|dance|dancing|club|dj|afrobeats|wizkid|burna|davido|tems|asake)\b/i],
  ["bus", /\b(danfo|bus|traffic|car|drive|driving|road|okada|uber|bolt|keke|trip|travel|go-slow|fuel)\b/i],
  ["palm", /\b(beach|sea|ocean|island|vacation|holiday|sunny|chill|relax)\b/i],
  ["house", /\b(home|house|room|bed|sleep|sleeping|family|mum|mom|dad|sister|brother)\b/i],
  ["lamp", /\b(night|vibe|vibes|photo|pic|selfie|walk|evening)\b/i],
  ["flowers", /(\blove\b|❤|💕|😍|🥰|\bheart\b|\bmiss you\b|\bcute\b|\bbeautiful\b|\bsweet\b)/i],
];

const DEFAULTS: PieceKind[] = ["tree", "house", "flowers", "palm", "tree", "rocks", "house", "flowers", "cafe", "lamp", "house", "office", "market", "house", "tree"];
const ROOFS = ["#6d4ff0", "#e0477e", "#1aa774", "#2f80ed", "#ef6a3a", "#b4532a"];
const WALLS = ["#fff3e0", "#ffe3d6", "#e2f6ec", "#ece6ff", "#fff6c4", "#dcefff"];
const CARS = ["#e5484d", "#2f80ed", "#f7c614", "#ffffff", "#1aa774", "#3a3350"];

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

/** Roads run every this many tiles, both ways */
export const BLOCK = 4;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const key = (gx: number, gy: number) => `${gx},${gy}`;
/** -0.5 to 0.5, steady per tile: makes the coast wiggle */
const wiggle = (gx: number, gy: number) => (hash(`c${gx},${gy}`) % 1000) / 1000 - 0.5;
const isLandAt = (gx: number, gy: number, r: number) => Math.hypot(gx, gy) <= r + wiggle(gx, gy) * 1.4;
const isRoad = (gx: number, gy: number) => mod(gx, BLOCK) === 0 || mod(gy, BLOCK) === 0;

/**
 * Every plot (not a road) in the same order for every chat: middle first, loosely, so the town
 * fills out naturally. Piece number i always gets plot number i, so nothing moves as it grows.
 */
const ORDER: { gx: number; gy: number }[] = (() => {
  const out: { gx: number; gy: number; d: number }[] = [];
  const n = 48;
  for (let gx = -n; gx <= n; gx++)
    for (let gy = -n; gy <= n; gy++) {
      if (isRoad(gx, gy)) continue;
      out.push({ gx, gy, d: Math.hypot(gx, gy) + (hash(`p${gx},${gy}`) % 1000) / 600 });
    }
  return out.sort((a, b) => a.d - b.d).map(({ gx, gy }) => ({ gx, gy }));
})();

/** Lay the island out from the chat */
export function layoutIsland(d: IslandData): IslandLayout {
  const items = d.items ?? [];
  const voices = items.filter(([k]) => k === "audio").length;
  const built = items.filter(([k]) => k !== "audio" && k !== "system");

  // Big enough that every piece's plot (and a few spare) is on land
  const plots = ORDER.slice(0, Math.min(ORDER.length, built.length + 6));
  const radius = Math.max(3.2, ...plots.map((p) => Math.hypot(p.gx, p.gy) - wiggle(p.gx, p.gy) * 1.4 + 0.05));

  const land = new Set<string>();
  const roads: Road[] = [];
  const n = Math.ceil(radius + 1);
  for (let gx = -n; gx <= n; gx++)
    for (let gy = -n; gy <= n; gy++) {
      if (!isLandAt(gx, gy, radius)) continue;
      land.add(key(gx, gy));
      if (isRoad(gx, gy)) {
        const rx = mod(gx, BLOCK) === 0;
        const ry = mod(gy, BLOCK) === 0;
        roads.push({ gx, gy, axis: rx && ry ? "both" : rx ? "y" : "x" });
      }
    }

  const pieces: Piece[] = built.map(([kind, body], i) => {
    const p = pieceFor(kind, body, String(i));
    const h = hash(`${i}:${body}`);
    // Older pieces level up as you keep talking
    const age = built.length - 1 - i;
    const level: 1 | 2 | 3 = age >= 120 ? 3 : age >= 40 ? 2 : 1;
    const plot = plots[i];
    return {
      kind: p.kind,
      level,
      variant: (h >>> 20) % 3,
      gx: plot.gx,
      gy: plot.gy,
      scale: p.kind === "pitch" ? 0.62 : 0.82 + ((h >>> 8) % 10) / 100,
      roof: ROOFS[(h >>> 12) % ROOFS.length],
      wall: WALLS[(h >>> 16) % WALLS.length],
      from: body,
      label: NAMES[p.kind][level - 1],
    };
  });

  const used = new Set(pieces.map((p) => key(p.gx, p.gy)));
  const free: { gx: number; gy: number }[] = [];
  land.forEach((k) => {
    const [gx, gy] = k.split(",").map(Number);
    if (!used.has(k) && !isRoad(gx, gy)) free.push({ gx, gy });
  });
  const coast = (p: { gx: number; gy: number }) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !land.has(key(p.gx + dx, p.gy + dy)));
  const coastal = free.filter(coast);
  // The lighthouse stands on the coast to the east, the signpost on the front coast
  const lighthouse = d.total >= 100 && coastal.length ? coastal.reduce((a, b) => (b.gx - b.gy > a.gx - a.gy ? b : a)) : null;
  const signpost = d.unmasked && coastal.length ? coastal.filter((p) => p !== lighthouse).reduce((a, b) => (b.gx + b.gy > a.gx + a.gy ? b : a), coastal[0]) : null;
  const taken = new Set([lighthouse, signpost].filter(Boolean).map((p) => key(p!.gx, p!.gy)));
  const shrubs = free.filter((p) => !taken.has(key(p.gx, p.gy)) && hash(`s${p.gx},${p.gy}`) % 5 < 2).map(({ gx, gy }) => ({ gx, gy }));

  const transit = pieces.filter((p) => p.kind === "bus").length;
  // Straight road pieces (not crossings), nearest the middle first
  const straight = roads.filter((r) => r.axis !== "both").sort((a, b) => Math.hypot(a.gx, a.gy) - Math.hypot(b.gx, b.gy));
  const footbridges = straight.filter((_, i) => i % 5 === 2).slice(0, Math.floor(d.total / 60));
  const bridged = new Set(footbridges.map((r) => key(r.gx, r.gy)));
  const cars = straight
    .filter((r) => !bridged.has(key(r.gx, r.gy)) && hash(`car${r.gx},${r.gy}`) % 4 === 0)
    .slice(0, 6 + Math.floor(built.length / 6))
    .map((r, i): Vehicle => ({
      ...r,
      color: CARS[hash(`cc${r.gx},${r.gy}`) % CARS.length],
      // Little buses on the road: more of them the more you talk about getting around
      type: i % 3 === 0 || (transit > 0 && i % 2 === 0) ? "bus" : "car",
    }));

  const days = d.since ? Math.max(1, Math.ceil((Date.now() - new Date(d.since).getTime()) / 86400000)) : 1;
  return {
    land,
    roads,
    pieces,
    shrubs,
    footbridges,
    cars,
    lighthouse,
    signpost,
    radius,
    birds: Math.min(6, voices),
    boat: d.total >= 20,
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
