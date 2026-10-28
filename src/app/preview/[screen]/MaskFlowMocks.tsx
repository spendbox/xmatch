"use client";

// Design previews: masked photos across Dashpad — onboarding, the update pop-up for people who
// haven't masked yet, editing your photos, and someone else's profile. Static screens
// (new-mm-1 … new-mm-8); not wired up. The people are drawings standing in for real photos.
import { useMemo } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Eye, Lock, Pencil, Plus, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { CATS, MASKS, maskUrl } from "@/lib/masks";
import { MASKS as OLD_MASKS, MaskedPhoto, SCENES, type Scene } from "./MaskPhotoMocks";

const HERO = "radial-gradient(120% 90% at 85% 0%, #7a5cf0 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, #2b1d73 0%, transparent 60%), #4730b3";

type Shot = { scene: Scene | null; mask?: string; color?: string | null; trim?: string };

/** A photo: the person (a drawing standing in for a real photo) with their chosen mask over the face */
function Photo({ shot, id, className = "", rounded = "rounded-[18px]" }: { shot: Shot; id: string; className?: string; rounded?: string }) {
  const url = useMemo(() => (shot.mask ? maskUrl(shot.mask, shot.color ?? null, shot.trim ?? "gold") : null), [shot.mask, shot.color, shot.trim]);
  return (
    <span className={"relative block aspect-[4/5] overflow-hidden " + rounded + " " + className}>
      {shot.scene ? <MaskedPhoto sc={shot.scene} m={OLD_MASKS[0]} id={id} bare /> : <NoFaceShot />}
      {/* Head at (100,110) in a 200×250 photo; the mask's face oval sized to cover it */}
      {url && <img src={url} alt="" className="pointer-events-none absolute max-w-none" style={{ left: "-0.5%", top: "-8.2%", width: "101%" }} />}
    </span>
  );
}

/** A photo with no face in it: a view at sunset */
function NoFaceShot() {
  return (
    <svg viewBox="0 0 200 250" className="block h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="nf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1d73" />
          <stop offset="0.55" stopColor="#ff8a3d" />
          <stop offset="0.75" stopColor="#ffd36b" />
        </linearGradient>
      </defs>
      <rect width="200" height="250" fill="url(#nf-sky)" />
      <circle cx="120" cy="160" r="26" fill="#fff1c9" />
      <rect y="172" width="200" height="78" fill="#1d4e89" />
      {[184, 196, 210, 226].map((y, i) => (
        <rect key={y} x={70 + i * 6} y={y} width={100 - i * 16} height="3" rx="1.5" fill="#ffd36b" opacity={0.7 - i * 0.12} />
      ))}
      <path d="M20 250 C24 200 30 170 40 140 M40 140 C26 134 12 140 6 150 M40 140 C36 124 24 116 14 116 M40 140 C52 128 66 126 76 130" stroke="#120b2e" strokeWidth="4" fill="none" />
    </svg>
  );
}

const ME: Shot[] = [
  { scene: SCENES.sunset, mask: "venetian" },
  { scene: SCENES.studio, mask: "fox" },
  { scene: SCENES.garden, mask: "hearteyes" },
  { scene: null },
];

function Progress({ step, of }: { step: number; of: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={"h-1.5 flex-1 rounded-full " + (i < step ? "bg-brand" : "bg-line")} />
      ))}
    </div>
  );
}

function MaskChip({ id }: { id: string }) {
  const m = MASKS.find((x) => x.id === id);
  return (
    <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur">
      <MaskIcon className="w-3.5" /> {m?.name}
    </span>
  );
}

