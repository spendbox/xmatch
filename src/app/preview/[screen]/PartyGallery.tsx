"use client";

// Preview only: every party mask, large, in its own colour and a couple of others (for checking the designs)
import { useSearchParams } from "next/navigation";
import { MASKS, maskUrl } from "@/lib/masks";

export function PartyGallery() {
  const q = useSearchParams();
  const only = q.get("id");
  const color = q.get("color");
  const trim = q.get("trim") ?? "gold";
  const party = MASKS.filter((m) => m.cat === "party" && (!only || m.id === only));
  return (
    <div className="grid grid-cols-3 gap-3 bg-[#cfc6bd] p-3" id="gallery">
      {party.map((m) => (
        <figure key={m.id} className="rounded-2xl bg-[#e9e2da] p-1 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={maskUrl(m.id, color, trim)} alt={m.name} className="mx-auto block w-full" />
          <figcaption className="pb-1 text-[13px] font-bold text-ink">{m.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
