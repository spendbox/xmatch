"use client";

// Design previews: masking the main photo with a masquerade mask over the face (the photo stays
// sharp), placed by the person when they upload it. Static sample screens (new-mask-1 … new-mask-4).
import { Camera, Check, ChevronLeft, Move, Search, Sparkles, UserRound, Users, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";

type MaskStyle = { id: string; name: string; base: string; shade: string; line: string; gem: string; feather: string[] };
const MASKS: MaskStyle[] = [
  { id: "gold", name: "Gold", base: "#f2b33d", shade: "#c98a1c", line: "#fff1c9", gem: "#e5484d", feather: ["#e5484d", "#f2b33d", "#7a1f3d"] },
  { id: "lace", name: "Black lace", base: "#1c1828", shade: "#000000", line: "#f2b33d", gem: "#f2b33d", feather: ["#1c1828", "#3a3448", "#f2b33d"] },
  { id: "pearl", name: "Pearl", base: "#fdfbf6", shade: "#e3d9c8", line: "#c98a1c", gem: "#5b3fd9", feather: ["#fdfbf6", "#ffd0dc", "#c98a1c"] },
  { id: "royal", name: "Royal", base: "#5b3fd9", shade: "#2b1d73", line: "#f2b33d", gem: "#7ad3a3", feather: ["#b49cff", "#5b3fd9", "#f2b33d"] },
  { id: "ruby", name: "Ruby", base: "#e5484d", shade: "#a3262b", line: "#ffd36b", gem: "#ffd36b", feather: ["#1c1828", "#e5484d", "#ffd36b"] },
  { id: "jade", name: "Jade", base: "#1f9d6b", shade: "#0f6644", line: "#ffd36b", gem: "#e5484d", feather: ["#7ad3a3", "#1f9d6b", "#ffd36b"] },
];

/** A full-face masquerade mask with feathers, drawn over the face in a 200×250 photo */
function FaceMask({ m, x = 100, y = 108, s = 1 }: { m: MaskStyle; x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(-100 -108)`}>
      {/* A fan of plumes sweeping up and out from one side */}
      {[
        { a: -95, l: 92, w: 11, c: 0 },
        { a: -78, l: 100, w: 12, c: 1 },
        { a: -62, l: 96, w: 12, c: 2 },
        { a: -46, l: 86, w: 11, c: 0 },
        { a: -30, l: 70, w: 10, c: 1 },
      ].map((f, i) => {
        const bx = 132;
        const by = 74;
        const r = (f.a * Math.PI) / 180;
        const tx = bx + Math.cos(r) * f.l;
        const ty = by + Math.sin(r) * f.l;
        const px = -Math.sin(r) * f.w;
        const py = Math.cos(r) * f.w;
        const mx = bx + Math.cos(r) * f.l * 0.55;
        const my = by + Math.sin(r) * f.l * 0.55;
        const d = `M${bx} ${by} Q${mx + px} ${my + py} ${tx} ${ty} Q${mx - px} ${my - py} ${bx} ${by}Z`;
        return (
          <g key={i}>
            <path d={d} fill={m.feather[f.c]} stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" />
            {/* Barbs */}
            {Array.from({ length: 7 }, (_, k) => {
              const t = 0.25 + k * 0.1;
              const cx = bx + Math.cos(r) * f.l * t;
              const cy = by + Math.sin(r) * f.l * t;
              const sw = f.w * (1 - Math.abs(t - 0.55) * 1.3);
              return <path key={k} d={`M${cx} ${cy} l${px * sw / f.w + Math.cos(r) * 5} ${py * sw / f.w + Math.sin(r) * 5} M${cx} ${cy} l${-px * sw / f.w + Math.cos(r) * 5} ${-py * sw / f.w + Math.sin(r) * 5}`} stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />;
            })}
            <path d={`M${bx} ${by} L${tx} ${ty}`} stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />
          </g>
        );
      })}
      {/* Shadow, then the mask */}
      <path d="M100 60 C132 60 150 80 150 106 C150 140 130 164 100 168 C70 164 50 140 50 106 C50 80 68 60 100 60 Z" fill={m.shade} transform="translate(2 4)" opacity="0.5" />
      <path d="M100 58 C132 58 148 78 148 104 C148 138 128 162 100 166 C72 162 52 138 52 104 C52 78 68 58 100 58 Z" fill={m.base} />
      <path d="M100 58 C132 58 148 78 148 104 C148 120 144 132 138 142 C140 110 126 86 100 82 C74 86 60 110 62 142 C56 132 52 120 52 104 C52 78 68 58 100 58 Z" fill="#fff" opacity="0.14" />
      {/* Filigree */}
      <g fill="none" stroke={m.line} strokeWidth="1.6" strokeLinecap="round">
        <path d="M100 66 C92 72 92 80 100 84 C108 80 108 72 100 66Z" />
        <path d="M64 92 C70 80 84 78 92 86" />
        <path d="M136 92 C130 80 116 78 108 86" />
        <path d="M60 116 C66 130 76 136 84 132 C80 126 74 124 70 128" />
        <path d="M140 116 C134 130 124 136 116 132 C120 126 126 124 130 128" />
        <path d="M84 146 C92 152 108 152 116 146" />
        <path d="M100 124 L100 138" />
      </g>
      {/* Eyes: dark, nothing shows through */}
      <path d="M66 104 Q80 90 95 104 Q80 114 66 104Z" fill="#120b2e" stroke={m.line} strokeWidth="1.6" />
      <path d="M134 104 Q120 90 105 104 Q120 114 134 104Z" fill="#120b2e" stroke={m.line} strokeWidth="1.6" />
      {/* Gems */}
      <circle cx="100" cy="75" r="4.5" fill={m.gem} stroke={m.line} strokeWidth="1.2" />
      <circle cx="98.5" cy="73.5" r="1.4" fill="#fff" opacity="0.8" />
      <circle cx="66" cy="96" r="2.2" fill={m.line} />
      <circle cx="134" cy="96" r="2.2" fill={m.line} />
      {/* Jewelled clasp where the plumes meet */}
      <circle cx="132" cy="74" r="7" fill={m.line} stroke={m.shade} strokeWidth="1.2" />
      <circle cx="132" cy="74" r="3.5" fill={m.gem} />
    </g>
  );
}

type Scene = { bg: React.ReactNode; skin: string; hair: "afro" | "long" | "braids" | "short"; hairColor: string; outfit: string; trim: string; extra?: React.ReactNode };

/** A stand-in for someone's real main photo: their scene, hair and outfit (the face is under the mask) */
function MaskedPhoto({ sc, m, id }: { sc: Scene; m: MaskStyle; id: string }) {
  return (
    <svg viewBox="0 0 200 250" className="block h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <clipPath id={`clip-${id}`}>
        <rect width="200" height="250" />
      </clipPath>
      <g clipPath={`url(#clip-${id})`}>
        {sc.bg}
        {/* Hair behind */}
        {sc.hair === "afro" && <circle cx="100" cy="100" r="62" fill={sc.hairColor} />}
        {sc.hair === "long" && <path d="M48 110 C44 60 70 40 100 40 C130 40 156 60 152 110 L160 200 L40 200 Z" fill={sc.hairColor} />}
        {sc.hair === "braids" && (
          <g fill={sc.hairColor}>
            <ellipse cx="100" cy="92" rx="52" ry="54" />
            {[56, 66, 134, 144].map((bx) => (
              <rect key={bx} x={bx - 5} y="110" width="10" height="100" rx="5" />
            ))}
          </g>
        )}
        {sc.hair === "short" && <ellipse cx="100" cy="88" rx="46" ry="48" fill={sc.hairColor} />}
        {/* Body */}
        <rect x="88" y="140" width="24" height="34" fill={sc.skin} />
        <path d="M24 250 C30 192 62 166 100 166 C138 166 170 192 176 250 Z" fill={sc.outfit} />
        <path d="M76 168 C86 186 114 186 124 168" fill="none" stroke={sc.trim} strokeWidth="4" />
        {sc.extra}
        <ellipse cx="100" cy="110" rx="34" ry="42" fill={sc.skin} />
        {/* The mask they placed */}
        <FaceMask m={m} />
        {/* Earrings peek out */}
        <circle cx="62" cy="134" r="4" fill="#f2b33d" />
        <circle cx="138" cy="134" r="4" fill="#f2b33d" />
      </g>
    </svg>
  );
}

const SCENES: Record<string, Scene> = {
  sunset: {
    bg: (
      <>
        <defs>
          <linearGradient id="bg-sunset" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b1f6b" />
            <stop offset="0.5" stopColor="#e5484d" />
            <stop offset="0.8" stopColor="#ffb36b" />
          </linearGradient>
        </defs>
        <rect width="200" height="250" fill="url(#bg-sunset)" />
        <circle cx="160" cy="170" r="26" fill="#ffd36b" />
        <rect y="186" width="200" height="64" fill="#ff8a3d" opacity="0.6" />
        <path d="M14 250 C18 200 24 170 34 140 M34 140 C20 134 6 140 0 150 M34 140 C30 124 18 116 8 116 M34 140 C46 128 60 126 70 130" stroke="#2a0f1e" strokeWidth="4" fill="none" />
      </>
    ),
    skin: "#8a5a3c",
    hair: "afro",
    hairColor: "#1c1020",
    outfit: "#e5484d",
    trim: "#ffd36b",
  },
  city: {
    bg: (
      <>
        <rect width="200" height="250" fill="#120b2e" />
        {[
          [8, 120, 30, 130],
          [40, 90, 26, 160],
          [150, 100, 24, 150],
          [176, 130, 30, 120],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="#2b1d73" />
            {Array.from({ length: 8 }, (_, k) => (
              <rect key={k} x={x + 4 + (k % 2) * 10} y={y + 8 + Math.floor(k / 2) * 16} width="5" height="7" fill={k % 3 ? "#ffd36b" : "#b44cff"} opacity="0.85" />
            ))}
          </g>
        ))}
        <circle cx="30" cy="40" r="3" fill="#fff" />
        <circle cx="170" cy="30" r="2" fill="#fff" />
        <circle cx="120" cy="20" r="2" fill="#fff" />
      </>
    ),
    skin: "#5e3a26",
    hair: "short",
    hairColor: "#0b0710",
    outfit: "#1c1828",
    trim: "#b44cff",
    extra: <path d="M70 180 L100 230 L130 180" fill="none" stroke="#f2b33d" strokeWidth="3" />,
  },
  garden: {
    bg: (
      <>
        <rect width="200" height="250" fill="#cfeedd" />
        {[
          [20, 40, 30, "#7ad3a3"],
          [170, 60, 36, "#1f9d6b"],
          [30, 190, 40, "#1f6b4a"],
          [180, 200, 34, "#7ad3a3"],
        ].map(([x, y, r, c], i) => (
          <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} />
        ))}
        {[
          [40, 70],
          [160, 110],
          [24, 150],
          [176, 160],
        ].map(([x, y], i) => (
          <g key={i}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx={x} cy={y - 6} rx="4" ry="7" fill="#ff8ab0" transform={`rotate(${a} ${x} ${y})`} />
            ))}
            <circle cx={x} cy={y} r="3.5" fill="#ffd36b" />
          </g>
        ))}
      </>
    ),
    skin: "#a8714d",
    hair: "braids",
    hairColor: "#2a1a12",
    outfit: "#fdfbf6",
    trim: "#1f9d6b",
  },
  studio: {
    bg: (
      <>
        <defs>
          <radialGradient id="bg-studio" cx="0.5" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#ffd36b" />
            <stop offset="1" stopColor="#c2410c" />
          </radialGradient>
        </defs>
        <rect width="200" height="250" fill="url(#bg-studio)" />
      </>
    ),
    skin: "#6b4430",
    hair: "long",
    hairColor: "#1c1020",
    outfit: "#1f4e9d",
    trim: "#f2b33d",
  },
};

