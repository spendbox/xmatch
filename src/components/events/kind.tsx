import clsx from "clsx";
import { Headphones, Images } from "lucide-react";
import { EVENT_KINDS, type EventKind } from "@/lib/events";
import { MaskLineIcon } from "@/components/ui/icons";

export function KindIcon({ kind, size = 13 }: { kind?: string; size?: number }) {
  if (kind === "spotlight") return <Images size={size} />;
  if (kind === "party") return <Headphones size={size} />;
  return <MaskLineIcon size={size} />;
}

/** "Spotlight Night" chip shown on event cards and heroes (on a coloured background). */
export function KindChip({ kind, className }: { kind?: EventKind | string; className?: string }) {
  const k = EVENT_KINDS.find((x) => x.value === kind) ?? EVENT_KINDS[0];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase backdrop-blur-sm", className)}>
      <KindIcon kind={k.value} /> {k.label}
    </span>
  );
}

/** A cover photo laid over the theme colour, darkened so white text stays readable. */
export function CoverImage({ src }: { src: string | null | undefined }) {
  if (!src) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/15" />
    </>
  );
}
