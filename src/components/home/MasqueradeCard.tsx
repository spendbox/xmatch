"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Handshake, MessageCircle, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { intentLabel, seekingLabel, seekingList, spiceLabel } from "@/lib/constants";
import { clock, lagosTime, type MasqueradeHour } from "@/lib/hourly";
import { Toggle } from "@/components/ui/Toggle";
import { tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS, SEEKING_ICONS, SpiceIcon } from "@/components/ui/icons";
import type { SetupPrefs } from "./prefs";
import { nameColor } from "@/lib/eventSpace";

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

export function MasqueradeCard({
  userId,
  ctl,
  prefs,
  onSettings,
}: {
  userId: string;
  ctl: ReturnType<typeof useMasqueradeHour>;
  /** Your Masquerade settings, shown as icons at the top of the card */
  prefs?: SetupPrefs;
  /** Tapped while waiting for a pair: open the Masquerade settings */
  onSettings?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { hour, setHour, skew } = ctl;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const serverNow = (now ?? 0) + skew;
  const enabled = hour?.enabled ?? false;
  const cur = hour?.current ?? null;
  const live = cur?.status === "active";

  async function toggle(v: boolean) {
    tapFeedback();
    setHour((h) => (h ? { ...h, enabled: v } : h));
    const { error } = await supabase.from("profiles").update({ open_to_masquerade: v }).eq("id", userId);
    if (error) return setHour((h) => (h ? { ...h, enabled: !v } : h));
    // Switched on: check in now, so you're paired straight away if someone online fits
    if (v) {
      await supabase.rpc("heartbeat");
      void ctl.load();
    }
  }

  const preview = cur
    ? cur.my_vote === true
      ? `You unmasked. If ${cur.their_alias} does too, you're connected.`
      : cur.they_voted
        ? `${cur.their_alias} has made a choice. Your move.`
        : cur.messages === 0
          ? "Say hi before the hour is up."
          : cur.last_from_them && cur.last_message
            ? `“${cur.last_message}”`
            : "Keep the vibe going."
    : "";

  // Switched on, nothing live, and free to be paired now
  const looking = !!hour && enabled && !live && cur?.status !== "matched" && (hour.looking ?? hour.hour_open);
  const settingsLabel = prefs
    ? `Masquerade settings: ${[intentLabel(prefs.intent), prefs.seeking !== "anyone" ? `meeting ${seekingLabel(prefs.seeking)}` : null, prefs.intent !== "friends" ? `${spiceLabel(prefs.spice)} questions` : null].filter(Boolean).join(", ")}. Edit`
    : "Masquerade settings";
  const chip = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15";

  // One small row, about the size of the "viewed you" card
  return (
    <section
      data-tour="masquerade-card"
      aria-label="Masquerade"
      className="relative flex min-h-[68px] items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] px-3.5 py-3 text-white shadow-[0_14px_30px_-16px_rgb(91_63_217/0.8)]"
    >
      <div aria-hidden className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-white/10" />

      {!hour ? (
        <p className="relative flex-1 text-center text-[13px] text-white/80">Checking your pair…</p>
      ) : live && cur ? (
        // Your pair right now
        <>
          <Face alias={cur.their_alias} />
          <div className="relative min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="truncate text-[15px] leading-tight font-semibold">{cur.their_alias}</span>
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                {now ? clock(new Date(cur.ends_at).getTime() - serverNow) : "··:··"}
              </span>
            </p>
            <p className="truncate text-[12.5px] text-white/80">{preview}</p>
          </div>
          <Link
            href={`/masquerade/${cur.id}`}
            onClick={() => tapFeedback()}
            className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 text-[13.5px] font-semibold text-ink transition active:scale-95"
          >
            <MessageCircle size={16} /> {cur.messages ? "Chat" : "Say hi"}
          </Link>
        </>
      ) : cur?.status === "matched" ? (
        // You both unmasked this hour
        <>
          {cur.their_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.their_photo} alt="" className="relative h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
          ) : (
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand">
              <Handshake size={20} />
            </span>
          )}
          <div className="relative min-w-0 flex-1">
            <p className="text-[15px] leading-tight font-semibold">You clicked!</p>
            <p className="truncate text-[12.5px] text-white/80">With {cur.their_name ?? cur.their_alias}</p>
          </div>
          {cur.match_id && (
            <Link href={`/matches/${cur.match_id}`} className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 text-[13.5px] font-semibold text-ink">
              <MessageCircle size={16} /> Chat
            </Link>
          )}
        </>
      ) : (
        // Waiting for your next pair, or switched off
        <>
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
            {looking && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-white/20 [animation-duration:2.4s]" />}
            <MaskIcon className="relative w-7 text-white" eyes="#6d4ff0" />
          </span>
          <div className="relative min-w-0 flex-1">
            {enabled && prefs ? (
              // Your settings at a glance: mood, who you'd like to meet (if set), question spice (dating and spicy)
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  onSettings?.();
                }}
                className="flex max-w-full items-center gap-1 text-left"
                aria-label={settingsLabel}
              >
                <span className={chip}>{INTENT_ICONS[prefs.intent]({ size: 14, strokeWidth: 2.2 })}</span>
                {seekingList(prefs.seeking).map((g) => {
                  const Icon = SEEKING_ICONS[g];
                  return (
                    <span key={g} className={chip}>
                      <Icon size={14} strokeWidth={2.2} />
                    </span>
                  );
                })}
                {prefs.intent !== "friends" && (
                  <span className={clsx(chip, "w-auto min-w-7 px-1.5")}>
                    <SpiceIcon level={prefs.spice} size={13} />
                  </span>
                )}
                <span className="grid h-7 w-6 shrink-0 place-items-center text-white/80">
                  <Pencil size={13} strokeWidth={2.4} />
                </span>
              </button>
            ) : (
              <p className="text-[15px] leading-tight font-semibold">{enabled ? "Masquerade" : "Masquerade is off"}</p>
            )}
            {/* Quiet: no countdown. You're paired the moment someone who fits is online too. */}
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-white/85" aria-live="polite">
              {!enabled ? (
                <span className="truncate">Meet someone new, masked</span>
              ) : looking ? (
                <>
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#7dffb5]" aria-hidden />
                  <span className="truncate">
                    Looking for your pair{hour.pulse && hour.pulse.all > 0 ? ` · ${onlineCount(hour)} online` : "…"}
                  </span>
                </>
              ) : (
                <span className="truncate">{waitText(hour)}</span>
              )}
            </p>
          </div>
          <span className="relative">
            <Toggle checked={enabled} onChange={toggle} label="Masquerade pairing" />
          </span>
        </>
      )}
    </section>
  );
}

function Face({ alias, small }: { alias: string; small?: boolean }) {
  return (
    <span
      className={clsx("relative grid shrink-0 place-items-center rounded-full ring-[3px] ring-white/20", small ? "h-10 w-10 opacity-80" : "h-11 w-11")}
      style={{ background: nameColor(alias) }}
      title={small ? `You · ${alias}` : alias}
    >
      <MaskIcon className={clsx("text-white", small ? "w-6" : "w-7")} eyes={nameColor(alias)} />
    </span>
  );
}

/** How many people near you are switched on and online now (your state if enough, else country, else all) */
function onlineCount(h: MasqueradeHour) {
  const p = h.pulse!;
  return p.region >= 3 ? p.region : p.country >= 3 ? p.country : p.all;
}

/** When you're not looking yet: between pairs, or outside pairing hours */
function waitText(h: MasqueradeHour) {
  const at = lagosTime(h.next_at).replace(/\s?([AP]M)$/i, (_, m: string) => m.toLowerCase());
  return h.hour_open && new Date(h.next_at).getTime() - Date.now() < 3 * 3600_000 ? `Your next pair after ${at}` : `Pairing starts at ${at}`;
}
