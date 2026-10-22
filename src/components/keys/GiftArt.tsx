import { useId } from "react";

/** Hand-drawn gift illustrations (instead of plain emojis). */
export function GiftArt({ id, size = 48, className }: { id: string; size?: number; className?: string }) {
  const u = useId().replace(/:/g, "");
  const g = (name: string) => `${name}-${u}`;
  const url = (name: string) => `url(#${g(name)})`;
  const common = { width: size, height: size, viewBox: "0 0 64 64", className, "aria-hidden": true } as const;

  switch (id) {
    case "fire":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("flame")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb02e" />
              <stop offset=".6" stopColor="#ff6a2b" />
              <stop offset="1" stopColor="#e5484d" />
            </linearGradient>
            <linearGradient id={g("core")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff3b0" />
              <stop offset="1" stopColor="#ffc93d" />
            </linearGradient>
          </defs>
          <path d="M32 4c3 10 15 16 15 31 0 12-7 22-15 22S17 47 17 35c0-8 4-12 7-16 1 5 3 8 6 9-2-9 0-17 2-24Z" fill={url("flame")} />
          <path d="M32 30c2 6 8 9 8 16 0 6-4 10-8 10s-8-4-8-10c0-4 2-6 4-8 1 3 2 4 4 5-1-5-1-9 0-13Z" fill={url("core")} />
          <path d="M23 26c-2 3-3 6-3 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".45" />
        </svg>
      );
    case "clap":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("hand")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffd27a" />
              <stop offset="1" stopColor="#f2a33d" />
            </linearGradient>
          </defs>
          <path d="M24 56c-8-3-13-10-13-19l1-14c0-2 3-3 4-1l3 9 1-19c0-2 3-3 4-1l2 15 2-19c0-2 3-2 4 0l1 19 3-15c1-2 4-1 4 1l-1 17c3-3 6-5 8-4 2 1 1 3 0 5l-8 12c-3 6-8 13-15 14Z" fill={url("hand")} />
          <path d="M22 38c2-2 5-2 7 0" stroke="#c97a1a" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".6" />
          <path d="M48 10l2-5M54 16l5-2M44 6l-1-4" stroke="#5b3fd9" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M8 14l-3-3M12 9l-1-4" stroke="#e5484d" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "jollof":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("rice")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff8a3d" />
              <stop offset="1" stopColor="#e0531f" />
            </linearGradient>
            <linearGradient id={g("plate")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#e7e1f5" />
            </linearGradient>
          </defs>
          <path d="M14 22c2-4 6-5 8-3M32 16c2-4 6-4 7-1M44 21c2-3 5-3 6 0" stroke="#c9c2dc" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="32" cy="42" rx="27" ry="12" fill={url("plate")} />
          <ellipse cx="32" cy="40" rx="21" ry="8" fill="#efeaf9" />
          <path d="M13 39c0-9 9-15 19-15s19 6 19 15c-5 3-12 4-19 4s-14-1-19-4Z" fill={url("rice")} />
          <circle cx="24" cy="32" r="1.6" fill="#ffd27a" />
          <circle cx="31" cy="29" r="1.6" fill="#ffd27a" />
          <circle cx="38" cy="33" r="1.6" fill="#ffd27a" />
          <circle cx="28" cy="36" r="1.4" fill="#ffd27a" />
          <path d="M40 30c3-2 7-1 8 2-3 2-6 2-8-2Z" fill="#1f9d6b" />
          <path d="M18 34c2-1 4-1 5 1" stroke="#1f9d6b" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("head")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#d8ccff" />
              <stop offset="1" stopColor="#7a5cf0" />
            </linearGradient>
          </defs>
          <path d="M33 30 14 52c-2 2 1 5 3 3l22-19" fill="#2b2540" />
          <path d="M17 49l3 3" stroke="#5b3fd9" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="22" r="13" fill={url("head")} />
          <path d="M31 17c4-4 10-5 15-2M30 24c5-6 13-8 19-4M33 31c5-5 11-7 16-5" stroke="#5b3fd9" strokeWidth="1.4" fill="none" opacity=".55" />
          <circle cx="35" cy="16" r="3" fill="#fff" opacity=".7" />
          <path d="M56 40l2 5M50 46l-1 5M58 52l4 1" stroke="#f2b33d" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("cup")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#e09a1a" />
            </linearGradient>
          </defs>
          <path d="M18 12H8c0 10 5 16 12 17M46 12h10c0 10-5 16-12 17" stroke="#e0a42a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M17 8h30v12c0 10-7 17-15 17S17 30 17 20V8Z" fill={url("cup")} />
          <rect x="28" y="36" width="8" height="9" fill="#e0a42a" />
          <rect x="20" y="45" width="24" height="10" rx="3" fill="#5b3fd9" />
          <rect x="25" y="48" width="14" height="3" rx="1.5" fill="#f2b33d" />
          <path d="M23 13v8c0 4 2 7 5 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".55" />
          <path d="M32 15l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L32 15Z" fill="#fff" opacity=".9" />
        </svg>
      );
    case "rose":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("petal")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff7a98" />
              <stop offset="1" stopColor="#d6304f" />
            </linearGradient>
            <linearGradient id={g("leaf")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5fd39a" />
              <stop offset="1" stopColor="#1f9d6b" />
            </linearGradient>
          </defs>
          <path d="M32 32c-1 9 2 16-2 26" stroke={url("leaf")} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M31 46c-9-1-13-7-11-12 6 0 11 5 11 12Z" fill={url("leaf")} />
          <path d="M33 41c7-2 11-7 9-11-5 1-9 5-9 11Z" fill={url("leaf")} opacity=".85" />
          <path d="M17 23c-4-9 2-16 10-14 2 7-2 12-10 14Z" fill="#c22d4b" />
          <path d="M47 23c4-9-2-16-10-14-2 7 2 12 10 14Z" fill="#c22d4b" />
          <path d="M23 18c0-7 4-11 9-11s9 4 9 11-4 10-9 10-9-3-9-10Z" fill="#ff8aa6" />
          <path d="M28 15c0-3 2.4-4.6 4.6-3.4 2.6-1 4.4 1.8 3 4.2-1.6 2.8-6 3-7.6.6" fill="none" stroke="#ffe0e7" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 21c3 9 9 14 16 14s13-5 16-14c-5 3-10 4-16 4s-11-1-16-4Z" fill={url("petal")} />
          <path d="M22 26c3 3 6 4.5 10 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".45" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("cup")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8f6bff" />
              <stop offset="1" stopColor="#5b3fd9" />
            </linearGradient>
          </defs>
          <path d="M24 8c-3 4 3 6 0 10M32 6c-3 4 3 6 0 10M40 8c-3 4 3 6 0 10" stroke="#cbbfe9" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <ellipse cx="32" cy="54" rx="22" ry="5" fill="#ebe0d2" />
          <ellipse cx="32" cy="52.5" rx="15" ry="3" fill="#d9cab6" />
          <path d="M44 31h3.5a6.5 6.5 0 0 1 0 13H43" stroke={url("cup")} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M13 26h34v11c0 9-7.6 16-17 16S13 46 13 37V26Z" fill={url("cup")} />
          <ellipse cx="30" cy="26" rx="17" ry="4.5" fill="#7a4a2e" />
          <path d="M30 29.5c-2.5-2-5-.4-3.6 1.4L30 33l3.6-2.1c1.4-1.8-1.1-3.4-3.6-1.4Z" fill="#f5e6d3" />
          <path d="M17 33v4c0 4 2 8 6 10" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".35" />
        </svg>
      );
    case "chocolate":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("wrap")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6b8b" />
              <stop offset="1" stopColor="#c2306b" />
            </linearGradient>
          </defs>
          <g transform="rotate(-12 32 32)">
            <rect x="16" y="6" width="32" height="44" rx="4" fill="#6b3d24" />
            {[0, 1].map((c) =>
              [0, 1, 2].map((r) => (
                <g key={`${c}${r}`}>
                  <rect x={19 + c * 13.5} y={9 + r * 9} width="11.5" height="7.5" rx="1.6" fill="#8a5434" />
                  <rect x={20 + c * 13.5} y={10 + r * 9} width="9.5" height="2" rx="1" fill="#a86d47" />
                </g>
              )),
            )}
            <rect x="14" y="35" width="36" height="22" rx="3.5" fill={url("wrap")} />
            <path d="M14 37l3-2.5 3 2.5 3-2.5 3 2.5 3-2.5 3 2.5 3-2.5 3 2.5 3-2.5 3 2.5 3-2.5 3 2.5" stroke="#f2b33d" strokeWidth="2" fill="none" strokeLinejoin="round" />
            <path d="M32 50.5c-3.4-2.4-6.5-4.6-6.5-7.4a3.3 3.3 0 0 1 6.5-1 3.3 3.3 0 0 1 6.5 1c0 2.8-3.1 5-6.5 7.4Z" fill="#fff" opacity=".92" />
          </g>
        </svg>
      );
    case "cocktail":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("drink")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffa6c4" />
              <stop offset="1" stopColor="#e5487a" />
            </linearGradient>
          </defs>
          <path d="M44 6 36 24" stroke="#f2b33d" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M10 14h44L32 38 10 14Z" fill="#efeaff" stroke="#c9bcf0" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M15 19.5h34L32 38 15 19.5Z" fill={url("drink")} />
          <path d="M15 19.5h34" stroke="#ffd0e0" strokeWidth="2" />
          <rect x="30.8" y="37" width="2.6" height="15" rx="1.3" fill="#c9bcf0" />
          <ellipse cx="32" cy="54" rx="11" ry="3.2" fill="#c9bcf0" />
          <circle cx="45" cy="13" r="4.5" fill="#e5484d" />
          <path d="M45 8.5c1-3 3-4 5-4" stroke="#1f9d6b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="43.6" cy="11.6" r="1.2" fill="#fff" opacity=".7" />
          <path d="M20 22l6 6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
        </svg>
      );
    case "teddy":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("fur")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#d79a63" />
              <stop offset="1" stopColor="#a8693a" />
            </linearGradient>
          </defs>
          <circle cx="17" cy="15" r="7" fill={url("fur")} />
          <circle cx="47" cy="15" r="7" fill={url("fur")} />
          <circle cx="17" cy="15" r="3.6" fill="#f3c9a0" />
          <circle cx="47" cy="15" r="3.6" fill="#f3c9a0" />
          <ellipse cx="32" cy="48" rx="17" ry="14" fill={url("fur")} />
          <circle cx="32" cy="27" r="15" fill={url("fur")} />
          <ellipse cx="32" cy="32" rx="7.5" ry="6" fill="#f3c9a0" />
          <ellipse cx="32" cy="29.6" rx="3" ry="2.2" fill="#3b2418" />
          <path d="M29 34c1.8 1.6 4.2 1.6 6 0" stroke="#3b2418" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="25.5" cy="23.5" r="2" fill="#3b2418" />
          <circle cx="38.5" cy="23.5" r="2" fill="#3b2418" />
          <circle cx="25" cy="22.8" r=".7" fill="#fff" />
          <circle cx="38" cy="22.8" r=".7" fill="#fff" />
          <path d="M32 55c-4.6-3.2-8.6-6-8.6-9.6a4.3 4.3 0 0 1 8.6-1.3 4.3 4.3 0 0 1 8.6 1.3c0 3.6-4 6.4-8.6 9.6Z" fill="#e5484d" />
          <ellipse cx="28.5" cy="44.5" rx="1.6" ry="1" fill="#fff" opacity=".6" />
        </svg>
      );
    case "bouquet":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("paper")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b9a2ff" />
              <stop offset="1" stopColor="#6d4ff0" />
            </linearGradient>
          </defs>
          <path d="M20 22c-4-4-6-9-3-11 3 2 4 7 3 11ZM44 22c4-4 6-9 3-11-3 2-4 7-3 11Z" fill="#3fb57f" />
          <circle cx="22" cy="20" r="7" fill="#ff8fb8" />
          <circle cx="22" cy="20" r="2.6" fill="#fff3c4" />
          <circle cx="42" cy="20" r="7" fill="#f2b33d" />
          <circle cx="42" cy="20" r="2.6" fill="#fff" opacity=".8" />
          <circle cx="32" cy="14" r="8" fill="#e5484d" />
          <path d="M28 13c0-3 3-4 5-3 2.5-1 4 1.6 3 4-1.3 3-5.6 3.4-7.4 1" fill="none" stroke="#ffd3de" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="32" cy="27" r="6" fill="#ffc2d6" />
          <circle cx="32" cy="27" r="2.2" fill="#fff" />
          <path d="M14 28h36L36 58h-8L14 28Z" fill={url("paper")} />
          <path d="M14 28l18 9 18-9" stroke="#efe8ff" strokeWidth="1.6" fill="none" opacity=".7" />
          <path d="M26 45c3 2 9 2 12 0" stroke="#f2b33d" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M32 46l-4 6M32 46l4 6" stroke="#f2b33d" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("gold")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#e8962a" />
            </linearGradient>
          </defs>
          <path d="M8 22l12 10 12-18 12 18 12-10-5 26H13L8 22Z" fill={url("gold")} stroke="#d38716" strokeWidth="1.4" strokeLinejoin="round" />
          <rect x="12" y="46" width="40" height="8" rx="3" fill="#e8962a" />
          <rect x="12" y="46" width="40" height="3" rx="1.5" fill="#ffd36b" />
          <circle cx="8" cy="21" r="3.4" fill="#ffd36b" />
          <circle cx="32" cy="13" r="3.8" fill="#ffd36b" />
          <circle cx="56" cy="21" r="3.4" fill="#ffd36b" />
          <path d="M32 34l4 4.5-4 4.5-4-4.5 4-4.5Z" fill="#e5484d" />
          <circle cx="20.5" cy="39" r="2.8" fill="#5b3fd9" />
          <circle cx="43.5" cy="39" r="2.8" fill="#1f9d6b" />
          <path d="M16 30l5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={g("gemA")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bdf0ff" />
              <stop offset="1" stopColor="#4aa8ff" />
            </linearGradient>
            <linearGradient id={g("gemB")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7cc8ff" />
              <stop offset="1" stopColor="#3b6fe0" />
            </linearGradient>
          </defs>
          <path d="M18 12h28l12 14-26 30L6 26l12-14Z" fill={url("gemB")} />
          <path d="M6 26h52L32 56 6 26Z" fill={url("gemA")} opacity=".9" />
          <path d="M18 12l6 14h16l6-14" fill="#e3f7ff" opacity=".85" />
          <path d="M24 26l8 30 8-30" fill="#a6dcff" opacity=".8" />
          <path d="M6 26h52M24 26 32 12l8 14" stroke="#ffffff" strokeWidth="1.4" fill="none" opacity=".7" strokeLinejoin="round" />
          <path d="M52 6l1.4 3.2L56.6 10.6l-3.2 1.4L52 15.2l-1.4-3.2-3.2-1.4 3.2-1.4L52 6Z" fill="#fff" />
          <path d="M11 40l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2Z" fill="#bfe6ff" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="10" y="24" width="44" height="30" rx="5" fill="#e5484d" />
          <rect x="8" y="18" width="48" height="10" rx="4" fill="#ff6b8b" />
          <rect x="29" y="18" width="6" height="36" fill="#f2b33d" />
        </svg>
      );
  }
}