function Nav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white/95 pt-2 pb-3 backdrop-blur">
      {[
        { l: "Home", i: <MaskIcon className="w-[26px]" /> },
        { l: "Meet", i: <Users size={22} /> },
        { l: "Chats", i: <Sparkles size={22} /> },
        { l: "Profile", i: <UserRound size={22} /> },
      ].map((x, i) => (
        <span key={x.l} className={"flex flex-1 flex-col items-center gap-1 text-[11.5px] font-semibold " + (i === 1 ? "text-brand" : "text-muted")}>
          {x.i}
          {x.l}
        </span>
      ))}
    </nav>
  );
}

// 1. Meet: real photos, sharp, with a mask over the face
function MeetMasked() {
  const people = [
    { a: "Velvet Owl", age: 26, place: "Lagos Island", sc: SCENES.sunset, m: MASKS[0], v: ["🌙 Night owl", "🍲 Foodie"], common: 4, online: true },
    { a: "Silver Hawk", age: 24, place: "Yaba", sc: SCENES.city, m: MASKS[3], v: ["🎧 Amapiano", "🏋️ Gym"], common: 2, online: true },
    { a: "Coral Lynx", age: 29, place: "Lekki", sc: SCENES.garden, m: MASKS[2], v: ["✈️ Travel", "📸 Photos"], common: 1, online: false },
    { a: "Amber Fox", age: 27, place: "Surulere", sc: SCENES.studio, m: MASKS[4], v: ["⚽ Football", "🍳 Cooks"], common: 3, online: true },
  ];
  return (
    <div className="min-h-dvh bg-cream px-4 pt-5 pb-28 text-ink">
      <h1 className="font-display text-[34px] font-black">Meet</h1>
      <p className="mt-1 text-[14px] text-muted">Real photos, faces masked. Unmask together to see who they are.</p>
      <span className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] text-muted ring-1 ring-line">
        <Search size={17} /> Search by name
      </span>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {people.map((x, i) => (
          <div key={x.a} className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_24px_-20px_rgba(20,10,40,0.45)] ring-1 ring-line">
            <span className="relative block aspect-[4/5]">
              <MaskedPhoto sc={x.sc} m={x.m} id={`meet${i}`} />
              {x.online && (
                <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-[#4ade80]" /> Online
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-10 pb-2.5 text-white">
                <span className="block text-[15.5px] font-bold">{x.a}</span>
                <span className="block text-[12px] text-white/85">
                  {x.age} · {x.place}
                </span>
              </span>
            </span>
            <span className="block px-3 pt-2.5 pb-3">
              <span className="flex flex-wrap gap-1">
                {x.v.map((v) => (
                  <span key={v} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink">
                    {v}
                  </span>
                ))}
              </span>
              <span className="mt-2 block text-[11.5px] font-bold text-[#8a5a00]">✨ {x.common} in common</span>
            </span>
          </div>
        ))}
      </div>
      <Nav />
    </div>
  );
}

// 2. Uploading your main photo: place your mask, pick its style
function PlaceYourMask() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#120b2e] text-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <ChevronLeft size={24} />
        <p className="text-[16px] font-bold">Mask your photo</p>
        <span className="text-[15px] font-bold text-gold">Done</span>
      </div>
      <p className="mt-1 px-6 text-center text-[13.5px] text-white/65">Cover your face. Everyone sees this until you both unmask.</p>

      <div className="relative mx-auto mt-4 aspect-[4/5] w-[78%] overflow-hidden rounded-[28px] ring-2 ring-white/15">
        <MaskedPhoto sc={SCENES.sunset} m={MASKS[0]} id="place" />
        {/* Handles: drag to move, pinch to size */}
        <span className="pointer-events-none absolute top-[14%] left-[22%] h-[56%] w-[56%] rounded-[50%] border-2 border-dashed border-white/80" />
        <span className="absolute top-[12%] right-[20%] grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow-lg">
          <Move size={16} />
        </span>
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold whitespace-nowrap">
          <Check size={14} /> Face fully covered
        </span>
      </div>
      <p className="mt-3 text-center text-[12.5px] text-white/55">Drag to move · pinch to resize</p>

      <p className="mt-5 px-5 text-[12px] font-extrabold tracking-[0.14em] text-white/60 uppercase">Pick your mask</p>
      <div className="no-scrollbar mt-2.5 flex gap-2.5 overflow-x-auto px-5 pb-2">
        {MASKS.map((m, i) => (
          <span key={m.id} className="flex shrink-0 flex-col items-center gap-1.5">
            <span className={"grid h-[72px] w-[72px] place-items-center rounded-[20px] bg-white/8 " + (i === 0 ? "ring-[3px] ring-gold" : "ring-1 ring-white/10")}>
              <svg viewBox="40 -30 200 200" className="h-[60px] w-[60px]" aria-hidden>
                <FaceMask m={m} />
              </svg>
            </span>
            <span className={"text-[11.5px] font-semibold " + (i === 0 ? "text-gold" : "text-white/70")}>{m.name}</span>
          </span>
        ))}
      </div>
      <div className="mt-auto px-5 pt-4 pb-6">
        <span className="block rounded-full bg-gold py-4 text-center text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">Save my masked photo</span>
      </div>
    </div>
  );
}

