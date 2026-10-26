/** The sticker button: Masky's face as a simple outline, in the same style as the other icons */
export function StickerIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="22 28 156 156" width={size} height={size} className={className} fill="none" aria-hidden>
      <path d="M100 40 C141 40 160 74 158 116 C156 156 133 178 100 178 C67 178 44 156 42 116 C40 74 59 40 100 40 Z" stroke="currentColor" strokeWidth="13" />
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M58 80C58 72 63 68 70 68c9.5 0 17.5 5.4 30 5.4s20.5-5.4 30-5.4c7 0 12 4 12 12 0 17.5-10.5 32-24 32-9.5 0-11-9.4-18-9.4s-8.5 9.4-18 9.4C68.5 112 58 97.5 58 80z M70 86a10 6.6 0 1 0 20 0a10 6.6 0 1 0 -20 0z M110 86a10 6.6 0 1 0 20 0a10 6.6 0 1 0 -20 0z"
      />
      <path d="M84 138 q16 14 32 0" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}
