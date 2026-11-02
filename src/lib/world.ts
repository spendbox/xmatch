/**
 * Your World: every chat grows its own little world, one piece per message. It's worked out from
 * the chat's messages only (nothing extra is saved), the same way on both phones, so you both
 * always see the same world.
 *
 * - The main land is a grid: roads every few squares, and plots between them. Each piece gets its
 *   own plot, in the same order for every chat, so nothing ever overlaps or moves as it grows.
 * - As the land grows it gets regions: snowy peaks at the back, a forest on the left, a desert on
 *   the right, with a river running from a spring under the peaks to the sea.
 * - Milestones add more: a railway, an airport, and new islands out at sea (Beach Isle, Lighthouse
 *   Isle with a pier and ferry, Fire Isle, and Dream Isle floating in the sky).
 * - Pieces level up as you keep talking: a cottage becomes a family house, then flats.
 */

import type { IslandData } from "./island";
export type { IslandData };

export type PieceKind =
  | "home" | "food" | "cafe" | "sweet" | "music" | "sport" | "court" | "school" | "books" | "office" | "gym" | "clinic"
  | "market" | "cinema" | "pool" | "travel" | "lamp" | "garden" | "rocks" | "tree" | "palm" | "pets" | "games" | "art"
  | "stars" | "farm" | "fun" | "love" | "childhood";

export type Biome = "town" | "snow" | "desert" | "forest" | "sand";
export type TileKind = "grass" | "road" | "river" | "bridge" | "rail" | "crossing" | "lake" | "airport" | "spring";
export type Axis = "x" | "y" | "both";

export type Tile = {
  gx: number;
  gy: number;
  kind: TileKind;
  biome: Biome;
  /** Roads, rivers and rails run along x (gx changes) or y (gy changes) */
  axis?: Axis;
  /** The river falls off the land here */
  fall?: boolean;
  /** Which land it belongs to ("main" or an island) */
  land: string;
};

export type Piece = {
  kind: PieceKind;
  level: 1 | 2 | 3;
  variant: number;
  gx: number;
  gy: number;
  scale: number;
  /** Paint colours picked per piece */
  roof: string;
  wall: string;
  from: string;
  label: string;
  mine: boolean;
  at: number | null;
  msgId: number | null;
  next: string | null;
  toGo: number;
  biome: Biome;
};

/** Things that aren't built by a message: scenery, landmarks and vehicles */
export type PropKind =
  | "mountain" | "snowpine" | "pine" | "tree" | "cactus" | "dune" | "shrub" | "flowers"
  | "lighthouse" | "cottage" | "palm" | "parasol" | "volcano" | "signpost" | "car" | "bus" | "footbridge";
export type Prop = { kind: PropKind; gx: number; gy: number; axis?: Axis; color?: string; variant?: number };

export type Island = { id: string; name: string; gx: number; gy: number; r: number };

export type WorldLayout = {
  tiles: Tile[];
  pieces: Piece[];
  props: Prop[];
  islands: Island[];
  /** The railway's train: where its engine is (along x) */
  train: { gx: number; gy: number } | null;
  /** Pier squares (over the sea), the ferry, and the island it sails to */
  pier: { tiles: { gx: number; gy: number }[]; ferry: { gx: number; gy: number }; to: { gx: number; gy: number } } | null;
  /** The airport block (runway, terminal and tower) */
  airport: { gx: number; gy: number } | null;
  /** How far the main land reaches from the middle, in squares */
  radius: number;
  birds: number;
  boats: number;
  balloon: boolean;
  plane: boolean;
  dreamIsle: boolean;
  fog: number;
  total: number;
  days: number;
  pieceCount: number;
  lands: number;
  next: string | null;
};

