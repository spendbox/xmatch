/** The sticker button: Masky's face, winking (instead of a plain outline icon) */
export function StickerIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="22 14 160 168" width={size} height={size} className={className} aria-hidden>
      <path d="M100 40 C141 40 160 74 158 116 C156 156 133 178 100 178 C67 178 44 156 42 116 C40 74 59 40 100 40 Z" fill="#7a5cf0" stroke="#1c1828" strokeWidth="9" />
      <ellipse cx="76" cy="62" rx="15" ry="8" fill="#ffffff" opacity="0.4" transform="rotate(-28 76 62)" />
      <path
        d="M55 78.8C55 70.4 60.6 66.2 67.6 66.2c9.8 0 18.2 5.6 29.4 5.6s19.6-5.6 29.4-5.6c7 0 12.6 4.2 12.6 12.6 0 18.2-11.2 33.6-25.2 33.6-9.8 0-11.2-9.8-16.8-9.8s-7 9.8-16.8 9.8C66.2 112.4 55 97 55 78.8z"
        fill="#ffffff"
        stroke="#1c1828"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <ellipse cx="80" cy="86" rx="10" ry="7" fill="#1c1828" />
      <path d="M110 88 q9 -9 18 0" stroke="#1c1828" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M82 128 q18 20 36 0 z" fill="#1c1828" stroke="#1c1828" strokeWidth="5" strokeLinejoin="round" />
      <path d="M150 22 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 l12 -5 z" fill="#ffb02e" stroke="#1c1828" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}