// 1. Onboarding: add your photos (each gets its own mask)
function OnboardingPhotos() {
  return (
    <div className="flex min-h-dvh flex-col bg-cream px-5 pt-5 pb-6 text-ink">
      <div className="flex items-center gap-3">
        <ChevronLeft size={24} />
        <div className="flex-1">
          <Progress step={3} of={5} />
        </div>
      </div>
      <p className="mt-6 text-[12px] font-extrabold tracking-[0.14em] text-brand uppercase">Step 3 · Photos</p>
      <h1 className="mt-1 font-display text-[30px] leading-[1.1] font-black">Add photos, then mask them</h1>
      <p className="mt-2 text-[14.5px] text-muted">Everyone sees you masked. Your face only shows when you and someone both choose to unmask.</p>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {ME.slice(0, 3).map((s, i) => (
          <span key={i} className="relative">
            <Photo shot={s} id={`ob${i}`} />
            {s.mask && <MaskChip id={s.mask} />}
            {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-extrabold text-ink">Main</span>}
            <span className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-white text-ink shadow">
              <Pencil size={13} />
            </span>
          </span>
        ))}
        {[0, 1, 2].map((i) => (
          <span key={i} className="grid aspect-[4/5] place-items-center rounded-[18px] border-2 border-dashed border-line-strong text-muted">
            <Plus size={22} />
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-[20px] bg-brand-soft p-3.5 text-[13.5px] text-brand-ink">
        <MaskIcon className="mt-0.5 w-7 shrink-0" />
        <span>
          <b>Masks are free.</b> We hide your face in each photo. Change the mask any time.
        </span>
      </div>
      <span className="mt-auto block rounded-full bg-brand py-4 text-center text-[16px] font-bold text-white">Continue</span>
    </div>
  );
}

const SWATCHES = ["#e8b143", "#1d1a26", "#f7f0e6", "#d92f3a", "#ff3fa4", "#b44cff", "#5b3fd9", "#4f86f7", "#0f8a8a", "#1f9d6b", "#f2741f"];

// 2. The mask studio (onboarding, the update, and Profile all use it)
function Studio() {
  const shown = ["fox", "hearteyes", "venetian", "cat", "shades", "kitsune", "unicorn", "owl"];
  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      <div className="flex items-center justify-between px-4 pt-4">
        <X size={22} />
        <p className="text-[15px] font-bold">Mask photo 2 of 3</p>
        <span className="text-[14px] font-bold text-brand">Skip</span>
      </div>
      <div className="relative mx-auto mt-3 w-[72%]">
        <Photo shot={{ scene: SCENES.studio, mask: "fox" }} id="studio" rounded="rounded-[26px]" className="shadow-[0_20px_40px_-20px_rgba(20,10,40,0.6)]" />
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[12px] font-bold whitespace-nowrap text-white">
          <Check size={14} /> Face fully covered
        </span>
      </div>
      <p className="mt-2 text-center text-[12px] text-muted">Drag to move · pinch to resize</p>

      <div className="mt-3 flex-1 rounded-t-[28px] bg-white px-4 pt-4 pb-5 shadow-[0_-10px_30px_-20px_rgba(20,10,40,0.4)]">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {CATS.map(([id, label], i) => (
            <span key={id} className={"shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold " + (i === 0 ? "bg-ink text-white" : "bg-cream text-muted")}>
              {label}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {shown.map((id, i) => (
            <span key={id} className={"grid aspect-square place-items-center rounded-[16px] bg-cream " + (i === 0 ? "ring-[2.5px] ring-brand" : "")}>
              <img src={maskUrl(id)} alt="" className="w-[88%]" />
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
            {SWATCHES.map((c, i) => (
              <span key={c} className={"h-7 w-7 shrink-0 rounded-full " + (i === 10 ? "ring-2 ring-brand ring-offset-2" : "ring-1 ring-black/10")} style={{ background: c }} />
            ))}
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-[12.5px] font-bold">
            <SlidersHorizontal size={14} /> Adjust
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
          <span className="rounded-full bg-cream py-3.5 text-center text-[14px] font-bold">Use on all</span>
          <span className="flex items-center justify-center gap-1 rounded-full bg-brand py-3.5 text-[15px] font-bold text-white">
            Next photo <ChevronRight size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}

// 3. Onboarding: all masked, see how others see you
function OnboardingDone() {
  return (
    <div className="flex min-h-dvh flex-col bg-cream px-5 pt-5 pb-6 text-ink">
      <Progress step={3} of={5} />
      <div className="relative mx-auto mt-10 h-[230px] w-full max-w-[320px]">
        {ME.slice(0, 3).map((s, i) => (
          <span key={i} className="absolute top-0 w-[46%]" style={{ left: `${[2, 27, 52][i]}%`, transform: `rotate(${[-9, 0, 9][i]}deg) translateY(${i === 1 ? -6 : 10}px)`, zIndex: i === 1 ? 2 : 1 }}>
            <Photo shot={s} id={`done${i}`} className="shadow-[0_16px_30px_-14px_rgba(20,10,40,0.6)] ring-4 ring-white" />
          </span>
        ))}
      </div>
      <h1 className="mt-4 text-center font-display text-[30px] leading-[1.1] font-black">You&apos;re masked up</h1>
      <p className="mt-2 text-center text-[14.5px] text-muted">This is how everyone sees you. Your face stays hidden until you and someone both choose to unmask.</p>
      <div className="mt-5 grid gap-2">
        {[
          ["Your masks, your choice", "Change any photo's mask in Profile, any time"],
          ["Faces show only together", "Unmasking happens when you both say yes"],
        ].map(([a, b]) => (
          <div key={a} className="flex items-center gap-3 rounded-[18px] bg-white p-3 ring-1 ring-line">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-soft text-mint">
              <Check size={18} />
            </span>
            <span className="text-[13.5px]">
              <b className="block text-[14.5px]">{a}</b>
              <span className="text-muted">{b}</span>
            </span>
          </div>
        ))}
      </div>
      <span className="mt-auto block rounded-full bg-brand py-4 text-center text-[16px] font-bold text-white">Continue</span>
    </div>
  );
}

/** Behind the pop-ups: a faded Home */
function HomeBehind() {
  return (
    <div className="min-h-dvh bg-cream px-4 pt-4 text-ink">
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-full bg-gradient-to-br from-[#ff9a6b] to-[#c2410c]" />
        <span className="flex-1">
          <span className="block text-[13px] text-muted">Good evening</span>
          <span className="block text-[19px] font-semibold">Tolu</span>
        </span>
      </div>
      <div className="mt-6 h-20 rounded-[24px]" style={{ background: HERO }} />
      <div className="mt-3 h-20 rounded-[24px] bg-[#17663f]" />
      <div className="mt-3 h-40 rounded-[24px] bg-white" />
    </div>
  );
}

// 4. The update pop-up: for people who haven't masked their photos yet
function UpdatePop() {
  return (
    <div className="relative">
      <HomeBehind />
      <div className="fixed inset-0 z-50 bg-[#120b2e]/65 backdrop-blur-[3px]">
        <div className="absolute inset-x-3 top-10 bottom-3 flex flex-col overflow-hidden rounded-[34px] text-white shadow-[0_0_0_2px_rgba(242,179,61,0.55)]" style={{ background: "radial-gradient(100% 60% at 50% 25%, #5b3fd9 0%, #2b1d73 45%, #120b2e 100%)" }}>
          <div className="relative flex justify-center px-4 pt-4">
            <span className="h-1.5 w-10 rounded-full bg-white/25" />
          </div>
          <div className="flex flex-1 flex-col items-center px-6 pt-2 text-center">
            <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-ink uppercase">New</span>
            <h2 className="mt-3 font-display text-[32px] leading-[1.05] font-black">Mask your photos</h2>
            <p className="mt-2 text-[14.5px] text-white/75">Dashpad is masked now. People see your style, not your face, until you both choose to unmask.</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="w-[120px]">
                <Photo shot={{ scene: SCENES.sunset }} id="up-before" rounded="rounded-[20px]" className="opacity-80" />
                <span className="mt-1.5 block text-[11.5px] text-white/60">Your photo</span>
              </span>
              <ChevronRight className="text-gold" />
              <span className="w-[120px]">
                <Photo shot={{ scene: SCENES.sunset, mask: "venetian" }} id="up-after" rounded="rounded-[20px]" className="shadow-[0_0_0_3px_#f2b33d]" />
                <span className="mt-1.5 block text-[11.5px] font-bold text-gold">What people see</span>
              </span>
            </div>
            <div className="mt-5 grid w-full gap-2 text-left text-[13.5px]">
              {["Free. 61 masks, fun to fancy", "A different mask for each photo", "We place them for you in seconds"].map((t) => (
                <span key={t} className="flex items-center gap-2.5 rounded-[14px] bg-white/10 px-3 py-2.5">
                  <Check size={16} className="shrink-0 text-gold" /> {t}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5 px-5 pt-4 pb-5 text-center">
            <span className="rounded-full bg-gold py-4 text-[17px] font-extrabold text-ink shadow-[0_6px_0_#b9831e]">Mask my photos</span>
            <span className="py-1.5 text-[13.5px] font-semibold text-white/60">Later</span>
            <span className="text-[11.5px] text-white/45">Until you do, people see a plain mask instead of your photos.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 5. The update: every photo already masked, check them
function UpdateReview() {
  const shots: (Shot & { note?: string })[] = [
    { scene: SCENES.sunset, mask: "venetian" },
    { scene: SCENES.studio, mask: "fox" },
    { scene: SCENES.garden, mask: "flowers" },
    { scene: null, note: "No face found" },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-cream px-5 pt-5 pb-6 text-ink">
      <div className="flex items-center justify-between">
        <X size={22} />
        <span className="text-[14px] font-bold text-brand">Shuffle masks</span>
      </div>
      <h1 className="mt-4 font-display text-[28px] leading-[1.1] font-black">We masked your 4 photos</h1>
      <p className="mt-1.5 text-[14px] text-muted">Tap any photo to change its mask, colour or position.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {shots.map((s, i) => (
          <span key={i} className="relative">
            <Photo shot={s} id={`rv${i}`} rounded="rounded-[22px]" />
            {i === 0 && <span className="absolute top-2.5 left-2.5 rounded-full bg-gold px-2 py-0.5 text-[10.5px] font-extrabold text-ink">Main</span>}
            {s.mask ? (
              <>
                <MaskChip id={s.mask} />
                <span className="absolute top-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-full bg-mint text-white">
                  <Check size={14} />
                </span>
              </>
            ) : (
              <span className="absolute inset-x-2 bottom-2 rounded-[12px] bg-white/95 px-2.5 py-1.5 text-[11.5px] leading-snug text-ink">
                <b>No face found.</b> Is your face in it? <span className="font-bold text-brand">Check</span>
              </span>
            )}
          </span>
        ))}
      </div>
      <span className="mt-auto block rounded-full bg-brand py-4 text-center text-[16px] font-bold text-white">Looks good</span>
    </div>
  );
}

// 6. Profile: your photos, each with its own mask
function MyPhotos() {
  return (
    <div className="min-h-dvh bg-cream px-5 pt-5 pb-10 text-ink">
      <div className="flex items-center gap-3">
        <ChevronLeft size={24} />
        <h1 className="flex-1 text-[19px] font-bold">Your photos</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold ring-1 ring-line">
          <Eye size={15} /> As others see
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {ME.map((s, i) => (
          <div key={i} className="overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
            <span className="relative block">
              <Photo shot={s} id={`mine${i}`} rounded="rounded-none" />
              {i === 0 && <span className="absolute top-2.5 left-2.5 rounded-full bg-gold px-2 py-0.5 text-[10.5px] font-extrabold text-ink">Main</span>}
            </span>
            <span className="flex items-center gap-2 px-3 py-2.5">
              {s.mask ? <img src={maskUrl(s.mask)} alt="" className="h-7 w-7" /> : <Camera size={18} className="text-muted" />}
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{s.mask ? MASKS.find((m) => m.id === s.mask)?.name : "No face"}</span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-label={s.mask ? "Change mask" : "Add a mask"}>
                <Pencil size={14} />
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 rounded-[16px] bg-brand-soft px-3.5 py-3 text-[13px] text-brand-ink">
        <Lock size={16} className="shrink-0" /> Your unmasked photos only go to people you&apos;ve unmasked with.
      </p>
    </div>
  );
}

const THEM: Shot[] = [
  { scene: SCENES.garden, mask: "kitsune", color: "#5b3fd9" },
  { scene: SCENES.city, mask: "cat" },
  { scene: SCENES.sunset, mask: "butterfly", color: "#ff3fa4" },
  { scene: null },
];

function TheirTop({ shot }: { shot: Shot }) {
  return (
    <div className="relative">
      <Photo shot={shot} id="their-main" rounded="rounded-none" />
      <div className="absolute inset-x-3 top-3 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={"h-1 flex-1 rounded-full " + (i === 0 ? "bg-white" : "bg-white/40")} />
        ))}
      </div>
      <span className="absolute top-6 left-3 grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur">
        <ChevronLeft size={22} />
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pt-16 pb-4 text-white">
        <span className="block font-display text-[30px] leading-none font-black">Coral Lynx</span>
        <span className="mt-1.5 block text-[14px] text-white/85">25 · Woman · Lekki · online now</span>
      </span>
    </div>
  );
}

// 7. Someone's profile: their main photo; more photos with Keys (still masked)
function TheirProfile() {
  return (
    <div className="min-h-dvh bg-cream pb-10 text-ink">
      <TheirTop shot={THEM[0]} />
      <div className="px-5 pt-4">
        <p className="text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">More photos · 3</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {THEM.slice(1).map((s, i) => (
            <span key={i} className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[16px] bg-[#2b1d73]">
              <img src={maskUrl(s.mask ?? "blank", s.color ?? null)} alt="" className="w-[70%] opacity-25" />
              <Lock size={18} className="absolute text-white/85" />
            </span>
          ))}
        </div>
        <span className="mt-3 flex items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-[15px] font-extrabold text-ink shadow-[0_5px_0_#b9831e]">
          See 3 more photos <span className="inline-flex items-center gap-0.5 text-[13px]"><KeyCoin size={16} /> 5</span>
        </span>
        <p className="mt-2.5 text-center text-[12.5px] text-muted">They&apos;ll still be masked. Faces only show when you both unmask.</p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {["🌙 Night owl", "📸 Photos", "☕ Coffee dates", "✈️ Travel"].map((v) => (
            <span key={v} className="rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand-ink">
              {v}
            </span>
          ))}
        </div>
        <span className="mt-5 block rounded-full bg-brand py-3.5 text-center text-[15px] font-bold text-white">Say hi masked</span>
      </div>
    </div>
  );
}

// 8. After paying: every photo, each in its own mask
function TheirPhotosOpen() {
  return (
    <div className="min-h-dvh bg-cream pb-10 text-ink">
      <TheirTop shot={THEM[0]} />
      <div className="px-5 pt-4">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.12em] text-muted uppercase">
          <Sparkles size={14} className="text-gold" /> More photos · unlocked
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {THEM.slice(1).map((s, i) => (
            <span key={i} className="relative">
              <Photo shot={s} id={`open${i}`} rounded="rounded-[16px]" />
              {s.mask && <MaskChip id={s.mask} />}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-[20px] p-3.5 text-white" style={{ background: HERO }}>
          <span className="flex -space-x-2">
            <img src={maskUrl("fox")} alt="" className="h-9 w-9 rounded-full bg-white/15 p-0.5 ring-2 ring-white/70" />
            <img src={maskUrl("kitsune", "#5b3fd9")} alt="" className="h-9 w-9 rounded-full bg-white/15 p-0.5 ring-2 ring-white/70" />
          </span>
          <span className="min-w-0 flex-1 text-[13px] leading-snug">
            <b>Want to see her face?</b>
            <br />
            <span className="text-white/75">Chat, then unmask together. It only happens when you both say yes.</span>
          </span>
        </div>
        <span className="mt-4 block rounded-full bg-brand py-3.5 text-center text-[15px] font-bold text-white">Say hi masked</span>
      </div>
    </div>
  );
}

export function MaskFlowMock({ step }: { step: number }) {
  const screens = [OnboardingPhotos, Studio, OnboardingDone, UpdatePop, UpdateReview, MyPhotos, TheirProfile, TheirPhotosOpen];
  const S = screens[step - 1] ?? OnboardingPhotos;
  return <S />;
}