/** A small, steady hash: the same text always gives the same number, on every phone */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** What each piece is called, by level */
export const NAMES: Record<PieceKind, [string, string, string]> = {
  home: ["a cottage", "a family house", "a block of flats"],
  food: ["a food stall", "a restaurant", "a big restaurant"],
  cafe: ["a coffee kiosk", "a café", "a busy café"],
  sweet: ["an ice cream cart", "an ice cream shop", "a dessert parlour"],
  music: ["a bandstand", "a concert hall", "a grand concert hall"],
  sport: ["a football pitch", "a pitch with floodlights", "a stadium"],
  court: ["a basketball hoop", "a sports court", "a sports centre"],
  school: ["a school", "a college", "a university"],
  books: ["a reading nook", "a library", "a grand library"],
  office: ["an office", "an office block", "a skyscraper"],
  gym: ["a gym", "a sports club", "a big gym"],
  clinic: ["a clinic", "a hospital", "a big hospital"],
  market: ["market stalls", "a market", "a shopping street"],
  cinema: ["a little cinema", "a cinema", "a big cinema"],
  pool: ["a pool", "a pool with slides", "a water park"],
  travel: ["a bus stop", "a fuel station", "a bus station"],
  lamp: ["a street lamp", "a lamp and bench", "a little square"],
  garden: ["a flower bed", "a rose arch", "a park with a fountain"],
  rocks: ["some rocks", "a stone circle", "a statue"],
  tree: ["a tree", "a big tree", "a great oak"],
  palm: ["a palm tree", "two palm trees", "a palm grove"],
  pets: ["a dog house", "a pet shop", "a pet park"],
  games: ["a games kiosk", "a game arcade", "a big arcade"],
  art: ["an easel", "an art studio", "an art gallery"],
  stars: ["a telescope", "a stargazing deck", "an observatory"],
  farm: ["a vegetable patch", "a farm", "a big farm"],
  fun: ["a swing", "a carousel", "a Ferris wheel"],
  love: ["a bench for two", "a gazebo", "a gazebo with lights"],
  childhood: ["a swing set", "a treehouse", "a big treehouse"],
};

