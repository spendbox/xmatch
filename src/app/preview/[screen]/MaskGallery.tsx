"use client";

// Preview only: every mask, by group, large (?cat=emoji, ?color=, ?trim=, ?from=&n= to page),
// and a check that each one fully covers the face oval
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MASKS, maskFit, maskOutline, maskUrl } from "@/lib/masks";

export function MaskGallery() {
  const q = useSearchParams();
  const cat = q.get("cat");
  const color = q.get("color");
  const trim = q.get("trim") ?? "gold";
  const from = Number(q.get("from") ?? 0);
  const n = Number(q.get("n") ?? 60);
  const list = MASKS.filter((m) => !cat || m.cat === cat).slice(from, from + n);
  const [bad, setBad] = useState<string[] | null>(null);
  useEffect(() => {
    // The face oval (centre 100,112; radii 48 × 54) must be inside every outline
    const ctx = document.createElement("canvas").getContext("2d")!;
    const out: string[] = [];
    for (const m of MASKS) {
      const p = new Path2D(maskOutline(m.id));
      // A mask shown smaller (fit) must still cover the face
      const f = maskFit(m.id);
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * Math.PI * 2;
        if (!ctx.isPointInPath(p, 100 + (Math.cos(a) * 48) / f, 112 + (Math.sin(a) * 54) / f)) {
          out.push(m.id);
          break;
        }
      }
    }
    setBad(out);
  }, []);
  const ids = new Set(MASKS.map((m) => m.id));
  return (
    <div className="bg-[#cfc6bd] p-3">
      <p id="summary" className="mb-2 text-[13px] font-bold">
        {MASKS.length} masks · {ids.size} ids · not covering the face: {bad ? (bad.length ? bad.join(", ") : "none") : "…"} · cats:{" "}
        {[...new Set(MASKS.map((m) => m.cat))].map((c) => `${c} ${MASKS.filter((m) => m.cat === c).length}`).join(", ")}
      </p>
      <div className="grid grid-cols-6 gap-2" id="gallery">
        {list.map((m) => (
          <figure key={m.id} className="rounded-xl bg-[#e9e2da] p-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={maskUrl(m.id, color, trim)} alt={m.name} className="mx-auto block w-full" />
            <figcaption className="truncate pb-0.5 text-[11px] font-bold text-ink">{m.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
