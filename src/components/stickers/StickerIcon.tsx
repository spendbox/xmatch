/** The sticker and scribble button: a wiggly line, in the same style as the other icons */
export function StickerIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 14.5c1.6-4.6 3.6-6.4 4.8-4.6 1.3 1.9-1.2 6.2.4 6.6 1.7.4 2.7-7.6 4.9-7.4 2.1.2-.2 7.3 1.9 7.6 1.8.3 2.6-4.4 4.2-5.4 1-.6 1.5.3 1.8 1.2" />
    </svg>
  );
}