// Words that build something special (the first one found wins)
const WORDS: [PieceKind, RegExp][] = [
  ["food", /\b(food|eat|eating|hungry|rice|pizza|shawarma|dinner|lunch|breakfast|cook|cooking|kitchen|snack|restaurant|meat|chicken|burger|pasta|soup|chop)\b/i],
  ["sweet", /\b(ice cream|dessert|chocolate|cake|cookies?|sweets?|candy|doughnuts?)\b/i],
  ["cafe", /\b(coffee|tea|cafe|café|brunch|smoothie|drinks?|juice|latte)\b/i],
  ["sport", /\b(football|soccer|match|goal|fifa|league|arsenal|chelsea|united|madrid|barca)\b/i],
  ["court", /\b(basketball|nba|tennis|volleyball|badminton)\b/i],
  ["books", /\b(book|books|read|reading|novel|library|poem|poetry)\b/i],
  ["school", /\b(school|class|exam|exams|lecture|study|studying|uni|university|campus|assignment|teacher|course)\b/i],
  ["office", /\b(work|working|office|meeting|boss|job|deadline|business|client|salary|career)\b/i],
  ["gym", /\b(gym|workout|work out|exercise|fitness|run|running|jog|jogging|training|abs)\b/i],
  ["clinic", /\b(sick|doctor|hospital|ill|headache|medicine|nurse|clinic|fever|unwell)\b/i],
  ["market", /\b(market|shopping|shop|buy|bought|mall|money|cash|sales?|price)\b/i],
  ["cinema", /\b(movie|movies|film|netflix|cinema|series|show|episode|anime)\b/i],
  ["pool", /\b(swim|swimming|pool|splash)\b/i],
  ["music", /\b(party|concert|music|song|songs|dance|dancing|club|dj|album|singer|playlist)\b/i],
  ["games", /\b(game|games|gaming|ps5|playstation|xbox|nintendo|console|level up)\b/i],
  ["pets", /\b(dog|dogs|cat|cats|puppy|kitten|pet|pets)\b/i],
  ["art", /\b(art|paint|painting|draw|drawing|sketch|design|museum|gallery)\b/i],
  ["stars", /\b(stars?|moon|space|night sky|can'?t sleep|late night|insomnia)\b/i],
  ["farm", /\b(village|farm|hometown|countryside|garden|plants?)\b/i],
  ["childhood", /\b(childhood|kid|kids|when i was young|growing up|memories)\b/i],
  ["fun", /\b(fun|funfair|fair|adventure|date night|day out)\b/i],
  ["travel", /\b(bus|traffic|car|drive|driving|road|uber|taxi|trip|travel|flight|airport|fuel|on my way)\b/i],
  ["palm", /\b(beach|sea|ocean|island|vacation|holiday|sunny|chill|relax)\b/i],
  ["home", /\b(home|house|room|bed|sleep|sleeping|family|mum|mom|dad|sister|brother)\b/i],
  ["lamp", /\b(night|vibe|vibes|photo|pic|selfie|walk|evening)\b/i],
  ["love", /(\blove\b|❤|💕|😍|🥰|\bheart\b|\bmiss you\b|\bcute\b|\bbeautiful\b|\bsweet\b|\bdate\b)/i],
];

const DEFAULTS: PieceKind[] = ["tree", "home", "garden", "palm", "tree", "rocks", "home", "garden", "cafe", "lamp", "home", "office", "market", "home", "tree"];
const ROOFS = ["#ff8f7a", "#7b66ee", "#6fa6ff", "#ff8fb1", "#4fbf8a", "#f2a24a"];
const WALLS = ["#fff4e4", "#eef5ff", "#ffeedd", "#f1edff", "#fff0f6", "#eafbf2"];
const CARS = ["#7fb2ff", "#ff8fb1", "#ffb84a", "#7fe3c4", "#ffffff", "#b59cff"];

/** The piece one message adds, and the word that chose it */
export function pieceFor(kind: string, body: string, salt = ""): { kind: PieceKind; word: string | null } {
  if (kind === "gift") return { kind: "love", word: null };
  if (kind === "sticker" || kind === "scribble" || kind === "draw") return { kind: "tree", word: null };
  if (kind === "image" || kind === "video") return { kind: "art", word: null };
  if (kind === "game") return { kind: "games", word: null };
  for (const [k, re] of WORDS) {
    const m = body.match(re);
    if (m) return { kind: k, word: m[0].toLowerCase() };
  }
  return { kind: DEFAULTS[hash(body + salt) % DEFAULTS.length], word: null };
}

/** Roads run every this many squares, both ways */
export const BLOCK = 4;
const mod = (n: number, m: number) => ((n % m) + m) % m;
export const key = (gx: number, gy: number) => `${gx},${gy}`;
const wiggle = (gx: number, gy: number) => (hash(`c${gx},${gy}`) % 1000) / 1000 - 0.5;
const isLandAt = (gx: number, gy: number, r: number) => Math.hypot(gx, gy) <= r + wiggle(gx, gy) * 1.4;
const isRoad = (gx: number, gy: number) => mod(gx, BLOCK) === 0 || mod(gy, BLOCK) === 0;

// Two whole blocks are kept for landmarks: a lake in the forest, and the airport in the desert
const LAKE = { gx: -11, gy: 1 };
const AIRPORT = { gx: 9, gy: -7 };
const inBlock = (b: { gx: number; gy: number }, gx: number, gy: number) => gx >= b.gx && gx < b.gx + 3 && gy >= b.gy && gy < b.gy + 3;
const reserved = (gx: number, gy: number) => inBlock(LAKE, gx, gy) || inBlock(AIRPORT, gx, gy);

/** The river runs down this road line (bridges where roads cross it), the railway along this one */
const RIVER_GX = -4;
const RAIL_GY = -4;

/** Every plot in the same order for every chat: middle first, loosely */
const ORDER: { gx: number; gy: number }[] = (() => {
  const out: { gx: number; gy: number; d: number }[] = [];
  const n = 40;
  for (let gx = -n; gx <= n; gx++)
    for (let gy = -n; gy <= n; gy++) {
      if (isRoad(gx, gy) || reserved(gx, gy)) continue;
      out.push({ gx, gy, d: Math.hypot(gx, gy) + (hash(`p${gx},${gy}`) % 1000) / 600 });
    }
  return out.sort((a, b) => a.d - b.d).map(({ gx, gy }) => ({ gx, gy }));
})();

/** Which region a square is in. Regions only appear once the land is big enough. */
function biomeAt(gx: number, gy: number, r: number): Biome {
  if (r < 6) return "town";
  const back = -(gx + gy) / (r * 1.414);
  const side = (gx - gy) / (r * 1.414);
  if (back > 0.42) return "snow";
  if (side > 0.45) return "desert";
  if (side < -0.45) return "forest";
  return "town";
}

const MILESTONES: [number, string][] = [
  [20, "a sailing boat at 20 messages"],
  [50, "Beach Isle at 50 messages"],
  [100, "Lighthouse Isle, a pier and a ferry at 100 messages"],
  [150, "a railway and a hot-air balloon at 150 messages"],
  [250, "Fire Isle at 250 messages"],
  [300, "planes in the sky at 300 messages"],
  [500, "Dream Isle, floating in the sky, at 500 messages"],
];

/** Lay the world out from the chat */
export function layoutWorld(d: IslandData): WorldLayout {
  const items = d.items ?? [];
  const total = d.total ?? items.length;
  const voices = items.filter(([k]) => k === "audio").length;
  const built = items.filter(([k]) => k !== "audio" && k !== "system");

  const plots = ORDER.slice(0, Math.min(ORDER.length, built.length + 6));
  const radius = Math.max(3.2, ...plots.map((p) => Math.hypot(p.gx, p.gy) - wiggle(p.gx, p.gy) * 1.4 + 0.05));

  // ---- The main land ----
  const tiles: Tile[] = [];
  const at = new Map<string, Tile>();
  const n = Math.ceil(radius + 1);
  const riverOn = radius >= 6;
  const spring = -Math.floor(radius * 0.55);
  const railOn = total >= 150;
  for (let gx = -n; gx <= n; gx++)
    for (let gy = -n; gy <= n; gy++) {
      if (!isLandAt(gx, gy, radius)) continue;
      const biome = biomeAt(gx, gy, radius);
      const t: Tile = { gx, gy, kind: "grass", biome, land: "main" };
      const rx = mod(gx, BLOCK) === 0;
      const ry = mod(gy, BLOCK) === 0;
      if (riverOn && gx === RIVER_GX && gy >= spring) {
        t.kind = gy === spring ? "spring" : ry ? "bridge" : "river";
        t.axis = "y";
      } else if (railOn && gy === RAIL_GY && gx >= 1) {
        t.kind = rx ? "crossing" : "rail";
        t.axis = "x";
      } else if (rx || ry) {
        t.kind = "road";
        t.axis = rx && ry ? "both" : rx ? "y" : "x";
      }
      tiles.push(t);
      at.set(key(gx, gy), t);
    }
  // The river falls into the sea where it reaches the coast
  if (riverOn) {
    const last = tiles.filter((t) => t.gx === RIVER_GX && (t.kind === "river" || t.kind === "bridge")).sort((a, b) => b.gy - a.gy)[0];
    if (last && !at.has(key(last.gx, last.gy + 1))) {
      last.kind = "river";
      last.fall = true;
    }
  }
  // Landmark blocks, once the land covers them
  const covers = (b: { gx: number; gy: number }) => [0, 1, 2].every((i) => [0, 1, 2].every((j) => at.has(key(b.gx + i, b.gy + j))));
  if (covers(LAKE)) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) at.get(key(LAKE.gx + i, LAKE.gy + j))!.kind = "lake";
  const airport = covers(AIRPORT) && total >= 300 ? AIRPORT : null;
  if (airport) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) at.get(key(AIRPORT.gx + i, AIRPORT.gy + j))!.kind = "airport";

  // ---- Pieces, one per message ----
  const pieces: Piece[] = built.map(([kind, body, mine, when, msgId], i) => {
    const p = pieceFor(kind, body, String(i));
    const h = hash(`${i}:${body}`);
    const age = built.length - 1 - i;
    const level: 1 | 2 | 3 = age >= 120 ? 3 : age >= 40 ? 2 : 1;
    const plot = plots[i];
    return {
      kind: p.kind,
      level,
      variant: (h >>> 20) % 3,
      gx: plot.gx,
      gy: plot.gy,
      scale: 0.8 + ((h >>> 8) % 8) / 100,
      roof: ROOFS[(h >>> 12) % ROOFS.length],
      wall: WALLS[(h >>> 16) % WALLS.length],
      from: body,
      label: NAMES[p.kind][level - 1],
      mine: mine === 1,
      at: when ? when * 1000 : null,
      msgId: msgId ?? null,
      next: level === 1 ? NAMES[p.kind][1] : level === 2 ? NAMES[p.kind][2] : null,
      toGo: level === 1 ? 40 - age : level === 2 ? 120 - age : 0,
      biome: at.get(key(plot.gx, plot.gy))?.biome ?? "town",
    };
  });

  // ---- Scenery on the empty plots ----
  const used = new Set(pieces.map((p) => key(p.gx, p.gy)));
  const props: Prop[] = [];
  for (const t of tiles) {
    if (t.kind !== "grass" || used.has(key(t.gx, t.gy)) || reserved(t.gx, t.gy)) continue;
    const r = hash(`s${t.gx},${t.gy}`) % 10;
    if (t.biome === "snow") {
      if (r < 4) props.push({ kind: "mountain", gx: t.gx, gy: t.gy, variant: r % 2 });
      else if (r < 7) props.push({ kind: "snowpine", gx: t.gx, gy: t.gy });
    } else if (t.biome === "desert") {
      if (r < 3) props.push({ kind: "cactus", gx: t.gx, gy: t.gy });
      else if (r < 5) props.push({ kind: "dune", gx: t.gx, gy: t.gy });
    } else if (t.biome === "forest") {
      if (r < 7) props.push({ kind: r % 2 ? "pine" : "tree", gx: t.gx, gy: t.gy });
    } else if (r < 2) props.push({ kind: "shrub", gx: t.gx, gy: t.gy, variant: r });
    else if (r < 3) props.push({ kind: "flowers", gx: t.gx, gy: t.gy });
  }

  // ---- Cars and buses on the roads ----
  const straight = tiles.filter((t) => t.kind === "road" && t.axis !== "both").sort((a, b) => Math.hypot(a.gx, a.gy) - Math.hypot(b.gx, b.gy));
  const footbridges = straight.filter((_, i) => i % 5 === 2).slice(0, Math.floor(total / 60));
  const bridged = new Set(footbridges.map((r) => key(r.gx, r.gy)));
  footbridges.forEach((t) => props.push({ kind: "footbridge", gx: t.gx, gy: t.gy, axis: t.axis }));
  const transit = pieces.filter((p) => p.kind === "travel").length;
  straight
    .filter((r) => !bridged.has(key(r.gx, r.gy)) && hash(`car${r.gx},${r.gy}`) % 4 === 0)
    .slice(0, 6 + Math.floor(built.length / 6))
    .forEach((r, i) =>
      props.push({ kind: i % 3 === 0 || (transit > 0 && i % 2 === 0) ? "bus" : "car", gx: r.gx, gy: r.gy, axis: r.axis, color: CARS[hash(`cc${r.gx},${r.gy}`) % CARS.length] }),
    );

  // ---- Islands out at sea ----
  const islands: Island[] = [];
  const addIsland = (id: string, name: string, dir: [number, number], r: number) => {
    const len = Math.hypot(dir[0], dir[1]);
    const dist = radius + 0.8 + 2.6 + r;
    const cx = Math.round((dir[0] / len) * dist);
    const cy = Math.round((dir[1] / len) * dist);
    islands.push({ id, name, gx: cx, gy: cy, r });
    for (let gx = cx - r - 1; gx <= cx + r + 1; gx++)
      for (let gy = cy - r - 1; gy <= cy + r + 1; gy++) {
        if (Math.hypot(gx - cx, gy - cy) > r + wiggle(gx, gy) * 0.8) continue;
        if (at.has(key(gx, gy))) continue;
        const t: Tile = { gx, gy, kind: "grass", biome: id === "beach" ? "sand" : "town", land: id };
        tiles.push(t);
        at.set(key(gx, gy), t);
      }
    return { cx, cy };
  };
  if (total >= 50) {
    const b = addIsland("beach", "Beach Isle", [0.25, 1], 1);
    props.push({ kind: "palm", gx: b.cx, gy: b.cy }, { kind: "parasol", gx: b.cx + 1, gy: b.cy });
  }
  let pier: WorldLayout["pier"] = null;
  if (total >= 100) {
    const l = addIsland("lighthouse", "Lighthouse Isle", [1, 0.45], 2);
    props.push({ kind: "cottage", gx: l.cx - 1, gy: l.cy }, { kind: "lighthouse", gx: l.cx + 1, gy: l.cy - 1 }, { kind: "palm", gx: l.cx, gy: l.cy + 1 });
    // A pier from the main land towards the island, and a ferry beside it
    const coast = tiles
      .filter((t) => t.land === "main" && (t.kind === "grass" || t.kind === "road") && !used.has(key(t.gx, t.gy)) && !at.has(key(t.gx + 1, t.gy)) && !at.has(key(t.gx + 2, t.gy)) && !at.has(key(t.gx + 3, t.gy)) && !at.has(key(t.gx + 2, t.gy + 1)))
      .sort((a, b) => b.gx + b.gy * 0.45 - (a.gx + a.gy * 0.45));
    const c = coast[0];
    if (c) {
      for (let i = props.length - 1; i >= 0; i--) if (props[i].gx === c.gx && props[i].gy === c.gy) props.splice(i, 1);
      pier = { tiles: [{ gx: c.gx + 1, gy: c.gy }, { gx: c.gx + 2, gy: c.gy }], ferry: { gx: c.gx + 2, gy: c.gy + 1 }, to: { gx: l.cx - 2, gy: l.cy } };
    }
  }
  if (total >= 250) {
    const f = addIsland("fire", "Fire Isle", [-1, 0.55], 2);
    props.push({ kind: "volcano", gx: f.cx, gy: f.cy }, { kind: "palm", gx: f.cx + 1, gy: f.cy + 1 });
  }

  // The signpost with your names, once you've both unmasked
  if (d.unmasked) {
    const spot = tiles.filter((t) => t.land === "main" && t.kind === "grass" && !used.has(key(t.gx, t.gy)) && !props.some((p) => p.gx === t.gx && p.gy === t.gy)).sort((a, b) => b.gx + b.gy - (a.gx + a.gy))[0];
    if (spot) props.push({ kind: "signpost", gx: spot.gx, gy: spot.gy });
  }

  const days = d.since ? Math.max(1, Math.ceil((Date.now() - new Date(d.since).getTime()) / 86400000)) : 1;
  const next = MILESTONES.find(([n]) => total < n)?.[1] ?? null;
  return {
    tiles,
    pieces,
    props,
    islands,
    train: railOn ? { gx: 2, gy: RAIL_GY } : null,
    pier,
    airport,
    radius,
    birds: Math.min(6, voices),
    boats: total >= 200 ? 2 : total >= 20 ? 1 : 0,
    balloon: total >= 150,
    plane: total >= 300,
    dreamIsle: total >= 500,
    fog: d.unmasked ? 0 : Math.max(0.06, 0.9 * (1 - total / 150)),
    total,
    days,
    pieceCount: built.length,
    lands: 1 + islands.length + (total >= 500 ? 1 : 0),
    next,
  };
}
