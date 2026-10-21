import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Briefcase, BookOpen, Camera, ChefHat, Church, Clapperboard, Cpu, Disc3, Dumbbell, Feather,
  Gamepad2, Globe, Heart, Laugh, Leaf, Martini, Mars, Music, Palette, PawPrint, Plane, Shirt,
  Smile, Trophy, Tv, UsersRound, UtensilsCrossed, Venus, Footprints, Car, TrainFront, Sprout, Flame,
} from "lucide-react";
import type { Intent, Seeking } from "@/lib/types";

type IconProps = { size?: number; className?: string; strokeWidth?: number };

/** Hand-drawn chili pepper, same line style as the other icons. */
export function ChiliIcon({ size = 24, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15.6 7.6c2 1.6 2 4.6 0 7.5-2.5 3.6-7 5.6-11.6 5.6-.5 0-.7-.6-.3-.9 4.3-2.6 6.8-6.1 7.3-10.1.3-2.2 2.8-3.4 4.6-2.1Z" />
      <path d="M11.2 9.4c1.1-1.4 2.9-2 4.4-1.8" />
      <path d="M14 7.4c-.1-1.4.5-2.6 1.6-3.4" />
      <path d="M15.6 4c.6-.7 1.6-1 2.5-.8" />
    </svg>
  );
}

/** Playful devil face for the top spice level. */
export function DevilIcon({ size = 24, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5.5 8.5 4 3.5l4.2 2.6" />
      <path d="M18.5 8.5 20 3.5l-4.2 2.6" />
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="m8.8 11.6 1.9.9" />
      <path d="m15.2 11.6-1.9.9" />
      <path d="M9 16c1.7 1.4 4.3 1.4 6 0" />
    </svg>
  );
}

/** Outline masquerade mask. */
export function MaskLineIcon({ size = 24, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 9c0-2 1.4-3 3.2-3 2.4 0 4.2 1.3 6.3 1.3S15.9 6 18.3 6c1.8 0 3.2 1 3.2 3 0 4.6-2.9 8.5-6.4 8.5-2.4 0-2.6-2.4-3.1-2.4s-.7 2.4-3.1 2.4C5.4 17.5 2.5 13.6 2.5 9Z" />
      <path d="M6.5 11c.6-.8 1.6-1.2 2.6-1" />
      <path d="M17.5 11c-.6-.8-1.6-1.2-2.6-1" />
    </svg>
  );
}

/** Spice level as an icon: leaf → chili → two chilis → devil. */
export function SpiceIcon({ level, size = 22, className }: { level: number; size?: number; className?: string }) {
  if (level <= 0) return <Sprout size={size} strokeWidth={1.75} className={className} />;
  if (level === 1) return <ChiliIcon size={size} className={className} />;
  if (level === 2)
    return (
      <span className={"relative inline-flex " + (className ?? "")} style={{ width: size * 1.35, height: size }}>
        <ChiliIcon size={size} className="absolute left-0" />
        <ChiliIcon size={size} className="absolute right-0 opacity-70" />
      </span>
    );
  return <DevilIcon size={size} className={className} />;
}

export const INTEREST_ICONS: Record<string, LucideIcon> = {
  Music, Travel: Plane, Food: UtensilsCrossed, Fitness: Dumbbell, Movies: Clapperboard, Books: BookOpen,
  Gaming: Gamepad2, Art: Palette, Fashion: Shirt, Tech: Cpu, Nature: Leaf, Dancing: Disc3,
  Photography: Camera, Cooking: ChefHat, Sports: Trophy, Faith: Church, Comedy: Laugh, Pets: PawPrint,
  Business: Briefcase, Nightlife: Martini, Poetry: Feather, Anime: Tv,
};

export function InterestIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = INTEREST_ICONS[name] ?? Heart;
  return <Icon strokeWidth={1.75} {...props} />;
}

export const INTENT_ICONS: Record<Intent, (p: IconProps) => React.ReactNode> = {
  friends: (p) => <Smile strokeWidth={1.75} {...p} />,
  dating: (p) => <Heart strokeWidth={1.75} {...p} />,
  spicy: (p) => <Flame strokeWidth={1.75} {...p} />,
};

export const SEEKING_ICONS: Record<Seeking, LucideIcon> = { women: Venus, men: Mars, anyone: UsersRound };

export const DISTANCE_ICONS: Record<number, LucideIcon> = { 10: Footprints, 50: Car, 200: TrainFront, 0: Globe };
