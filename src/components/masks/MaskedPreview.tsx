"use client";

import { useEffect, useState } from "react";
import { maskUrl } from "@/lib/masks";
import type { PhotoMask } from "@/lib/types";

// The mask drawing's square and the face oval inside it (see lib/masks)
const VB = { x: -10, y: -30, w: 220 };
const OVAL = { cx: 100, cy: 112 };

/**
 * A photo with its masks laid over it, drawn live (for choosing a mask). The saved masked copy is
 * drawn the same way on a canvas.
 */
export function MaskedPreview({ src, mask, className = "", onLoad }: { src: string; mask: PhotoMask | null; className?: string; onLoad?: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const url = mask && !("none" in mask) ? maskUrl(mask.mask, mask.color, mask.trim) : null;
  useEffect(() => setRatio(null), [src]);
  return (
    <span className={"relative block overflow-hidden " + className} style={ratio ? { aspectRatio: String(ratio) } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="block h-full w-full object-cover"
        onLoad={(e) => {
          const i = e.currentTarget;
          setRatio(i.naturalWidth / i.naturalHeight);
          onLoad?.();
        }}
      />
      {url &&
        ratio &&
        mask &&
        !("none" in mask) &&
        mask.faces.map((f, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={url}
            alt=""
            className="pointer-events-none absolute max-w-none"
            style={{
              left: `${(f.cx - (OVAL.cx - VB.x) * f.s * f.sx) * 100}%`,
              top: `${(f.cy - (OVAL.cy - VB.y) * f.s * ratio) * 100}%`,
              width: `${VB.w * f.s * f.sx * 100}%`,
              height: `${VB.w * f.s * ratio * 100}%`,
              transformOrigin: "50% 64.5%",
              transform: `rotate(${f.rot}deg)`,
            }}
          />
        ))}
    </span>
  );
}
