import { KeyRound } from "lucide-react";
import clsx from "clsx";

/** Gold coin with a key — the symbol for Keys. */
export function KeyCoin({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd166] to-[#e8962a] text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <KeyRound size={size * 0.58} strokeWidth={2.4} />
    </span>
  );
}
