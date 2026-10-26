/** Masky, Dashpad's own sticker character. Each sticker is a pose; the words are yours to change. */
export const STICKER_POSES = ["wave", "kiss", "lol", "shock", "sleep", "dance", "peek", "stamp", "jollof", "dice"] as const;
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
