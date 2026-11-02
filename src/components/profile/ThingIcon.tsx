import {
  Angry, Backpack, Baby, Ban, Brain, Briefcase, CalendarHeart, Clock, CupSoda, Flag, Flame, Gamepad2, Gem, Globe, HandHeart,
  Heart, HeartCrack, House, Infinity as InfinityIcon, KeyRound, Landmark, Languages, Lightbulb, MapPin, Megaphone, MessageCircle,
  Music, Plane, Receipt, Rocket, Scale, Smartphone, Star, ThumbsUp, Trophy, Tv, Users, UtensilsCrossed, Vote, Wallet,
  type LucideIcon,
} from "lucide-react";

/** The icons a "Things about you" card can have (Admin picks from these) */
export const THING_ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed, "calendar-heart": CalendarHeart, music: Music, trophy: Trophy, briefcase: Briefcase, "map-pin": MapPin,
  plane: Plane, "cup-soda": CupSoda, heart: Heart, "thumbs-up": ThumbsUp, flag: Flag, star: Star, tv: Tv, gamepad: Gamepad2,
  languages: Languages, clock: Clock, angry: Angry, rocket: Rocket, backpack: Backpack, infinity: InfinityIcon, flame: Flame,
  landmark: Landmark, lightbulb: Lightbulb, "message-circle": MessageCircle, baby: Baby, gem: Gem, scale: Scale, receipt: Receipt,
  "hand-heart": HandHeart, users: Users, globe: Globe, smartphone: Smartphone, "heart-crack": HeartCrack, wallet: Wallet,
  house: House, vote: Vote, brain: Brain, ban: Ban, key: KeyRound, megaphone: Megaphone,
};

export function ThingIcon({ name, size = 22, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = (name && THING_ICONS[name]) || MessageCircle;
  return <Icon size={size} strokeWidth={2} className={className} aria-hidden />;
}
