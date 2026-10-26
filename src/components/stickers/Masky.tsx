"use client";

import "@fontsource/lilita-one/latin-400.css";
import "./masky.css";
import type { StickerPose } from "@/lib/stickers";

// Each pose: its eyes, mouth and how the whole body moves
const POSES: Record<StickerPose, { e: string; m: string; anim: string; blush?: boolean; mask?: string }> = {
  wave: { e: "wink", m: "smile", anim: "a-bob" },
  kiss: { e: "happy", m: "kiss", anim: "a-bob", blush: true },
  lol: { e: "happy", m: "laugh", anim: "a-shake" },
  shock: { e: "shock", m: "o", anim: "a-jump" },
  sleep: { e: "sleep", m: "small", anim: "a-breathe" },
  dance: { e: "happy", m: "laugh", anim: "a-sway" },
  peek: { e: "none", m: "small", anim: "a-bob", blush: true, mask: "lift" },
  stamp: { e: "open", m: "laugh", anim: "a-dip" },
  jollof: { e: "hearts", m: "tongue", anim: "a-bob" },
  dice: { e: "wink", m: "smile", anim: "a-bob" },
};

const cx = (c: string) => (c ? `mk-${c}` : undefined);

/** Masky, the sticker character: a pose that moves, with your words under it. */
export function Masky({
  pose,
  caption,
  color = "#7a5cf0",
  size = 140,
  still,
  className,
}: {
  pose: StickerPose;
  caption: string;
  color?: string;
  size?: number;
  /** No moving (e.g. small previews) */
  still?: boolean;
  className?: string;
}) {
  const P = POSES[pose] ?? POSES.wave;
  const v = {
    color,
    shade: color,
    anim: P.anim,
    maskAnim: P.mask === "lift" ? "lift" : "",
    blush: !!P.blush,
    holes: P.e !== "shock",
    eOpen: P.e === "open", eWink: P.e === "wink", eHappy: P.e === "happy", eSleep: P.e === "sleep", eHearts: P.e === "hearts", eShock: P.e === "shock", eStars: P.e === "stars",
    mSmile: P.m === "smile", mLaugh: P.m === "laugh", mO: P.m === "o", mKiss: P.m === "kiss", mSmall: P.m === "small", mTongue: P.m === "tongue",
    pWave: pose === "wave", pKiss: pose === "kiss", pLol: pose === "lol", pShock: pose === "shock", pSleep: pose === "sleep", pDance: pose === "dance", pPeek: pose === "peek", pStamp: pose === "stamp", pJollof: pose === "jollof", pDice: pose === "dice",
    feetStill: pose !== "dance",
  };
  return (
    <div className={["mk flex flex-col items-center", still && "mk-still", className].filter(Boolean).join(" ")} style={{ width: size }} role="img" aria-label={`${caption} sticker`}>
      <svg viewBox="0 0 200 205" className="block w-full overflow-visible" aria-hidden>
      <ellipse cx="100" cy="190" rx="52" ry="7" fill="#1c1828" opacity="0.13" />
      <g className={cx(v.anim)}>

      {v.pDance && (<>
      <g className="mk-footA"><ellipse cx="78" cy="180" rx="16" ry="9" fill={v.shade} stroke="#1c1828" strokeWidth="3.5" /></g>
      <g className="mk-footB"><ellipse cx="122" cy="180" rx="16" ry="9" fill={v.shade} stroke="#1c1828" strokeWidth="3.5" /></g>
      </>)}
      {v.feetStill && (<>
      <ellipse cx="78" cy="180" rx="16" ry="9" fill={v.shade} stroke="#1c1828" strokeWidth="3.5" />
      <ellipse cx="122" cy="180" rx="16" ry="9" fill={v.shade} stroke="#1c1828" strokeWidth="3.5" />
      </>)}

      <path d="M100 40 C141 40 160 74 158 116 C156 156 133 178 100 178 C67 178 44 156 42 116 C40 74 59 40 100 40 Z" fill={v.color} stroke="#1c1828" strokeWidth="4.5" />
      <ellipse cx="100" cy="146" rx="34" ry="24" fill="#ffffff" opacity="0.22" />
      <ellipse cx="76" cy="58" rx="16" ry="9" fill="#ffffff" opacity="0.35" transform="rotate(-28 76 58)" />

      {v.pSleep && (<>
      <path d="M58 56 Q98 4 168 26 Q142 36 140 54 Q100 40 58 56 Z" fill="#3b5bdb" stroke="#1c1828" strokeWidth="4" strokeLinejoin="round" />
      <path d="M56 58 Q100 40 142 56" stroke="#ffffff" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="170" cy="26" r="10" fill="#ffffff" stroke="#1c1828" strokeWidth="3.5" />
      </>)}

      {v.pPeek && (<>
      <ellipse cx="80" cy="91" rx="11" ry="12" fill="#ffffff" stroke="#1c1828" strokeWidth="3" />
      <ellipse cx="120" cy="91" rx="11" ry="12" fill="#ffffff" stroke="#1c1828" strokeWidth="3" />
      <circle cx="81" cy="93" r="6" fill="#1c1828" />
      <circle cx="121" cy="93" r="6" fill="#1c1828" />
      <circle cx="83" cy="90" r="2.4" fill="#ffffff" />
      <circle cx="123" cy="90" r="2.4" fill="#ffffff" />
      </>)}

      <g className={cx(v.maskAnim)}>
      <path d="M55 78.8C55 70.4 60.6 66.2 67.6 66.2c9.8 0 18.2 5.6 29.4 5.6s19.6-5.6 29.4-5.6c7 0 12.6 4.2 12.6 12.6 0 18.2-11.2 33.6-25.2 33.6-9.8 0-11.2-9.8-16.8-9.8s-7 9.8-16.8 9.8C66.2 112.4 55 97 55 78.8z" fill="#ffffff" stroke="#1c1828" strokeWidth="4" strokeLinejoin="round" />
      {v.holes && (<>
      <ellipse cx="80" cy="86" rx="10" ry="6.6" fill="#1c1828" />
      <ellipse cx="119" cy="86" rx="10" ry="6.6" fill="#1c1828" />
      </>)}
      {v.eOpen && (<>
      <g className="mk-blink"><circle cx="83" cy="84" r="2.8" fill="#ffffff" /><circle cx="122" cy="84" r="2.8" fill="#ffffff" /></g>
      </>)}
      {v.eWink && (<>
      <circle cx="83" cy="84" r="2.8" fill="#ffffff" />
      <ellipse cx="119" cy="86" rx="10" ry="6.6" fill="#ffffff" />
      <path d="M111 87 q8 -7 16 0" stroke="#1c1828" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </>)}
      {v.eHappy && (<>
      <path d="M73 89 q7 -8 14 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M112 89 q7 -8 14 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>)}
      {v.eSleep && (<>
      <path d="M73 85 q7 6 14 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M112 85 q7 6 14 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>)}
      {v.eHearts && (<>
      <path d="M80 92 l-6.5 -6.5 a4 4 0 0 1 6.5 -4.6 a4 4 0 0 1 6.5 4.6 z" fill="#ff5a8a" />
      <path d="M119 92 l-6.5 -6.5 a4 4 0 0 1 6.5 -4.6 a4 4 0 0 1 6.5 4.6 z" fill="#ff5a8a" />
      </>)}
      {v.eShock && (<>
      <ellipse cx="80" cy="86" rx="10" ry="8.5" fill="#ffffff" />
      <ellipse cx="119" cy="86" rx="10" ry="8.5" fill="#ffffff" />
      <circle cx="80" cy="86" r="2.6" fill="#1c1828" />
      <circle cx="119" cy="86" r="2.6" fill="#1c1828" />
      </>)}
      {v.eStars && (<>
      <path d="m80 79 2.2 4.6 5 .5-3.8 3.4 1.1 4.9-4.5-2.6-4.5 2.6 1.1-4.9-3.8-3.4 5-.5z" fill="#f2b33d" />
      <path d="m119 79 2.2 4.6 5 .5-3.8 3.4 1.1 4.9-4.5-2.6-4.5 2.6 1.1-4.9-3.8-3.4 5-.5z" fill="#f2b33d" />
      </>)}
      </g>

      {v.blush && (<>
      <ellipse cx="64" cy="122" rx="11" ry="6.5" fill="#ff7aa8" opacity="0.65" />
      <ellipse cx="136" cy="122" rx="11" ry="6.5" fill="#ff7aa8" opacity="0.65" />
      </>)}

      {v.mSmile && (<>
      <path d="M86 128 q14 16 28 0 z" fill="#1c1828" stroke="#1c1828" strokeWidth="3" strokeLinejoin="round" />
      <path d="M92 134 q8 5 16 0 q-8 -2 -16 0 z" fill="#ff7aa8" />
      </>)}
      {v.mLaugh && (<>
      <path d="M78 122 q22 32 44 0 z" fill="#1c1828" stroke="#1c1828" strokeWidth="3" strokeLinejoin="round" />
      <path d="M84 124 h32 l-2 5 h-28 z" fill="#ffffff" />
      <path d="M90 138 q10 7 20 0 q-10 -4 -20 0 z" fill="#ff7aa8" />
      </>)}
      {v.mO && (<>
      <ellipse cx="100" cy="132" rx="9" ry="11" fill="#1c1828" />
      <ellipse cx="100" cy="137" rx="5.5" ry="3.5" fill="#ff7aa8" />
      </>)}
      {v.mKiss && (<>
      <path d="M95 127 q5 -4 5 1 q0 -5 5 -1 q3 4 -5 9 q-8 -5 -5 -9 z" fill="#e5484d" stroke="#1c1828" strokeWidth="2.5" strokeLinejoin="round" />
      </>)}
      {v.mSmall && (<>
      <path d="M93 129 q7 6 14 0" stroke="#1c1828" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </>)}
      {v.mTongue && (<>
      <path d="M84 125 q16 18 32 0 z" fill="#1c1828" stroke="#1c1828" strokeWidth="3" strokeLinejoin="round" />
      <path d="M104 128 q10 0 10 9 q0 7 -7 6 q-6 -1 -5 -8 z" fill="#ff7aa8" stroke="#1c1828" strokeWidth="2.5" />
      </>)}

      {v.pWave && (<>
      <path d="M56 116 Q40 134 46 154" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 116 Q40 134 46 154" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <g className="mk-wave">
      <path d="M146 112 Q170 100 176 72" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M146 112 Q170 100 176 72" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="177" cy="66" r="11" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      </g>
      <path className="mk-pop1" d="M184 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#f2b33d" stroke="#1c1828" strokeWidth="2" />
      </>)}

      {v.pKiss && (<>
      <path d="M56 116 Q40 134 46 154" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 116 Q40 134 46 154" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M146 116 Q146 142 122 140" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M146 116 Q146 142 122 140" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="118" cy="139" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      <path className="mk-heart" d="M128 136 l-10 -10 a6 6 0 0 1 10 -7 a6 6 0 0 1 10 7 z" fill="#ff4d7e" stroke="#1c1828" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="mk-heart2" d="M128 136 l-7 -7 a4.2 4.2 0 0 1 7 -5 a4.2 4.2 0 0 1 7 5 z" fill="#ff8fb0" stroke="#1c1828" strokeWidth="2" strokeLinejoin="round" />
      </>)}

      {v.pLol && (<>
      <path d="M56 116 Q58 150 84 156" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 116 Q58 150 84 156" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M144 116 Q142 150 116 156" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M144 116 Q142 150 116 156" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path className="mk-tearL" d="M66 92 q-4 7 0 10 q4 -3 0 -10 z" fill="#7cc8ff" stroke="#1c1828" strokeWidth="2" />
      <path className="mk-tearR" d="M134 92 q-4 7 0 10 q4 -3 0 -10 z" fill="#7cc8ff" stroke="#1c1828" strokeWidth="2" />
      <text className="mk-pop1" x="150" y="44" fontFamily="'Lilita One', sans-serif" fontSize="26" fill="#ffffff" stroke="#1c1828" strokeWidth="2.5" paintOrder="stroke">HA</text>
      <text className="mk-pop2" x="18" y="58" fontFamily="'Lilita One', sans-serif" fontSize="20" fill="#ffffff" stroke="#1c1828" strokeWidth="2.5" paintOrder="stroke">HA</text>
      </>)}

      {v.pShock && (<>
      <path d="M52 118 Q44 140 64 140" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M52 118 Q44 140 64 140" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M148 118 Q156 140 136 140" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M148 118 Q156 140 136 140" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="66" cy="136" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      <circle cx="134" cy="136" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      <path className="mk-sweat" d="M150 52 q-6 9 0 13 q6 -4 0 -13 z" fill="#7cc8ff" stroke="#1c1828" strokeWidth="2" />
      <g className="mk-pop1"><path d="M96 4 h12 l-3 22 h-6 z" fill="#e5484d" stroke="#1c1828" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="102" cy="33" r="4.5" fill="#e5484d" stroke="#1c1828" strokeWidth="2.5" /></g>
      <path d="M36 40 l10 8 M30 58 l12 2 M164 40 l-10 8 M170 58 l-12 2" stroke="#1c1828" strokeWidth="3.5" strokeLinecap="round" />
      </>)}

      {v.pSleep && (<>
      <path d="M56 118 Q46 140 60 156" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 118 Q46 140 60 156" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M144 118 Q154 140 140 156" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M144 118 Q154 140 140 156" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle className="mk-bubble" cx="118" cy="120" r="11" fill="#bfe8ff" stroke="#1c1828" strokeWidth="2.5" opacity="0.9" />
      <text className="mk-up1" x="150" y="80" fontFamily="'Lilita One', sans-serif" fontSize="24" fill="#ffffff" stroke="#1c1828" strokeWidth="2.5" paintOrder="stroke">Z</text>
      <text className="mk-up2" x="162" y="96" fontFamily="'Lilita One', sans-serif" fontSize="18" fill="#ffffff" stroke="#1c1828" strokeWidth="2.5" paintOrder="stroke">z</text>
      <text className="mk-up3" x="146" y="104" fontFamily="'Lilita One', sans-serif" fontSize="14" fill="#ffffff" stroke="#1c1828" strokeWidth="2" paintOrder="stroke">z</text>
      <path d="M24 30 a16 16 0 1 0 18 22 a13 13 0 1 1 -18 -22 z" fill="#ffd166" stroke="#1c1828" strokeWidth="3" />
      </>)}

      {v.pDance && (<>
      <g className="mk-armA">
      <path d="M56 112 Q34 108 26 90" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 112 Q34 108 26 90" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="86" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      </g>
      <g className="mk-armB">
      <path d="M144 112 Q166 108 174 90" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M144 112 Q166 108 174 90" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="176" cy="86" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      </g>
      <g className="mk-up1"><path d="M160 40 v-22 l14 -4 v20" stroke="#1c1828" strokeWidth="3.5" fill="none" strokeLinejoin="round" /><ellipse cx="156" cy="40" rx="6" ry="4.5" fill="#1c1828" /><ellipse cx="170" cy="36" rx="6" ry="4.5" fill="#1c1828" /></g>
      <g className="mk-up2"><path d="M34 46 v-20" stroke="#1c1828" strokeWidth="3.5" /><path d="M34 26 q8 2 10 10" stroke="#1c1828" strokeWidth="3.5" fill="none" /><ellipse cx="30" cy="46" rx="6" ry="4.5" fill="#1c1828" /></g>
      </>)}

      {v.pPeek && (<>
      <path d="M56 116 Q40 134 46 154" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 116 Q40 134 46 154" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <g className="mk-lift">
      <path d="M146 116 Q168 108 146 80" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M146 116 Q168 108 146 80" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="144" cy="78" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      </g>
      <text className="mk-pop1" x="160" y="44" fontFamily="'Lilita One', sans-serif" fontSize="34" fill="#f2b33d" stroke="#1c1828" strokeWidth="3" paintOrder="stroke">?</text>
      </>)}

      {v.pStamp && (<>
      <path d="M56 116 Q40 134 46 154" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 116 Q40 134 46 154" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <g className="mk-slam">
      <path d="M146 110 Q172 112 176 140" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M146 110 Q172 112 176 140" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <rect x="170" y="128" width="12" height="22" rx="4" fill="#8a5a3c" stroke="#1c1828" strokeWidth="3" />
      <rect x="158" y="148" width="36" height="16" rx="4" fill="#e5484d" stroke="#1c1828" strokeWidth="3.5" />
      <circle cx="176" cy="140" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      </g>
      <g className="mk-impact">
      <path d="M176 182 l6 -14 l4 12 l12 -6 l-6 12 l12 4 l-14 4 l2 12 l-10 -8 l-8 10 l-2 -12 l-12 2 l8 -10 l-10 -6 z" fill="#f2b33d" stroke="#1c1828" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      </>)}

      {v.pJollof && (<>
      <path d="M56 120 Q52 150 66 156" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 120 Q52 150 66 156" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M144 120 Q148 150 134 156" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M144 120 Q148 150 134 156" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M60 148 h80 q-4 30 -40 30 q-36 0 -40 -30 z" fill="#ffffff" stroke="#1c1828" strokeWidth="4" strokeLinejoin="round" />
      <path d="M64 148 q36 -26 72 0 z" fill="#e5672b" stroke="#1c1828" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="86" cy="141" r="2.5" fill="#1f9d6b" /><circle cx="104" cy="137" r="2.5" fill="#ffd166" /><circle cx="118" cy="143" r="2.5" fill="#1f9d6b" />
      <path d="M60 150 h80" stroke="#5b3fd9" strokeWidth="3" />
      <path className="mk-steam1" d="M86 128 q-6 -8 0 -16 q6 -8 0 -16" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />
      <path className="mk-steam2" d="M112 126 q-6 -8 0 -16 q6 -8 0 -16" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />
      <circle cx="66" cy="156" r="9" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      <circle cx="134" cy="156" r="9" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      </>)}

      {v.pDice && (<>
      <path d="M56 116 Q40 134 46 154" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M56 116 Q40 134 46 154" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M146 118 Q166 124 182 116" stroke="#1c1828" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M146 118 Q166 124 182 116" stroke={v.color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="184" cy="115" r="10" fill={v.color} stroke="#1c1828" strokeWidth="3.5" />
      <path d="M190 110 l8 -4" stroke="#1c1828" strokeWidth="6" strokeLinecap="round" />
      <g className="mk-dice"><rect x="150" y="158" width="26" height="26" rx="6" fill="#ffffff" stroke="#1c1828" strokeWidth="3" /><circle cx="157" cy="165" r="2.6" fill="#e5484d" /><circle cx="163" cy="171" r="2.6" fill="#e5484d" /><circle cx="169" cy="177" r="2.6" fill="#e5484d" /></g>
      <g className="mk-dice2"><rect x="172" y="164" width="22" height="22" rx="5" fill="#ffffff" stroke="#1c1828" strokeWidth="3" /><circle cx="178" cy="170" r="2.3" fill="#1c1828" /><circle cx="188" cy="180" r="2.3" fill="#1c1828" /></g>
      </>)}

      </g>
      </svg>
      {caption && (
        <span
          className="mk-caption"
          style={{ fontSize: Math.round(size * (caption.length > 12 ? 0.13 : 0.17)), WebkitTextStroke: `${Math.max(3, Math.round(size * 0.035))}px #1c1828` }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}
