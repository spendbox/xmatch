"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { thumbUrl } from "@/lib/photos";
import type { Gender } from "@/lib/types";
import { MaskFace } from "./MaskFace";

/** Small copies that don't exist (older photos): asked for once per visit, not on every page */
const missing = new Set<string>();

/** Someone's photo (the small copy first, then the full one). If neither loads, their mask instead of a broken image. */
export function Photo({
  src,
  id,
  gender,
  small = true,
  fallback,
  onFail,
  alt = "",
  loading,
  className,
  style,
}: {
  src: string;
  /** Picks their mask and colour (without it, the photo's address does) */
  id?: string | null;
  gender?: Gender | null;
  small?: boolean;
  /** Shown instead of their mask (null: nothing) */
  fallback?: React.ReactNode;
  /** Neither copy loaded */
  onFail?: () => void;
  alt?: string;
  loading?: "lazy" | "eager";
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = [small ? (thumbUrl(src) ?? src) : src, src].find((u) => !failed.includes(u) && (u === src || !missing.has(u)));
  const img = useRef<HTMLImageElement>(null);
  const fail = (u: string) => {
    if (u !== src) missing.add(u);
    setFailed((f) => [...f, u]);
  };
  // A photo that failed before the page was ready never calls onError: catch it here
  useEffect(() => {
    const el = img.current;
    if (url && el?.complete && el.naturalWidth === 0) fail(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  useEffect(() => {
    if (!url) onFail?.();
  }, [url, onFail]);
  if (!url) return fallback !== undefined ? fallback : <MaskFace id={id ?? src} gender={gender} className={clsx(className, "grid place-items-center")} style={style} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} key={url} src={url} onError={() => fail(url)} alt={alt} loading={loading} className={className} style={style} />
  );
}
