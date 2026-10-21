"use client";

import { MessageCircleHeart, RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import type { MasqueradeState } from "@/lib/types";

export function Outcome({ state, eventId }: { state: MasqueradeState; eventId?: string | null }) {
  if (state.status === "matched" && state.them.profile) return <Reveal state={state} eventId={eventId} />;

  const alias = state.them.alias;
  const reason = state.ended_reason;
  let title = "No match this time";
  let body = `${alias} chose to stay masked. That's okay — the right person is out there.`;
  if (reason === "reported") {
    title = "Chat ended";
    body = "Thanks for letting us know. You won't be matched with this person again.";
  } else if (reason === "left" && state.me.vote === false) {
    title = "You left the chat";
    body = "No worries. Your mask is ready whenever you are.";
  } else if (reason === "left") {
    title = `${alias} left the chat`;
    body = "It happens. Don't take it personally — try again!";
  } else if (state.me.vote === false) {
    title = "You stayed masked";
    body = "Not every chat clicks. On to the next one.";
  } else if (reason === "timeout" && state.me.vote === null) {
    title = "Time ran out";
    body = "Nobody chose in time, so the chat ended.";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pt-20 text-center lg:justify-center lg:pt-0">
      <span className="grid h-24 w-24 place-items-center rounded-full bg-line text-muted">
        <MaskIcon className="w-14" eyes="#ebe5dc" />
      </span>
      <h1 className="mt-8 font-display text-[30px] leading-tight font-semibold">{title}</h1>
      <p className="mt-3 max-w-xs text-[16px] leading-relaxed text-muted">{body}</p>
      <p className="mt-6 rounded-full bg-surface px-4 py-2 text-[13px] font-medium text-muted shadow-card">
        This chat has been deleted
      </p>
      <div className="mt-auto w-full pt-10 pb-8 lg:mt-4">
        {eventId ? (
          <ButtonLink href={`/events/${eventId}?next=1`} size="lg" variant="gold">
            <RotateCcw size={18} /> Next round
          </ButtonLink>
        ) : (
          <ButtonLink href="/home" size="lg" variant="gold">
            <RotateCcw size={18} /> Find someone new
          </ButtonLink>
        )}
      </div>
    </main>
  );
}

function Reveal({ state, eventId }: { state: MasqueradeState; eventId?: string | null }) {
  const p = state.them.profile!;
  const photo = p.photos?.[0];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-8 pb-8 lg:justify-center">
      <p className="text-center text-sm font-semibold tracking-wide text-brand uppercase">It&apos;s a match</p>
      <h1 className="mt-1 text-center font-display text-[32px] leading-tight font-semibold">
        Meet {p.display_name}
      </h1>
      <p className="mt-1 text-center text-[15px] text-muted">
        a.k.a. {state.them.alias}
      </p>

      <div className="relative mt-6 overflow-hidden rounded-[28px] bg-line shadow-lift animate-fade-up">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={p.display_name} className="aspect-[4/5] w-full object-cover" />
        ) : (
          <div className="aspect-[4/5] w-full" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16 text-white">
          <p className="text-2xl font-semibold">
            {p.display_name}, {state.them.age}
          </p>
          {p.bio && <p className="mt-1 line-clamp-2 text-[14px] text-white/85">{p.bio}</p>}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-8 lg:mt-2">
        <ButtonLink href={`/matches/${state.match_id}`} size="lg">
          <MessageCircleHeart size={20} /> Keep chatting
        </ButtonLink>
        {eventId ? (
          <ButtonLink href={`/events/${eventId}?next=1`} size="lg" variant="secondary">
            <RotateCcw size={18} /> Next round
          </ButtonLink>
        ) : (
          <ButtonLink href="/home" size="lg" variant="secondary">
            Back to Home
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
