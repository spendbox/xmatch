"use client";

// Preview only: runs the real masking on a picked photo (to check the face finder and drawing work in the app)
import { useState } from "react";
import { drawMasked, prepare } from "@/lib/maskedPhotos";
import type { PhotoMask } from "@/lib/types";
import { MaskedPreview } from "@/components/masks/MaskedPreview";
import { MaskEditor } from "@/components/masks/MaskEditor";

export function MaskEngineTest() {
  const [status, setStatus] = useState("Pick a photo");
  const [src, setSrc] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [mask, setMask] = useState<Exclude<PhotoMask, { none: true }> | null>(null);
  const [edit, setEdit] = useState(false);
  return (
    <div className="space-y-3 p-4">
      <input id="pick" type="file" accept="image/*" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setStatus("Working…");
        const t = performance.now();
        const p = await prepare(f, "fox");
        if (p.kind === "none") return setStatus("none");
        setSrc(p.canvas.toDataURL("image/jpeg", 0.8));
        setMask(p.mask);
        const blob = await drawMasked(p.canvas, p.mask);
        setOut(URL.createObjectURL(blob));
        setStatus(`faces ${p.mask.faces.length} in ${Math.round(performance.now() - t)}ms`);
      }} />
      <p id="status">{status}</p>
      <div className="grid grid-cols-2 gap-2">
        {src && <MaskedPreview src={src} mask={mask} className="aspect-[4/5] rounded-xl bg-line" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {out && <img id="out" src={out} alt="" className="rounded-xl" />}
      </div>
      {/* Like the update pop-up: a full-screen layer above the app, with the pencil inside it */}
      {mask && src && (
        <div className="fixed inset-x-0 bottom-0 z-[60] h-[40%] bg-cream p-3">
          <button id="edit" type="button" onClick={() => setEdit(true)}>Edit (inside pop-up)</button>
          <MaskedPreview src={src} mask={mask} className="mt-2 aspect-[4/5] w-40 rounded-xl bg-line" />
          <MaskEditor open={edit} layer="z-[80]" src={src} mask={mask} onClose={() => setEdit(false)} onSave={(m) => { setMask(m); setEdit(false); }} />
        </div>
      )}
    </div>
  );
}
