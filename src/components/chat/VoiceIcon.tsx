import type { VoiceStyle } from "@/lib/voiceDisguise";

/** Drawn icons for the voice choices (no emojis): your voice, a low wave, a high wave, a robot */
export function VoiceIcon({ style, size = 26, className }: { style: VoiceStyle; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 32 32", fill: "none", className, "aria-hidden": true } as const;
  if (style === "normal")
    return (
      <svg {...common}>
        <rect x="11" y="3" width="10" height="17" rx="5" fill="currentColor" />
        <path d="M6.5 14.5a9.5 9.5 0 0 0 19 0M16 24v5M11 29h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  if (style === "deep")
    return (
      <svg {...common}>
        <path d="M2 16c3.5-10 7-10 10.5 0s7 10 10.5 0 5-5 7-4" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M5 27h22" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity=".45" />
      </svg>
    );
  if (style === "light")
    return (
      <svg {...common}>
        <path d="M2 16c1.5-5 3-5 4.5 0s3 5 4.5 0 3-5 4.5 0 3 5 4.5 0 3-5 4.5 0 3 5 4.5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="25" cy="6" r="2.4" fill="currentColor" opacity=".55" />
        <circle cx="29" cy="10" r="1.4" fill="currentColor" opacity=".4" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M16 3v4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="3" r="2" fill="currentColor" />
      <rect x="5" y="8" width="22" height="17" rx="5" fill="currentColor" />
      <circle cx="12" cy="16" r="2.6" fill="var(--color-surface, #fff)" />
      <circle cx="20" cy="16" r="2.6" fill="var(--color-surface, #fff)" />
      <path d="M12 21.5h8" stroke="var(--color-surface, #fff)" strokeWidth="2" strokeLinecap="round" />
      <path d="M2.5 14v6M29.5 14v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M10 29h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}
