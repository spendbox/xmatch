import clsx from "clsx";
import { Photo } from "@/components/ui/Photo";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { nameColor } from "@/lib/eventSpace";

/** A masked person: a coloured circle with a mask, the colour fixed by their alias. */
export function MaskAvatar({ alias, size = 40, photo, className }: { alias: string | null; size?: number; photo?: string | null; className?: string }) {
  if (photo) {
    return <Photo src={photo} className={clsx("shrink-0 overflow-hidden rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full text-white", className)}
      style={{ width: size, height: size, background: nameColor(alias) }}
      aria-hidden
    >
      <span style={{ width: Math.round(size * 0.62) }}>
        <MaskIcon className="w-full text-white" eyes={nameColor(alias)} />
      </span>
    </span>
  );
}
