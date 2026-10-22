"use client";

import { BellRing, CalendarDays } from "lucide-react";
import { KindIcon } from "./kind";
import { eventPhase, type DashpadEvent } from "@/lib/events";
import { EventCard, useNow } from "./EventCard";

export function EventsScreen({ events }: { events: DashpadEvent[] }) {
  const now = useNow(30_000);
  const phase = (e: DashpadEvent) => (now ? eventPhase(e, now) : "upcoming");
  const live = events.filter((e) => phase(e) === "live");
  const upcoming = events.filter((e) => phase(e) === "upcoming");
  const past = events.filter((e) => phase(e) === "ended" || phase(e) === "cancelled");

  return (
    <main className="mx-auto max-w-md px-5 pt-6 lg:max-w-6xl lg:px-10 lg:pt-10">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight lg:text-[40px]">Events</h1>
      <p className="mt-1 text-[15px] text-muted">Themed nights to meet people — masked rounds, photo walls and listening parties.</p>

      {live.length > 0 && <Section title="Live now" events={live} />}
      {upcoming.length > 0 && <Section title="Coming up" events={upcoming} />}
      {!live.length && !upcoming.length && (
        <div className="mt-6 flex flex-col items-center rounded-[32px] border border-line bg-surface px-6 py-10 text-center shadow-card lg:flex-row lg:gap-6 lg:px-8 lg:py-8 lg:text-left">
          <span className="grid h-16 w-16 shrink-0 animate-float place-items-center rounded-2xl bg-brand-soft text-brand">
            <CalendarDays size={30} />
          </span>
          <div className="mt-5 lg:mt-0">
            <h2 className="text-[20px] font-semibold">Nothing on the calendar yet</h2>
            <p className="mt-1.5 max-w-md text-[15px] text-muted">
              New events show up here first. When one you&apos;re going to starts, you&apos;ll see a <span className="font-semibold text-ink">Live</span> badge on Events.
            </p>
          </div>
        </div>
      )}

      <section className={live.length || upcoming.length ? "mt-10" : "mt-8"}>
        <h2 className="mb-1 text-[15px] font-semibold">Kinds of events</h2>
        <p className="mb-3 text-[14px] text-muted">Every event is a different way to meet people. Look for these on the cards.</p>
        <div className="grid gap-3 lg:grid-cols-3">
          {KINDS.map((k) => (
            <article key={k.kind} className="flex gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-card lg:flex-col">
              <span className={"grid h-12 w-12 shrink-0 place-items-center rounded-2xl " + k.tone}>
                <KindIcon kind={k.kind} size={22} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold">{k.title}</h3>
                <p className="mt-0.5 text-[14px] leading-snug text-muted">{k.body}</p>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {k.points.map((p) => (
                    <li key={p} className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-medium text-ink-soft">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-cream px-4 py-3 text-[13px] text-ink-soft">
          <BellRing size={16} className="mt-0.5 shrink-0 text-brand" />
          Say you&apos;re going ahead of time. Some events are free and some cost a few Keys to get in; you get them back if you cancel before it starts.
        </p>
      </section>

      {past.length > 0 && <Section title="Recently" events={past} />}
      <div className="h-6" />
    </main>
  );
}

function Section({ title, events }: { title: string; events: DashpadEvent[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}

const KINDS = [
  {
    kind: "masquerade",
    title: "Masquerade Night",
    tone: "bg-brand-soft text-brand",
    body: "We pair you with someone new, masked, for 5 minutes at a time. Both unmask and you're connected.",
    points: ["Paired for you", "5-minute rounds", "Someone new each round"],
  },
  {
    kind: "spotlight",
    title: "Spotlight Night",
    tone: "bg-[#fde8f1] text-[#c2306b]",
    body: "Browse a wall of blurred photos and say hi to whoever catches your eye. Chats last until the event ends.",
    points: ["You choose", "Reveal photos", "Room chat"],
  },
  {
    kind: "party",
    title: "Listening Party",
    tone: "bg-gold-soft text-[#a26b00]",
    body: "Music or a live show everyone enjoys together, with a room to hype it up and private chats on the side.",
    points: ["Music & video", "Hype the room", "Private chats"],
  },
];
