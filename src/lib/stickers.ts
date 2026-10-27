/** Masky, Dashpad's own sticker character. Each sticker is a pose; the words are yours to change. */
export const STICKER_POSES = [
  "wave", "kiss", "lol", "shock", "sleep", "dance", "peek", "stamp", "jollof", "dice",
  // Packs
  "devil", "sideeye", "tea", "micdrop", "facepalm", "seen",
  "japa", "sapa", "odogwu", "pray", "wahala", "abeg",
  "hearthands", "rose", "shy", "letter", "call", "hug",
  "gele", "spray", "cheers", "confetti", "cake", "dj",
] as const;
export type StickerPose = (typeof STICKER_POSES)[number];

export const STICKER_COLORS = [
  { id: "#7a5cf0", name: "Purple" },
  { id: "#ff7aa8", name: "Pink" },
  { id: "#2fb3a0", name: "Teal" },
  { id: "#ffb02e", name: "Gold" },
  { id: "#e5484d", name: "Red" },
  { id: "#5b6cff", name: "Blue" },
] as const;

export const STICKER_MAX = 24;

export type Sticker = { pose: StickerPose; caption: string; color: string; move: string };

export const STICKERS: Sticker[] = [
  { pose: "wave", caption: "Hey you", color: "#7a5cf0", move: "Waves and winks" },
  { pose: "kiss", caption: "Mwah", color: "#ff7aa8", move: "Blows a kiss" },
  { pose: "lol", caption: "LOL", color: "#2fb3a0", move: "Cries laughing" },
  { pose: "shock", caption: "Omo!", color: "#ffb02e", move: "Jumps in shock" },
  { pose: "sleep", caption: "GN", color: "#5b6cff", move: "Snores" },
  { pose: "dance", caption: "Shaku!", color: "#7a5cf0", move: "Dances" },
  { pose: "peek", caption: "Unmask?", color: "#ff7aa8", move: "Peeks under the mask" },
  { pose: "stamp", caption: "Gbam!", color: "#e5484d", move: "Slams the stamp" },
  { pose: "jollof", caption: "Jollof?", color: "#ffb02e", move: "Heart eyes for jollof" },
  { pose: "dice", caption: "Your turn", color: "#2fb3a0", move: "Rolls the dice" },
];

export const isPose = (p: unknown): p is StickerPose => STICKER_POSES.includes(p as StickerPose);
export const isStickerColor = (c: unknown): c is string => STICKER_COLORS.some((x) => x.id === c);

export type StickerPack = { id: string; name: string; tagline: string; emoji: string; free?: boolean; stickers: Sticker[] };

/** Masky is free; the other packs are bought once with Keys and kept for good */
export const STICKER_PACKS: StickerPack[] = [
  { id: "masky", name: "Masky", tagline: "The classics", emoji: "🎭", free: true, stickers: STICKERS },
  {
    id: "savage",
    name: "Savage",
    tagline: "For when you're feeling cheeky",
    emoji: "😈",
    stickers: [
      { pose: "devil", caption: "Hehe", color: "#7a5cf0", move: "Grows horns, rubs hands, tail wags" },
      { pose: "sideeye", caption: "Hmm", color: "#2fb3a0", move: "Side-eye, arms folded" },
      { pose: "tea", caption: "Gist me", color: "#ff7aa8", move: "Sips tea" },
      { pose: "micdrop", caption: "Mic drop", color: "#5b6cff", move: "Shades on, drops the mic" },
      { pose: "facepalm", caption: "Mtchew", color: "#ffb02e", move: "Facepalm" },
      { pose: "seen", caption: "K.", color: "#e5484d", move: "Leaves you on seen" },
    ],
  },
  {
    id: "naija",
    name: "Naija",
    tagline: "Wahala, sapa and everything in between",
    emoji: "🇳🇬",
    stickers: [
      { pose: "japa", caption: "Japa!", color: "#2fb3a0", move: "Runs off with a suitcase" },
      { pose: "sapa", caption: "Sapa", color: "#5b6cff", move: "Empty pockets, a fly buzzes" },
      { pose: "odogwu", caption: "Odogwu", color: "#e5484d", move: "Flexes in shades and a chain" },
      { pose: "pray", caption: "God when?", color: "#ffb02e", move: "Prays, glory shines" },
      { pose: "wahala", caption: "Wahala!", color: "#7a5cf0", move: "Hands on head, storm cloud" },
      { pose: "abeg", caption: "Abeg", color: "#ff7aa8", move: "Begs with puppy eyes" },
    ],
  },
  {
    id: "love",
    name: "Love",
    tagline: "Flirty, soft and a little shy",
    emoji: "💘",
    stickers: [
      { pose: "hearthands", caption: "Love you", color: "#ff7aa8", move: "Heart hands, heart beats" },
      { pose: "rose", caption: "For you", color: "#7a5cf0", move: "Hands you a rose" },
      { pose: "shy", caption: "Stop it!", color: "#ffb02e", move: "Hides a big blush" },
      { pose: "letter", caption: "Miss you", color: "#2fb3a0", move: "A heart flies out of a letter" },
      { pose: "call", caption: "Call me", color: "#e5484d", move: "Giggles on the phone" },
      { pose: "hug", caption: "Hug?", color: "#5b6cff", move: "Arms open wide" },
    ],
  },
  {
    id: "owambe",
    name: "Owambe",
    tagline: "Party mode",
    emoji: "🎉",
    stickers: [
      { pose: "gele", caption: "Owambe!", color: "#7a5cf0", move: "Dances in a gele" },
      { pose: "spray", caption: "Spray!", color: "#2fb3a0", move: "Sprays money, notes rain" },
      { pose: "cheers", caption: "Cheers!", color: "#ff7aa8", move: "Raises a glass" },
      { pose: "confetti", caption: "Yaaay!", color: "#ffb02e", move: "Pops confetti" },
      { pose: "cake", caption: "HBD!", color: "#5b6cff", move: "Candles flicker" },
      { pose: "dj", caption: "Vibes", color: "#e5484d", move: "Nods to the beat" },
    ],
  },
];

export const packOf = (pose: string) => STICKER_PACKS.find((p) => p.stickers.some((s) => s.pose === pose));

export type StickerPick = { pose: StickerPose; caption: string; color: string };

/** A sticker sent in a chat (falls back to a waving Masky if something's missing) */
export function stickerOf(meta: { pose?: unknown; color?: unknown } | null | undefined, caption: string): StickerPick {
  return { pose: isPose(meta?.pose) ? meta.pose : "wave", color: isStickerColor(meta?.color) ? meta.color : "#7a5cf0", caption };
}
