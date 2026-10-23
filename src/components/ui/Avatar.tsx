"use client";

import clsx from "clsx";
import { thumbFallback, thumbUrl } from "@/lib/photos";

export function Avatar({
  src,
  name,
  size = 48,
  className,
}: {
  src?: string | null;
  name?: string | null;
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl(src) ?? src} onError={thumbFallback(src)} alt={name ?? ""} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
