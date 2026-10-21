import Link from "next/link";
import { MaskIcon } from "./MaskIcon";

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="Dashpad home">
      <span
        className={`grid place-items-center rounded-xl bg-brand text-white ${big ? "h-10 w-10" : "h-8 w-8"}`}
      >
        <MaskIcon className={big ? "w-7" : "w-5"} eyes="#5b3fd9" />
      </span>
      <span className={`font-display font-semibold tracking-tight text-ink ${big ? "text-2xl" : "text-xl"}`}>
        Dashpad
      </span>
    </Link>
  );
}
