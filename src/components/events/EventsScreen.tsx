"use client";

import { CalendarHeart, Clock3, Repeat, Users } from "lucide-react";
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
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight lg:text-[40px]">Masquerade Nights</h1>
      <p className="mt-1 text-[15px] text-muted">Themed hours where everyone masks up at once.</p>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[12px] font-medium text-ink-soft lg:max-w-xl">
        <Step icon={<Users size={16} />} text="Say you're going" />
        <Step icon={<Clock3 size={16} />} text="5-minute masked rounds" />
        <Step icon={<Repeat size={16} />} text="Someone new each round" />
      </div>

      {live.length > 0 && <Section title="Live now" events={live} />}
      {upcoming.length > 0 && <Section title="Coming up" events={upcoming} />}
      {!live.length && !upcoming.length && (
        <div className="mt-8 flex flex-col items-center rounded-[32px] border border-line bg-surface px-6 py-12 text-center shadow-card">
          <span className="grid h-16 w-16 animate-float place-items-center rounded-2xl bg-brand-soft text-brand">
            <CalendarHeart size={30} />
          </span>
          <h2 className="mt-5 text-[20px] font-semibold">No nights scheduled yet</h2>
          <p className="mt-2 max-w-xs text-[15px] text-muted">Check back soon — new Masquerade Nights are announced here.</p>
        </div>
      )}
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

function Step({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3 shadow-card">
      <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <p className="mt-1.5 leading-tight">{text}</p>
    </div>
  );
}
