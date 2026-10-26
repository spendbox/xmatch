"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { thumbUrl } from "@/lib/photos";
import type { Gender } from "@/lib/types";
import { MaskFace } from "./MaskFace";

/** Someone's photo (the small copy first, then the full one). If neither loads, their mask instead of a broken image. */
export function Photo({
  src,
  id,
  gender,
  small = true,
  alt = "",
  loading,
  className,
  style,
}: {
  src: string;
  /** Picks their mask and colour */
  id: string;
  gender?: Gender | null;
  small?: boolean;
  alt?: string;
  loading?: "lazy" | "eager";
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = [small ? (thumbUrl(src) ?? src) : src, src].find((u) => !failed.includes(u));
  const img = useRef<HTMLImageElement>(null);
  // A photo that failed before the page was ready never calls onError: catch it here
  useEffect(() => {
    const el = img.current;
    if (url && el?.complete && el.naturalWidth === 0) setFailed((f) => [...f, url]);
  }, [url]);
  if (!url) return <MaskFace id={id} gender={gender} className={clsx(className, "grid place-items-center")} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} key={url} src={url} onError={() => setFailed((f) => [...f, url])} alt={alt} loading={loading} className={className} style={style} />
  );
}
