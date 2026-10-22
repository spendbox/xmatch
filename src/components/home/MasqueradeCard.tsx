"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Clock3, Handshake, MapPin, MessageCircle, SlidersHorizontal, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DISTANCES, getLocation, INTENTS, intentLabel, seekingLabel, SPICE_LEVELS } from "@/lib/constants";
import { sexLabel } from "@/lib/eventSpace";
import { clock, inTime, lagosHour, lagosTime, type MasqueradeHour } from "@/lib/hourly";
import { Toggle } from "@/components/ui/Toggle";
import { tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS, SpiceIcon } from "@/components/ui/icons";
import { nameColor } from "@/lib/eventSpace";
import type { SetupPrefs } from "./prefs";

/** Keeps the hourly pairing state fresh: on open, on focus, when the hour turns, and when your pair changes. */
export function useMasqueradeHour(userId: string, initial: MasqueradeHour | null) {
  const supabase = useMemo(() => createClient(), []);
  const [hour, setHour] = useState<MasqueradeHour | null>(initial);
  const [skew, setSkew] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_masquerade_hour");
    if (data) {
      const h = data as MasqueradeHour;
      setSkew(new Date(h.server_now).getTime() - Date.now());
      setHour(h);
    }
  }, [supabase]);

  useEffect(() => {
    if (initial) setSkew(new Date(initial.server_now).getTime() - Date.now());
    else load();
  }, [initial, load]);

  useEffect(() => {
    const ch = supabase
      .channel(`hour-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "masquerade_sessions", filter: `user_a=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "masquerade_sessions", filter: `user_b=eq.${userId}` }, () => load())
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const every = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => {
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      clearInterval(every);
    };
  }, [supabase, userId, load]);

  // Check again just after the hour turns (new pair, or this one ends)
  useEffect(() => {
    if (!hour) return;
    const turns = [hour.next_at, hour.current?.status === "active" ? hour.current.ends_at : null]
      .filter(Boolean)
      .map((t) => new Date(t as string).getTime() - (Date.now() + skew));
    const soonest = Math.min(...turns.filter((ms) => ms > 0));
    if (!Number.isFinite(soonest) || soonest > 2 * 3600_000) return;
    const t = setTimeout(load, soonest + 4000);
    return () => clearTimeout(t);
  }, [hour, skew, load]);

  return { hour, setHour, load, skew };
}

/** Quietly refresh your rough location (for distance pairing) if you've already allowed it. */
export async function refreshLocation(force = false) {
  try {
    const last = Number(localStorage.getItem("dp-loc-at") || 0);
    if (!force && Date.now() - last < 6 * 3600_000) return;
    if (!force && navigator.permissions) {
      const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (p.state !== "granted") return;
    }
    const loc = await getLocation();
    if (!loc) return;
    await createClient().rpc("save_location", { p_lat: loc.lat, p_lng: loc.lng });
    localStorage.setItem("dp-loc-at", String(Date.now()));
  } catch {}
}

