"use client";

import { useState } from "react";
import { maskUrl } from "@/lib/masks";
import { finalSpot } from "@/lib/maskPlace";
import type { PhotoMask } from "@/lib/types";

// The mask drawing's square and the face oval inside it (see lib/masks)
const VB = { x: -26, y: -44, w: 252 };
const OVAL = { cx: 100, cy: 112 };

/**
 * A photo with its masks laid over it, drawn live (for choosing a mask). The saved masked copy is
 * drawn the same way on a canvas. In a fixed-shape box (className with an aspect ratio) the photo
 * fills the box like object-cover, and the masks move with it; with `natural`, the box takes the
 * photo's own shape.
 */
export function MaskedPreview({ src, mask, className = "", natural }: { src: string; mask: PhotoMask | null; className?: string; natural?: boolean }) {
  // The photo's shape, remembered for this photo only (so a new photo never uses an old size)
  const [size, setSize] = useState<{ src: string; ratio: number } | null>(null);
  const ratio = size?.src === src ? size.ratio : null;
  const url = mask && !("none" in mask) ? maskUrl(mask.mask, mask.color, mask.trim) : null;

  return (
    <span
      className={"relative block overflow-hidden " + className}
      style={{ containerType: "size", ...(natural ? { aspectRatio: String(ratio ?? 0.8) } : {}) }}
    >
      {/* The photo at its own shape, covering the box and centred */}
      <span
        className="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2"
        style={
          ratio
            ? { width: `max(100cqw, ${ratio * 100}cqh)`, height: `max(100cqh, ${100 / ratio}cqw)` }
            : { width: "100%", height: "100%" }
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="block h-full w-full object-cover"
          ref={(i) => {
            // Already loaded (from cache) before React saw it
            if (i?.complete && i.naturalWidth && size?.src !== src) setSize({ src, ratio: i.naturalWidth / i.naturalHeight });
          }}
          onLoad={(e) => {
            const i = e.currentTarget;
            if (i.naturalWidth) setSize({ src, ratio: i.naturalWidth / i.naturalHeight });
          }}
        />
        {url &&
          ratio &&
          mask &&
          !("none" in mask) &&
          mask.faces.map((face, k) => {
            // Placed on the face (party masks on the eyes and nose), then the person's own changes
            const f = finalSpot(mask.mask, face, ratio);
            return (
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
                transformOrigin: `${((OVAL.cx - VB.x) / VB.w) * 100}% ${((OVAL.cy - VB.y) / VB.w) * 100}%`,
                transform: `rotate(${f.rot}deg)`,
              }}
            />
            );
          })}
      </span>
    </span>
  );
}