// 3. The pair pop-up with their masked photo
function PairPopMasked() {
  return (
    <div className="fixed inset-0 z-50 bg-[#120b2e]/70 backdrop-blur-[3px]">
      <div
        className="absolute inset-x-3 top-11 bottom-3 flex flex-col overflow-hidden rounded-[34px] text-center text-white shadow-[0_0_0_2px_rgba(242,179,61,0.55)]"
        style={{ background: "radial-gradient(100% 60% at 50% 30%, #5b3fd9 0%, #2b1d73 45%, #120b2e 100%)" }}
      >
        <div className="relative flex justify-center px-4 pt-4">
          <span className="h-1.5 w-10 rounded-full bg-white/25" />
          <span className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/12">
            <X size={20} />
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center px-6 pt-3">
          <p className="text-[12px] font-extrabold tracking-[0.2em] text-gold uppercase">Your pair is here</p>
          <span className="relative mt-5 block h-[250px] w-[200px] overflow-hidden rounded-[30px] shadow-[0_0_0_3px_#f2b33d,0_24px_50px_-16px_rgba(0,0,0,0.7)]">
            <MaskedPhoto sc={SCENES.sunset} m={MASKS[0]} id="pop" />
          </span>
          <p className="mt-5 font-display text-[36px] leading-none font-black">Velvet Owl</p>
          <p className="mt-2 text-[15px] text-white/75">26 · Woman · Lagos Island</p>
          <p className="mt-4 text-[12.5px] font-semibold text-white/60">You both</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {["Afrobeats", "Foodie", "Night owl", "Island person"].map((c) => (
              <span key={c} className="rounded-full bg-gold-soft px-2.5 py-1 text-[12.5px] font-semibold text-[#8a5a00]">
                ✓ {c}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-2 px-5 pt-4 pb-5">
          <span className="rounded-full bg-gold py-4 text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">
            Say hi <span className="text-[13px] font-bold text-ink/60">· 60 min to chat</span>
          </span>
          <span className="py-1 text-[13.5px] font-semibold text-white/60">Later</span>
        </div>
      </div>
    </div>
  );
}

// 4. Their other photos while masked: masked too, and you swipe through them
function ProfileMasked() {
  return (
    <div className="min-h-dvh bg-cream pb-10 text-ink">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <MaskedPhoto sc={SCENES.garden} m={MASKS[2]} id="prof" />
        <div className="absolute inset-x-3 top-3 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={"h-1 flex-1 rounded-full " + (i === 0 ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
        <span className="absolute top-6 left-3 grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur">
          <ChevronLeft size={22} />
        </span>
        <span className="absolute right-3 bottom-[88px] flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur">
          <Camera size={14} /> 3 photos, all masked
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pt-16 pb-5 text-white">
          <span className="block font-display text-[32px] leading-none font-black">Coral Lynx</span>
          <span className="mt-1.5 block text-[14px] text-white/85">29 · Woman · Lekki · online 5m ago</span>
        </span>
      </div>
      <div className="px-5 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {["✈️ Traveller", "📸 Photos", "🌱 Plants", "☕ Coffee dates"].map((v) => (
            <span key={v} className="rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand-ink">
              {v}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">Things about me</p>
        <p className="mt-2 rounded-[18px] bg-white px-3.5 py-3 text-[14.5px] ring-1 ring-line">I&apos;ve been to 11 countries and still get lost in Lekki</p>
        <span className="mt-5 block rounded-full bg-brand py-3.5 text-center text-[16px] font-bold text-white">Say hi masked</span>
      </div>
    </div>
  );
}

export function MaskPhotoMock({ step }: { step: number }) {
  const screens = [MeetMasked, PlaceYourMask, PairPopMasked, ProfileMasked];
  const S = screens[step - 1] ?? MeetMasked;
  return <S />;
}
