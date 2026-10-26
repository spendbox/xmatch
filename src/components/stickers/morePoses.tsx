/* More Masky poses, for the sticker packs. Each one is drawn on the same 200 × 205 canvas as the
   free ones: the body, mask and feet come from Masky.tsx; this adds the arms, props and faces. */

const K = "#1c1828";

function Arm({ d, c }: { d: string; c: string }) {
  return (
    <>
      <path d={d} stroke={K} strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d={d} stroke={c} strokeWidth="11" fill="none" strokeLinecap="round" />
    </>
  );
}
function Hand({ x, y, c, r = 10 }: { x: number; y: number; c: string; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={c} stroke={K} strokeWidth="3.5" />;
}
function Word({ x, y, size, children, cls, fill = "#ffffff" }: { x: number; y: number; size: number; children: string; cls?: string; fill?: string }) {
  return (
    <text className={cls} x={x} y={y} fontFamily="'Lilita One', sans-serif" fontSize={size} fill={fill} stroke={K} strokeWidth="2.5" paintOrder="stroke">
      {children}
    </text>
  );
}
const Shades = () => (
  <g>
    <rect x="63" y="76" width="33" height="19" rx="8" fill={K} />
    <rect x="104" y="76" width="33" height="19" rx="8" fill={K} />
    <path d="M94 82 h12" stroke={K} strokeWidth="4" />
    <path d="M69 81 h9 M110 81 h9" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
  </g>
);
const PartyHat = ({ fill = "#5b6cff" }: { fill?: string }) => (
  <g>
    <path d="M100 4 L80 46 Q100 53 120 46 Z" fill={fill} stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
    <circle cx="94" cy="34" r="3" fill="#ffd166" />
    <circle cx="105" cy="24" r="3" fill="#ffd166" />
    <circle cx="108" cy="40" r="3" fill="#ffd166" />
    <circle cx="100" cy="4" r="6.5" fill="#ffd166" stroke={K} strokeWidth="3" />
  </g>
);
const Heart = ({ x, y, s = 1, fill = "#ff4d7e", cls }: { x: number; y: number; s?: number; fill?: string; cls?: string }) => (
  <path
    className={cls}
    d={`M${x} ${y} l${-10 * s} ${-10 * s} a${6 * s} ${6 * s} 0 0 1 ${10 * s} ${-7 * s} a${6 * s} ${6 * s} 0 0 1 ${10 * s} ${7 * s} z`}
    fill={fill}
    stroke={K}
    strokeWidth="2.5"
    strokeLinejoin="round"
  />
);
const Note = ({ x, y, cls }: { x: number; y: number; cls?: string }) => (
  <g className={cls}>
    <path d={`M${x} ${y} v-20 l14 -4 v20`} stroke={K} strokeWidth="3.5" fill="none" strokeLinejoin="round" />
    <ellipse cx={x - 4} cy={y} rx="6" ry="4.5" fill={K} />
    <ellipse cx={x + 10} cy={y - 4} rx="6" ry="4.5" fill={K} />
  </g>
);
const Cash = ({ x, y, r = 0, cls }: { x: number; y: number; r?: number; cls?: string }) => (
  <g className={cls}>
    <g transform={`rotate(${r} ${x + 13} ${y + 7})`}>
      <rect x={x} y={y} width="26" height="14" rx="2.5" fill="#2f9e5b" stroke={K} strokeWidth="2.5" />
      <circle cx={x + 13} cy={y + 7} r="3.5" fill="#bdf0cf" />
    </g>
  </g>
);
const Sweat = ({ x, y }: { x: number; y: number }) => (
  <path className="mk-sweat" d={`M${x} ${y} q-6 9 0 13 q6 -4 0 -13 z`} fill="#7cc8ff" stroke={K} strokeWidth="2" />
);
const RestArm = ({ c }: { c: string }) => <Arm d="M56 116 Q40 134 46 154" c={c} />;

type Extra = {
  e: string;
  m: string;
  anim: string;
  blush?: boolean;
  feet?: "dance";
  back?: (c: string) => React.ReactNode;
  art: (c: string) => React.ReactNode;
};

export const EXTRA_POSES: Record<string, Extra> = {
  // ——— Savage 😈 ———
  devil: {
    e: "none",
    m: "none",
    anim: "a-bob",
    back: () => (
      <g className="mk-wag">
        <path d="M146 162 Q182 168 178 132" stroke={K} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M146 162 Q182 168 178 132" stroke="#e5484d" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M178 116 l-10 18 h20 z" fill="#e5484d" stroke={K} strokeWidth="3" strokeLinejoin="round" />
      </g>
    ),
    art: (c) => (
      <>
        <path d="M66 54 Q54 30 70 14 Q72 34 86 44 Z" fill="#e5484d" stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M134 54 Q146 30 130 14 Q128 34 114 44 Z" fill="#e5484d" stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M71 83 l17 5 M129 83 l-17 5" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
        <path d="M86 128 q16 12 30 -4" stroke={K} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M108 131 l3 7 l3 -8 z" fill="#ffffff" stroke={K} strokeWidth="1.5" />
        <Arm d="M56 116 Q58 148 92 148" c={c} />
        <Arm d="M146 116 Q142 148 108 148" c={c} />
        <g className="mk-rub">
          <Hand x={93} y={148} c={c} />
          <Hand x={107} y={148} c={c} />
        </g>
      </>
    ),
  },
  sideeye: {
    e: "none",
    m: "none",
    anim: "a-breathe",
    art: (c) => (
      <>
        <g className="mk-look">
          <circle cx="74" cy="87" r="3.4" fill="#ffffff" />
          <circle cx="113" cy="87" r="3.4" fill="#ffffff" />
        </g>
        <path d="M90 132 h20" stroke={K} strokeWidth="4" strokeLinecap="round" />
        <Arm d="M56 120 Q78 152 130 138" c={c} />
        <Arm d="M146 120 Q122 152 70 138" c={c} />
        <circle className="mk-pop1" cx="158" cy="56" r="4" fill="#ffffff" stroke={K} strokeWidth="2.5" />
        <circle className="mk-pop2" cx="170" cy="46" r="4" fill="#ffffff" stroke={K} strokeWidth="2.5" />
        <circle className="mk-pop1" cx="182" cy="36" r="4" fill="#ffffff" stroke={K} strokeWidth="2.5" />
      </>
    ),
  },
  tea: {
    e: "none",
    m: "none",
    anim: "a-bob",
    art: (c) => (
      <>
        <path d="M73 86 q7 5 14 0 M112 86 q7 5 14 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <RestArm c={c} />
        <g className="mk-sip">
          <path className="mk-steam1" d="M106 114 q-5 -7 0 -14 q5 -7 0 -14" stroke="#ffffff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path className="mk-steam2" d="M118 114 q-5 -7 0 -14 q5 -7 0 -14" stroke="#ffffff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M126 128 q12 0 10 10 q-2 7 -11 7" stroke={K} strokeWidth="4" fill="none" />
          <path d="M96 120 h31 l-3 26 q-12 7 -25 0 z" fill="#ffffff" stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
          <ellipse cx="111.5" cy="121" rx="14" ry="3" fill="#a0612b" />
          <path d="M102 132 q4 -4 8 0 q4 -4 8 0 q-4 6 -8 8 q-4 -2 -8 -8z" fill="#ff7aa8" />
          <Arm d="M146 116 Q152 142 130 140" c={c} />
          <Hand x={128} y={140} c={c} />
        </g>
      </>
    ),
  },
  micdrop: {
    e: "none",
    m: "smile",
    anim: "a-bob",
    art: (c) => (
      <>
        <Shades />
        <RestArm c={c} />
        <Arm d="M146 116 Q172 112 178 94" c={c} />
        <Hand x={180} y={90} c={c} />
        <g className="mk-drop">
          <rect x="176" y="104" width="9" height="26" rx="3" fill="#3a3550" stroke={K} strokeWidth="2.5" />
          <circle cx="180.5" cy="102" r="8" fill="#9a96a8" stroke={K} strokeWidth="2.5" />
        </g>
        <Word cls="mk-impact" x={128} y={200} size={22} fill="#f2b33d">BOOM</Word>
      </>
    ),
  },
  facepalm: {
    e: "none",
    m: "none",
    anim: "a-shake",
    art: (c) => (
      <>
        <path d="M112 87 q7 4 14 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M90 137 q10 -8 20 0" stroke={K} strokeWidth="4" fill="none" strokeLinecap="round" />
        <Arm d="M56 118 Q42 102 70 92" c={c} />
        <Hand x={78} y={88} c={c} r={14} />
        <path d="M70 80 l-3 -6 M78 77 l0 -7 M86 80 l3 -6" stroke={K} strokeWidth="3" strokeLinecap="round" />
        <Arm d="M146 116 Q160 134 154 154" c={c} />
        <Sweat x={140} y={60} />
      </>
    ),
  },
  seen: {
    e: "none",
    m: "none",
    anim: "a-breathe",
    art: (c) => (
      <>
        <path d="M70 86 h20 q-1 6 -10 6 q-9 0 -10 -6 z M109 86 h20 q-1 6 -10 6 q-9 0 -10 -6 z" fill="#ffffff" />
        <circle cx="80" cy="89" r="2.6" fill={K} />
        <circle cx="119" cy="89" r="2.6" fill={K} />
        <path d="M94 130 h12" stroke={K} strokeWidth="4" strokeLinecap="round" />
        <rect x="83" y="136" width="34" height="46" rx="7" fill={K} />
        <rect x="87" y="141" width="26" height="34" rx="3" fill="#bfe8ff" />
        <path d="M91 160 l3 3 l5 -6 M98 160 l3 3 l5 -6" stroke="#2563eb" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Arm d="M56 116 Q52 150 84 158" c={c} />
        <Arm d="M146 116 Q150 150 116 158" c={c} />
        <Hand x={84} y={158} c={c} r={8} />
        <Hand x={116} y={158} c={c} r={8} />
        <Word cls="mk-pop1" x={148} y={52} size={20}>Seen</Word>
      </>
    ),
  },

  // ——— Naija 🇳🇬 ———
  japa: {
    e: "open",
    m: "laugh",
    anim: "a-run",
    feet: "dance",
    art: (c) => (
      <>
        <g className="mk-plane">
          <path d="M18 40 l30 -6 l10 -12 l6 2 l-6 12 l14 -2 l4 4 l-18 6 l-4 10 l-5 -1 l2 -9 l-30 6 z" fill="#ffffff" stroke={K} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <path className="mk-pop1" d="M14 120 h18 M8 134 h22 M16 148 h14" stroke={K} strokeWidth="3.5" strokeLinecap="round" />
        <Arm d="M56 116 Q36 118 30 100" c={c} />
        <Hand x={29} y={96} c={c} />
        <Arm d="M146 118 Q160 138 166 150" c={c} />
        <g className="mk-swing">
          <path d="M160 152 v-6 q0 -5 5 -5 h8 q5 0 5 5 v6" stroke={K} strokeWidth="3.5" fill="none" />
          <rect x="150" y="152" width="38" height="28" rx="5" fill="#c98b2b" stroke={K} strokeWidth="3.5" />
          <path d="M162 152 v28 M176 152 v28" stroke="#8a5a1c" strokeWidth="3" />
        </g>
        <Hand x={168} y={150} c={c} r={8} />
      </>
    ),
  },
  sapa: {
    e: "none",
    m: "none",
    anim: "a-breathe",
    art: (c) => (
      <>
        <circle cx="80" cy="90" r="2.8" fill="#ffffff" />
        <circle cx="119" cy="90" r="2.8" fill="#ffffff" />
        <path className="mk-tearL" d="M70 96 q-4 7 0 10 q4 -3 0 -10 z" fill="#7cc8ff" stroke={K} strokeWidth="2" />
        <path d="M86 136 q7 -7 14 0 q7 7 14 0" stroke={K} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <Arm d="M56 118 Q40 136 46 152" c={c} />
        <Arm d="M146 118 Q160 136 154 152" c={c} />
        <path d="M60 150 q-30 -2 -32 22 q22 8 34 -10 z" fill="#ffffff" stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M140 150 q30 -2 32 22 q-22 8 -34 -10 z" fill="#ffffff" stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M38 160 q6 4 12 0 M150 160 q6 4 12 0" stroke="#d8d3e4" strokeWidth="2.5" fill="none" />
        <Hand x={44} y={154} c={c} r={9} />
        <Hand x={156} y={154} c={c} r={9} />
        <g className="mk-buzz">
          <circle cx="162" cy="46" r="4.5" fill={K} />
          <ellipse cx="158" cy="40" rx="5" ry="3" fill="#ffffff" stroke={K} strokeWidth="1.5" opacity="0.9" />
          <ellipse cx="166" cy="40" rx="5" ry="3" fill="#ffffff" stroke={K} strokeWidth="1.5" opacity="0.9" />
        </g>
        <path d="M150 60 q8 -4 4 -10" stroke={K} strokeWidth="1.5" fill="none" strokeDasharray="2 3" />
      </>
    ),
  },
  odogwu: {
    e: "none",
    m: "laugh",
    anim: "a-flex",
    art: (c) => (
      <>
        <Shades />
        <Arm d="M56 116 Q28 116 34 86" c={c} />
        <Arm d="M144 116 Q172 116 166 86" c={c} />
        <circle cx="38" cy="108" r="9" fill={c} stroke={K} strokeWidth="3" />
        <circle cx="162" cy="108" r="9" fill={c} stroke={K} strokeWidth="3" />
        <Hand x={36} y={80} c={c} r={11} />
        <Hand x={164} y={80} c={c} r={11} />
        <path d="M74 132 q26 26 52 0" stroke={K} strokeWidth="7" fill="none" />
        <path d="M74 132 q26 26 52 0" stroke="#f2b33d" strokeWidth="3.5" fill="none" />
        <circle cx="100" cy="152" r="7" fill="#f2b33d" stroke={K} strokeWidth="3" />
        <path className="mk-pop1" d="M24 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#f2b33d" stroke={K} strokeWidth="2" />
        <path className="mk-pop2" d="M176 36 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#f2b33d" stroke={K} strokeWidth="2" />
      </>
    ),
  },
  pray: {
    e: "none",
    m: "small",
    anim: "a-bob",
    back: () => (
      <g className="mk-spin">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M100 40 L100 -14" stroke="#ffd166" strokeWidth="6" strokeLinecap="round" opacity="0.7" transform={`rotate(${i * 30} 100 40)`} />
        ))}
      </g>
    ),
    art: (c) => (
      <>
        <circle cx="82" cy="82" r="3" fill="#ffffff" />
        <circle cx="121" cy="82" r="3" fill="#ffffff" />
        <Arm d="M56 118 Q66 148 94 140" c={c} />
        <Arm d="M146 118 Q134 148 106 140" c={c} />
        <path d="M91 146 q2 -30 9 -32 q7 2 9 32 z" fill={c} stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M100 116 v28" stroke={K} strokeWidth="2.5" />
      </>
    ),
  },
  wahala: {
    e: "shock",
    m: "o",
    anim: "a-shake",
    art: (c) => (
      <>
        <g className="mk-bob2">
          <path d="M62 24 q-14 0 -12 -12 q2 -12 16 -8 q6 -12 22 -8 q8 -10 22 -2 q16 -4 18 10 q12 2 8 14 z" fill="#6b6780" stroke={K} strokeWidth="3" strokeLinejoin="round" />
          <path className="mk-flash" d="M98 24 l-8 16 h9 l-6 16 l16 -22 h-9 l6 -10 z" fill="#ffd166" stroke={K} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <Arm d="M56 112 Q28 84 60 56" c={c} />
        <Arm d="M144 112 Q172 84 140 56" c={c} />
        <Hand x={62} y={54} c={c} />
        <Hand x={138} y={54} c={c} />
        <Sweat x={154} y={70} />
      </>
    ),
  },
  abeg: {
    e: "none",
    m: "none",
    anim: "a-plead",
    blush: true,
    art: (c) => (
      <>
        <ellipse cx="80" cy="87" rx="11" ry="10" fill="#ffffff" stroke={K} strokeWidth="2.5" />
        <ellipse cx="119" cy="87" rx="11" ry="10" fill="#ffffff" stroke={K} strokeWidth="2.5" />
        <circle cx="80" cy="89" r="7.5" fill={K} />
        <circle cx="119" cy="89" r="7.5" fill={K} />
        <circle cx="83" cy="85" r="3" fill="#ffffff" />
        <circle cx="77" cy="92" r="1.5" fill="#ffffff" />
        <circle cx="122" cy="85" r="3" fill="#ffffff" />
        <circle cx="116" cy="92" r="1.5" fill="#ffffff" />
        <path d="M93 132 q4 -4 7 0 q3 -4 7 0" stroke={K} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path className="mk-tearL" d="M68 96 q-4 7 0 10 q4 -3 0 -10 z" fill="#7cc8ff" stroke={K} strokeWidth="2" />
        <path className="mk-tearR" d="M132 96 q-4 7 0 10 q4 -3 0 -10 z" fill="#7cc8ff" stroke={K} strokeWidth="2" />
        <Arm d="M56 118 Q62 152 92 156" c={c} />
        <Arm d="M146 118 Q138 152 108 156" c={c} />
        <path d="M91 162 q2 -28 9 -30 q7 2 9 30 z" fill={c} stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M100 134 v26" stroke={K} strokeWidth="2.5" />
      </>
    ),
  },

  // ——— Love 💘 ———
  hearthands: {
    e: "happy",
    m: "smile",
    anim: "a-bob",
    blush: true,
    art: (c) => (
      <>
        <Arm d="M56 112 Q30 66 86 30" c={c} />
        <Arm d="M144 112 Q170 66 114 30" c={c} />
        <Hand x={90} y={28} c={c} />
        <Hand x={110} y={28} c={c} />
        <g className="mk-throb">
          <Heart x={100} y={16} s={1.2} />
        </g>
        <Heart x={36} y={60} s={0.7} fill="#ff8fb0" cls="mk-up1" />
        <Heart x={168} y={70} s={0.7} fill="#ff8fb0" cls="mk-up2" />
      </>
    ),
  },
  rose: {
    e: "happy",
    m: "small",
    anim: "a-bob",
    blush: true,
    art: (c) => (
      <>
        <RestArm c={c} />
        <path d="M178 96 Q176 74 184 58" stroke="#1f9d6b" strokeWidth="4" fill="none" />
        <path d="M180 80 q10 -8 14 0 q-8 6 -14 0 z" fill="#1f9d6b" stroke={K} strokeWidth="2" />
        <g className="mk-throb">
          <circle cx="185" cy="52" r="11" fill="#e5484d" stroke={K} strokeWidth="3" />
          <path d="M180 50 q5 -6 10 0 q-5 6 -10 0" stroke="#a51d2a" strokeWidth="2" fill="none" />
        </g>
        <Arm d="M146 118 Q172 122 176 100" c={c} />
        <Hand x={177} y={96} c={c} />
        <path className="mk-pop1" d="M150 30 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill="#f2b33d" stroke={K} strokeWidth="2" />
      </>
    ),
  },
  shy: {
    e: "happy",
    m: "small",
    anim: "a-shy",
    blush: true,
    art: (c) => (
      <>
        <ellipse cx="64" cy="122" rx="14" ry="8" fill="#ff5a8a" opacity="0.6" />
        <ellipse cx="136" cy="122" rx="14" ry="8" fill="#ff5a8a" opacity="0.6" />
        <Arm d="M56 120 Q48 136 66 120" c={c} />
        <Arm d="M144 120 Q152 136 134 120" c={c} />
        <Hand x={68} y={114} c={c} r={12} />
        <Hand x={132} y={114} c={c} r={12} />
        <Heart x={160} y={58} s={0.7} cls="mk-pop1" />
        <Heart x={42} y={52} s={0.6} fill="#ff8fb0" cls="mk-pop2" />
      </>
    ),
  },
  letter: {
    e: "happy",
    m: "smile",
    anim: "a-bob",
    blush: true,
    art: (c) => (
      <>
        <Heart x={128} y={126} s={0.9} cls="mk-heart" />
        <Arm d="M56 116 Q56 148 80 152" c={c} />
        <Arm d="M146 116 Q146 148 122 152" c={c} />
        <rect x="74" y="136" width="52" height="34" rx="4" fill="#ffffff" stroke={K} strokeWidth="3.5" />
        <path d="M74 138 l26 18 l26 -18" stroke={K} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <path d="M100 160 l-6 -6 a3.6 3.6 0 0 1 6 -4.2 a3.6 3.6 0 0 1 6 4.2 z" fill="#e5484d" stroke={K} strokeWidth="1.5" />
        <Hand x={76} y={152} c={c} r={8} />
        <Hand x={124} y={152} c={c} r={8} />
      </>
    ),
  },
  call: {
    e: "wink",
    m: "laugh",
    anim: "a-bob",
    blush: true,
    art: (c) => (
      <>
        <RestArm c={c} />
        <g transform="rotate(18 150 80)">
          <rect x="140" y="58" width="20" height="40" rx="6" fill={K} />
          <rect x="143" y="63" width="14" height="28" rx="2" fill="#5b6cff" />
        </g>
        <Arm d="M146 120 Q172 116 156 96" c={c} />
        <Hand x={154} y={94} c={c} />
        <Heart x={174} y={52} s={0.6} cls="mk-up1" />
        <Heart x={184} y={70} s={0.5} fill="#ff8fb0" cls="mk-up2" />
        <path className="mk-pop1" d="M168 84 q8 -8 0 -16 M176 90 q14 -14 0 -28" stroke={K} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  hug: {
    e: "happy",
    m: "laugh",
    anim: "a-bob",
    blush: true,
    art: (c) => (
      <>
        <g className="mk-hugL">
          <Arm d="M56 116 Q30 106 20 86" c={c} />
          <Hand x={18} y={82} c={c} />
        </g>
        <g className="mk-hugR">
          <Arm d="M144 116 Q170 106 180 86" c={c} />
          <Hand x={182} y={82} c={c} />
        </g>
        <Heart x={100} y={30} s={0.8} cls="mk-up1" />
        <Heart x={70} y={30} s={0.55} fill="#ff8fb0" cls="mk-up2" />
        <Heart x={132} y={34} s={0.55} fill="#ff8fb0" cls="mk-up3" />
      </>
    ),
  },

  // ——— Owambe 🎉 ———
  gele: {
    e: "happy",
    m: "laugh",
    anim: "a-sway",
    feet: "dance",
    art: (c) => (
      <>
        <path d="M46 66 Q30 26 70 24 Q78 0 100 6 Q122 0 130 24 Q170 26 154 66 Q100 46 46 66 Z" fill="#ff3d8b" stroke={K} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M60 50 Q80 30 100 40 Q120 30 140 50 M76 20 Q90 34 100 22 Q110 34 124 20" stroke="#ffd166" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="54" cy="104" r="5" fill="#f2b33d" stroke={K} strokeWidth="2" />
        <circle cx="146" cy="104" r="5" fill="#f2b33d" stroke={K} strokeWidth="2" />
        <g className="mk-armA">
          <Arm d="M56 112 Q34 108 26 90" c={c} />
          <Hand x={24} y={86} c={c} />
        </g>
        <g className="mk-armB">
          <Arm d="M144 112 Q166 108 174 90" c={c} />
          <Hand x={176} y={86} c={c} />
        </g>
      </>
    ),
  },
  spray: {
    e: "stars",
    m: "laugh",
    anim: "a-bob",
    art: (c) => (
      <>
        <RestArm c={c} />
        <Arm d="M146 116 Q170 108 172 84" c={c} />
        <Cash x={160} y={60} r={-20} />
        <Cash x={164} y={64} r={10} />
        <Hand x={172} y={80} c={c} />
        <Cash x={150} y={20} r={20} cls="mk-fall1" />
        <Cash x={110} y={14} r={-10} cls="mk-fall2" />
        <Cash x={176} y={30} r={40} cls="mk-fall3" />
        <Cash x={40} y={24} r={-30} cls="mk-fall2" />
      </>
    ),
  },
  cheers: {
    e: "wink",
    m: "smile",
    anim: "a-bob",
    art: (c) => (
      <>
        <RestArm c={c} />
        <g className="mk-clink">
          <path d="M164 44 h18 q0 22 -9 24 q-9 -2 -9 -24 z" fill="#ffe08a" stroke={K} strokeWidth="3" strokeLinejoin="round" />
          <path d="M173 68 v16 M165 86 h16" stroke={K} strokeWidth="3.5" strokeLinecap="round" />
          <circle className="mk-up1" cx="170" cy="56" r="2" fill="#ffffff" />
          <circle className="mk-up2" cx="176" cy="60" r="1.6" fill="#ffffff" />
          <circle className="mk-up3" cx="172" cy="52" r="1.4" fill="#ffffff" />
          <Arm d="M146 116 Q170 108 172 90" c={c} />
          <Hand x={172} y={86} c={c} />
        </g>
        <path className="mk-pop1" d="M150 26 l5 6 M190 26 l-5 6 M170 16 v8" stroke={K} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  confetti: {
    e: "happy",
    m: "laugh",
    anim: "a-jump",
    art: (c) => (
      <>
        <PartyHat />
        <RestArm c={c} />
        <path d="M150 104 l26 -26 l8 8 l-26 26 z" fill="#f2b33d" stroke={K} strokeWidth="3" strokeLinejoin="round" />
        <Arm d="M146 116 Q158 118 156 108" c={c} />
        <Hand x={156} y={108} c={c} />
        <rect className="mk-pop1" x="182" y="54" width="8" height="5" rx="1" fill="#e5484d" />
        <rect className="mk-pop2" x="168" y="46" width="8" height="5" rx="1" fill="#2fb3a0" transform="rotate(30 172 48)" />
        <circle className="mk-pop1" cx="194" cy="70" r="3.5" fill="#5b6cff" />
        <circle className="mk-pop2" cx="186" cy="38" r="3.5" fill="#ffd166" />
        <rect className="mk-pop2" x="196" y="52" width="7" height="4" rx="1" fill="#ff7aa8" />
        <path className="mk-pop1" d="M160 30 q6 6 0 12" stroke="#7a5cf0" strokeWidth="3" fill="none" />
      </>
    ),
  },
  cake: {
    e: "happy",
    m: "smile",
    anim: "a-bob",
    art: (c) => (
      <>
        <PartyHat fill="#ff7aa8" />
        <Arm d="M56 116 Q50 150 66 160" c={c} />
        <Arm d="M146 116 Q152 150 134 160" c={c} />
        <rect x="64" y="146" width="72" height="32" rx="6" fill="#ffd1dc" stroke={K} strokeWidth="3.5" />
        <path d="M64 154 q9 8 18 0 q9 8 18 0 q9 8 18 0 q9 8 18 0" stroke="#ffffff" strokeWidth="5" fill="none" />
        {[82, 100, 118].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="130" width="6" height="16" rx="2" fill="#5b6cff" stroke={K} strokeWidth="2" />
            <path className="mk-flicker" d={`M${x} 118 q-6 7 0 12 q6 -5 0 -12 z`} fill="#ffb02e" stroke={K} strokeWidth="2" />
          </g>
        ))}
        <Hand x={66} y={160} c={c} r={8} />
        <Hand x={134} y={160} c={c} r={8} />
      </>
    ),
  },
  dj: {
    e: "sleep",
    m: "smile",
    anim: "a-nod",
    art: (c) => (
      <>
        <path d="M46 92 Q46 22 100 22 Q154 22 154 92" stroke={K} strokeWidth="9" fill="none" />
        <path d="M46 92 Q46 22 100 22 Q154 22 154 92" stroke="#5b6cff" strokeWidth="4" fill="none" />
        <rect x="34" y="78" width="20" height="32" rx="8" fill="#5b6cff" stroke={K} strokeWidth="3.5" />
        <rect x="146" y="78" width="20" height="32" rx="8" fill="#5b6cff" stroke={K} strokeWidth="3.5" />
        <RestArm c={c} />
        <Arm d="M146 120 Q176 118 166 100" c={c} />
        <Hand x={164} y={98} c={c} />
        <Note x={178} y={56} cls="mk-up1" />
        <Note x={22} y={64} cls="mk-up2" />
      </>
    ),
  },
};
