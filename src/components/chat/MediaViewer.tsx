"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

export type ViewerItem = { url: string; kind: "image" | "video" };

/** Full-screen photo or video. */
export function MediaViewer({ item, onClose }: { item: ViewerItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);
  if (!item) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black" role="dialog" aria-modal="true">
      <div className="absolute inset-x-0 top-0 z-10 flex justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <a href={item.url} download target="_blank" rel="noreferrer" className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="Download">
          <Download size={20} />
        </a>
        <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="Close">
          <X size={22} />
        </button>
      </div>
      {item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="max-h-full max-w-full animate-pop object-contain" onClick={onClose} />
      ) : (
        <video src={item.url} controls autoPlay playsInline className="max-h-full max-w-full" />
      )}
    </div>,
    document.body,
  );
}
