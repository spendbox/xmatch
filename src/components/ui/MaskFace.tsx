import { nameColor } from "@/lib/eventSpace";
import type { Gender } from "@/lib/types";

/** Mask shapes for someone whose photo won't show. `c` is the colour behind the mask, used for the eye holes and details. */
const MASKS: ((c: string) => React.ReactNode)[] = [
  // Classic masquerade
  (c) => (
    <>
      <path d="M2 22C2 16 6 13 11 13c7 0 13 4 21 4s14-4 21-4c5 0 9 3 9 9 0 13-8 24-18 24-7 0-8-7-12-7s-5 7-12 7C10 46 2 35 2 22z" fill="currentColor" />
      <ellipse cx="18" cy="27" rx="7" ry="4.6" fill={c} />
      <ellipse cx="46" cy="27" rx="7" ry="4.6" fill={c} />
    </>
  ),
  // Cat, with ears
  (c) => (
    <>
      <path d="M4 26 7 8l13 9c4-1 8 1 12 1s8-2 12-1l13-9 3 18c1 11-6 20-16 20-6 0-8-6-12-6s-6 6-12 6C10 46 3 37 4 26z" fill="currentColor" />
      <path d="M11 29c3-4 9-5 13-2-3 4-9 5-13 2z" fill={c} />
      <path d="M53 29c-3-4-9-5-13-2 3 4 9 5 13 2z" fill={c} />
      <path d="M10 13l2 6 4-3zM54 13l-2 6-4-3z" fill={c} opacity=".5" />
    </>
  ),
  // Butterfly wings
  (c) => (
    <>
      <path d="M1 10c12 0 22 5 31 10 9-5 19-10 31-10 0 18-6 34-19 34-6 0-9-6-12-6s-6 6-12 6C7 44 1 28 1 10z" fill="currentColor" />
      <ellipse cx="18" cy="26" rx="7.5" ry="4.5" transform="rotate(14 18 26)" fill={c} />
      <ellipse cx="46" cy="26" rx="7.5" ry="4.5" transform="rotate(-14 46 26)" fill={c} />
      <circle cx="8" cy="17" r="1.6" fill={c} />
      <circle cx="56" cy="17" r="1.6" fill={c} />
      <circle cx="11" cy="35" r="1.3" fill={c} />
      <circle cx="53" cy="35" r="1.3" fill={c} />
    </>
  ),
  // Feathered, with plumes on one side
  (c) => (
    <>
      <path d="M45 16c-2-6-1-11 2-15 3 5 3 11 0 16zM48 17c-1-7 2-13 8-16 1 6-2 12-6 17zM51 17c2-6 7-11 12-12-1 6-6 11-11 14z" fill="currentColor" opacity=".8" />
      <path d="M2 24c0-6 4-8 9-8 7 0 13 3 21 3s14-3 21-3c5 0 9 2 9 8 0 12-8 21-18 21-7 0-8-6-12-6s-5 6-12 6C10 45 2 36 2 24z" fill="currentColor" />
      <ellipse cx="18" cy="28" rx="7" ry="4.4" fill={c} />
      <ellipse cx="46" cy="28" rx="7" ry="4.4" fill={c} />
      <circle cx="32" cy="22" r="2" fill={c} />
    </>
  ),
  // Simple domino band
  (c) => (
    <>
      <path d="M3 22c0-5 4-8 9-8h40c5 0 9 3 9 8v8c0 8-6 12-13 12-6 0-10-5-16-5s-10 5-16 5C9 42 3 38 3 30z" fill="currentColor" />
      <circle cx="19" cy="27" r="5.5" fill={c} />
      <circle cx="45" cy="27" r="5.5" fill={c} />
    </>
  ),
  // Jester, with points along the bottom
  (c) => (
    <>
      <path d="M2 20C2 15 6 13 11 13c8 0 13 3 21 3s13-3 21-3c5 0 9 2 9 7 0 6-2 11-5 15L54 45 48 39 43 45 39 38 35 42 32 38 29 42 25 38 21 45 16 39 10 45 7 35C4 31 2 26 2 20z" fill="currentColor" />
      <path d="M11 25c3-3 10-3 13 0-3 3-10 3-13 0zM40 25c3-3 10-3 13 0-3 3-10 3-13 0z" fill={c} />
      <path d="M32 18v6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // Star eyes
  (c) => (
    <>
      <path d="M2 22C2 16 6 13 11 13c7 0 13 4 21 4s14-4 21-4c5 0 9 3 9 9 0 13-8 24-18 24-7 0-8-7-12-7s-5 7-12 7C10 46 2 35 2 22z" fill="currentColor" />
      <path d="m18 20 2 4.6 5 .5-3.8 3.3 1.1 4.9-4.3-2.6-4.3 2.6 1.1-4.9-3.8-3.3 5-.5z" fill={c} />
      <path d="m46 20 2 4.6 5 .5-3.8 3.3 1.1 4.9-4.3-2.6-4.3 2.6 1.1-4.9-3.8-3.3 5-.5z" fill={c} />
    </>
  ),
  // Crowned
  (c) => (
    <>
      <path d="M24 17 26 6l6 7 6-7 2 11z" fill="currentColor" />
      <circle cx="26" cy="5" r="1.8" fill="currentColor" />
      <circle cx="32" cy="11" r="1.8" fill="currentColor" />
      <circle cx="38" cy="5" r="1.8" fill="currentColor" />
      <path d="M2 24c0-6 4-9 9-9 7 0 13 3 21 3s14-3 21-3c5 0 9 3 9 9 0 12-8 21-18 21-7 0-8-6-12-6s-5 6-12 6C10 45 2 36 2 24z" fill="currentColor" />
      <ellipse cx="18" cy="28" rx="7" ry="4.6" fill={c} />
      <ellipse cx="46" cy="28" rx="7" ry="4.6" fill={c} />
    </>
  ),
];

/** A stable number from someone's id, so they always get the same mask */
function pick(id: string, n: number) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 37 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

/** Which masks each gender gets (by place in MASKS); anyone else can get any of them */
const BY_GENDER: Partial<Record<Gender, number[]>> = {
  man: [0, 4, 5, 7], // classic, domino, jester, crowned
  woman: [1, 2, 3, 6], // cat, butterfly, feathered, star eyes
};

/** A mask that suits their gender, on a colour, both picked from their id: stands in for a photo that won't load */
export function MaskFace({ id, gender, className }: { id: string; gender?: Gender | null; className?: string }) {
  const color = nameColor(id);
  const choices = (gender && BY_GENDER[gender]) || MASKS.map((_, i) => i);
  return (
    <div className={className} style={{ background: color }}>
      <svg viewBox="0 0 64 48" className="w-1/2 text-white/90" aria-hidden="true">
        {MASKS[choices[pick(id, choices.length)]](color)}
      </svg>
    </div>
  );
}
