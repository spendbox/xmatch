import { SpiceIcon } from "./icons";

/** Small inline spice icon (leaf, chili, two chilis, devil). */
export function Chilis({ level, className, size = 16 }: { level: number; className?: string; size?: number }) {
  const color = level <= 0 ? "text-mint" : level >= 3 ? "text-[#b42da8]" : "text-chili";
  return <SpiceIcon level={level} size={size} className={(className ?? "") + " " + color} />;
}
