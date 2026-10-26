"use client";

import { Photo } from "@/components/ui/Photo";
import { sexLabel } from "@/lib/eventSpace";
import clsx from "clsx";
import { Eye, EyeOff, UserRound } from "lucide-react";
import { plural } from "@/lib/plural";
import type { EventSettings } from "@/lib/events";
import { InterestIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";

/**
 * A featured photo: sharp once you've revealed it, otherwise the tiny blurred
 * copy (made sharper-looking by the CSS blur), or a soft placeholder.
 */
export function BlurPhoto({
  blur,
  photo,
  alt = "",
  className,
  soft,
}: {
  blur: string | null | undefined;
  photo: string | null | undefined;
  alt?: string;
  className?: string;
  /** Lighter blur for small avatars */
  soft?: boolean;
}) {
  return (
    <span className={clsx("relative block overflow-hidden bg-gradient-to-br from-brand-soft via-[#f3e8ff] to-[#ffe4ec]", className)}>
      {photo ? (
        <Photo src={photo} small={false} alt={alt} className="h-full w-full animate-fade-in object-cover" />
      ) : blur ? (
        <Photo src={blur} small={false} className={clsx("h-full w-full scale-110 object-cover", soft ? "blur-sm" : "blur-xl")} />
      ) : (
        <span className="grid h-full w-full place-items-center text-brand/40">
          <UserRound className="h-1/2 w-1/2" strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}

export type RevealPrice = { free: boolean; freeLeft: number; cost: number; label: string };

export function revealPrice(s: Required<EventSettings>, used: number): RevealPrice {
  const freeLeft = Math.max(0, s.free_reveals - used);
  if (freeLeft > 0) return { free: true, freeLeft, cost: 0, label: `Free · ${freeLeft} left` };
  if (s.reveal_cost <= 0) return { free: true, freeLeft: 0, cost: 0, label: "Free" };
  return { free: false, freeLeft: 0, cost: s.reveal_cost, label: plural(s.reveal_cost, "Key") };
}

export type SheetPerson = {
  name: string;
  age: number | null;
  gender?: string | null;
  blur: string | null;
  photo: string | null;
  revealed: boolean;
  interests: string[];
};

/** A closer look at someone: their (blurred) photo, interests, reveal and chat. */
export function PersonSheet({
  open,
  onClose,
  person,
  myInterests,
  price,
  balance,
  revealing,
  onReveal,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  person: SheetPerson | null;
  myInterests: string[];
  price: RevealPrice;
  balance: number | null;
  revealing: boolean;
  onReveal: () => void;
  error?: string | null;
  /** Main action, e.g. "Say hi" */
  children?: React.ReactNode;
}) {
  if (!person) return null;
  const shared = person.interests.filter((t) => myInterests.includes(t));
  const others = person.interests.filter((t) => !myInterests.includes(t));
  const short = !price.free && balance !== null && balance < price.cost;
  return (
    <Sheet open={open} onClose={onClose} title={`${person.name || "Someone"}${person.age ? `, ${person.age}` : ""}`} subtitle={[sexLabel(person.gender), shared.length ? `${shared.length} ${shared.length === 1 ? "interest" : "interests"} in common` : ""].filter(Boolean).join(" · ") || undefined}>
      <div className="relative mx-auto aspect-[4/5] max-h-[46dvh] overflow-hidden rounded-3xl">
        <BlurPhoto blur={person.blur} photo={person.photo} alt={person.name} className="h-full w-full" />
        {!person.photo && (
          <span className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
            <EyeOff size={14} /> Photo hidden
          </span>
        )}
      </div>

      {person.interests.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...shared, ...others].slice(0, 10).map((t) => (
            <span
              key={t}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                shared.includes(t) ? "bg-brand-soft text-brand-ink" : "bg-cream text-ink-soft",
              )}
            >
              <InterestIcon name={t} size={13} /> {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-2.5">
        {children}
        {!person.photo &&
          (short ? (
            <ButtonLink href="/wallet" variant="gold" size="lg">
              <KeyCoin size={20} /> Get Keys to reveal · {price.cost}
            </ButtonLink>
          ) : (
            <Button variant="secondary" size="lg" onClick={onReveal} loading={revealing} loadingText="Revealing…">
              <Eye size={18} /> Reveal photo
              <span className={clsx("ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]", price.free ? "bg-mint-soft text-mint" : "bg-gold-soft text-[#8a5a00]")}>
                {!price.free && <KeyCoin size={12} />} {price.label}
              </span>
            </Button>
          ))}
      </div>
      {error && <p className="mt-3 rounded-xl bg-chili-soft px-4 py-2.5 text-center text-[14px] font-medium text-chili">{error}</p>}
      <p className="mt-3 pb-1 text-center text-[12px] leading-snug text-muted">
        {!person.photo && <span className="mb-1 block font-semibold text-ink-soft">They won&apos;t be told if you reveal their photo.</span>}
        You don&apos;t need to reveal to chat. Photos stay blurred until each person chooses to reveal.
      </p>
    </Sheet>
  );
}