export function MasqueradeCard({
  userId,
  ctl,
  prefs,
  onPickIntent,
  onEdit,
}: {
  userId: string;
  ctl: ReturnType<typeof useMasqueradeHour>;
  prefs: SetupPrefs;
  onPickIntent: (v: SetupPrefs["intent"]) => void;
  onEdit: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { hour, setHour, skew } = ctl;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    refreshLocation();
  }, []);

  const serverNow = (now ?? 0) + skew;
  const enabled = hour?.enabled ?? false;

  async function toggle(v: boolean) {
    tapFeedback();
    setHour((h) => (h ? { ...h, enabled: v } : h));
    const { error } = await supabase.from("profiles").update({ open_to_masquerade: v }).eq("id", userId);
    if (error) setHour((h) => (h ? { ...h, enabled: !v } : h));
    if (v && prefs.maxKm > 0) refreshLocation(true);
  }

  const cur = hour?.current ?? null;
  const live = cur?.status === "active";
  const nextAt = hour ? new Date(hour.next_at).getTime() : 0;
  const distance = DISTANCES.find((d) => d.value === prefs.maxKm) ?? DISTANCES[1];

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-4 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)] lg:p-8">
      <div aria-hidden className="absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10" />

      {/* On / off */}
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 lg:h-12 lg:w-12">
          <MaskIcon className="w-7 text-white" eyes="#6d4ff0" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold lg:text-[17px]">Masquerade</p>
          <p className="truncate text-[12px] text-white/75">{enabled ? "A new masked pair every hour" : "Off · you won't be paired"}</p>
        </div>
        <Toggle checked={enabled} onChange={toggle} label="Masquerade pairing" />
      </div>

      {/* What's happening this hour */}
      <div className="relative mt-4 rounded-3xl bg-white/12 p-4 lg:p-5">
        {!hour ? (
          <p className="py-6 text-center text-[14px] text-white/80">Checking your pair…</p>
        ) : !enabled && !live ? (
          <div className="py-2 text-center">
            <p className="font-display text-[22px] leading-tight font-semibold">You&apos;re taking a break</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] text-white/80">Turn Masquerade on to meet someone new, masked, every hour from 6am to 2am.</p>
          </div>
        ) : live && cur ? (
          <>
            <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
              <span className="rounded-full bg-white/15 px-2.5 py-1">Your {lagosHour(hour.hour_at)} pair</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-brand tabular-nums">
                <Clock3 size={12} /> {now ? clock(new Date(cur.ends_at).getTime() - serverNow) : "…"} left
              </span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <PairFace alias={cur.my_alias} label="You" />
              <span className="flex flex-col items-center text-white/70">
                <span className="h-px w-8 border-t-2 border-dashed border-white/40 lg:w-14" />
              </span>
              <PairFace alias={cur.their_alias} label={[cur.their_age, sexLabel(cur.their_gender)].filter(Boolean).join(" · ")} big />
            </div>
            <p className="mt-2 text-center text-[13px] text-white/85">
              {INTENT_ICONS[cur.intent]({ size: 13, className: "inline -mt-0.5" })} {intentLabel(cur.intent)}
            </p>
            <p className="mt-3 text-center text-[13px] leading-snug text-white/90">
              {cur.my_vote === true
                ? `You chose to unmask. If ${cur.their_alias} does too, you're connected.`
                : cur.they_voted
                  ? `${cur.their_alias} has made a choice. Your move.`
                  : cur.messages === 0
                    ? "Say hi before the hour is up."
                    : cur.last_from_them && cur.last_message
                      ? `${cur.their_alias}: “${cur.last_message.length > 60 ? cur.last_message.slice(0, 57) + "…" : cur.last_message}”`
                      : "Keep the vibe going."}
            </p>
            <Link
              href={`/masquerade/${cur.id}`}
              onClick={() => tapFeedback()}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-[15px] font-semibold text-ink shadow-[0_8px_24px_-6px_rgb(242_179_61/0.6)] transition active:scale-[0.98]"
            >
              <MessageCircle size={18} /> {cur.messages ? "Open chat" : "Say hi"}
            </Link>
          </>
        ) : cur?.status === "matched" ? (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand">
              <Handshake size={22} />
            </span>
            <p className="mt-2 font-display text-[22px] leading-tight font-semibold">You clicked with {cur.their_name ?? cur.their_alias}!</p>
            <p className="mt-1 text-[13px] text-white/80">Next pair at {lagosTime(hour.next_at)}.</p>
            {cur.match_id && (
              <Link href={`/matches/${cur.match_id}`} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-brand">
                <MessageCircle size={18} /> Say hello
              </Link>
            )}
          </div>
        ) : (
          <div className="py-1 text-center">
            <p className="text-[12px] font-semibold tracking-wide text-white/70 uppercase">Next pair</p>
            <p className="mt-1 font-display text-[32px] leading-none font-semibold">{lagosTime(hour.next_at)}</p>
            <p className="mt-1.5 text-[13px] font-semibold text-gold">{now ? inTime(nextAt - serverNow) : ""}</p>
            <p className="mx-auto mt-2 max-w-xs text-[13px] leading-snug text-white/80">
              {cur?.status === "ended" || cur?.status === "lapsed"
                ? "This hour's chat is done. Hang tight for someone new."
                : !hour.hour_open
                  ? "Pairing runs 6am to 2am. Rest up."
                  : hour.hour_ran
                    ? "Nobody fit your settings this hour. Widening who you meet can help."
                    : "We pair everyone on the hour."}
            </p>
          </div>
        )}
      </div>

      {/* Your settings (they apply from the next pairing) */}
      <div role="radiogroup" aria-label="Mood" className="relative mt-3 flex gap-1 rounded-2xl bg-white/12 p-1">
        {INTENTS.map((i) => {
          const on = prefs.intent === i.value;
          return (
            <button
              key={i.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPickIntent(i.value)}
              className={clsx(
                "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition active:scale-[0.97] lg:text-[14px]",
                on ? "bg-white text-brand shadow-card" : "text-white/85 hover:bg-white/10",
              )}
            >
              {INTENT_ICONS[i.value]({ size: 15 })}
              {i.value === "spicy" ? "Spicy" : i.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onEdit();
        }}
        className="relative mt-2 flex w-full flex-wrap items-center gap-1.5 text-left text-[12px] lg:text-[13px]"
        aria-label="Change who you meet"
      >
        {prefs.seeking !== "anyone" && <Chip icon={<Users size={13} />} text={`${seekingLabel(prefs.seeking)} · ${prefs.ageMin}–${prefs.ageMax}`} />}
        <Chip icon={<MapPin size={13} />} text={distance.value ? distance.label : "Anywhere"} />
        <Chip icon={<SpiceIcon level={prefs.spice} size={13} />} text={SPICE_LEVELS[prefs.spice].label} />
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 font-semibold text-brand">
          <SlidersHorizontal size={13} /> Edit
        </span>
      </button>
      <p className="relative mt-2 text-center text-[11px] text-white/70">
        {live ? "Changes to your settings apply from the next pairing." : hour && hour.pairs_this_hour > 0 ? `${hour.pairs_this_hour * 2} people paired this hour` : "Changes apply from the next pairing."}
      </p>
    </section>
  );
}

function PairFace({ alias, label, big }: { alias: string; label: string; big?: boolean }) {
  return (
    <div className="flex w-28 flex-col items-center text-center">
      <span
        className={clsx("grid place-items-center rounded-full ring-4 ring-white/25", big ? "h-16 w-16" : "h-12 w-12")}
        style={{ background: nameColor(alias) }}
      >
        <MaskIcon className={clsx("text-white", big ? "w-10" : "w-8")} eyes={nameColor(alias)} />
      </span>
      <p className="mt-1.5 w-full truncate text-[13px] font-semibold">{alias}</p>
      <p className="w-full truncate text-[11px] text-white/75">{label}</p>
    </div>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5 font-medium">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}
