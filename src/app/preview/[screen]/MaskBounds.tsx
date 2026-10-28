"use client";
// Preview only: every mask drawn with no clipping, to measure how far each one reaches
import { MASKS, maskSvg } from "@/lib/masks";
export function MaskBounds() {
  return (
    <div>
      {MASKS.map((m) => (
        <div key={m.id} data-id={m.id} dangerouslySetInnerHTML={{ __html: maskSvg(m, null, "gold").replace(/viewBox="[^"]*"/, 'viewBox="-200 -200 600 600"') }} style={{ width: 600, height: 600 }} />
      ))}
    </div>
  );
}
