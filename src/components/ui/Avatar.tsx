"use client";

import clsx from "clsx";
import type { Gender } from "@/lib/types";
import { Photo } from "./Photo";

export function Avatar({
  src,
  name,
  id,
  gender,
  size = 48,
  className,
}: {
  src?: string | null;
  name?: string | null;
  /** Their id: picks the mask shown if the photo won't load */
  id?: string;
  gender?: Gender | null;
  size?: number;
  className?: string;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <Photo src={src} id={id ?? src} gender={gender} alt={name ?? ""} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
