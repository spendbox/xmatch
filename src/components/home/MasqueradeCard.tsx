"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Handshake, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { intentLabel } from "@/lib/constants";
import { sexLabel } from "@/lib/eventSpace";
import { clock, lagosHour, lagosTime, type MasqueradeHour } from "@/lib/hourly";
import { Toggle } from "@/components/ui/Toggle";
import { tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { INTENT_ICONS } from "@/components/ui/icons";
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
  onSettings,
}: {
  userId: string;
  ctl: ReturnType<typeof useMasqueradeHour>;
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
    if (error) setHour((h) => (h ? { ...h, enabled: !v } : h));
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

  return (
    <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] px-5 pt-4 pb-5 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)] lg:rounded-[28px] lg:p-6">
      <div aria-hidden className="absolute -top-14 -right-12 h-40 w-40 rounded-full bg-white/10" />

      <div className="relative flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-wide text-white/80 uppercase">
          {!enabled && !live ? "Masquerade is off" : live && hour ? `Your ${lagosHour(hour.hour_at)} pair` : "Masquerade"}
        </p>
        {live && cur && (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold tabular-nums">
            {now ? clock(new Date(cur.ends_at).getTime() - serverNow) : "··:··"} left
          </span>
        )}
        <Toggle checked={enabled} onChange={toggle} label="Masquerade pairing" />
      </div>

      {!hour ? (
        <p className="relative py-5 text-center text-[14px] text-white/80">Checking your pair…</p>
      ) : live && cur ? (
        <div className="relative mt-3.5">
          <div className="flex items-center gap-3.5">
            <Face alias={cur.their_alias} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] leading-tight font-semibold">{cur.their_alias}</p>
              <p className="truncate text-[12px] text-white/75">
                {[sexLabel(cur.their_gender), intentLabel(cur.intent), cur.their_place].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Link
              href={`/masquerade/${cur.id}`}
              onClick={() => tapFeedback()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 text-[14px] font-semibold text-ink shadow-[0_8px_24px_-6px_rgb(242_179_61/0.6)] transition active:scale-95"
            >
              <MessageCircle size={16} /> {cur.messages ? "Chat" : "Say hi"}
            </Link>
          </div>
          <p className="mt-3 truncate text-[14px] text-white/85">{preview}</p>
        </div>
      ) : cur?.status === "matched" ? (
        <div className="relative mt-3 flex items-center gap-3">
          {cur.their_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.their_photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand">
              <Handshake size={22} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold">You clicked!</p>
            <p className="truncate text-[12px] text-white/85">With {cur.their_name ?? cur.their_alias} · next pair {lagosTime(hour.next_at)}</p>
          </div>
          {cur.match_id && (
            <Link href={`/matches/${cur.match_id}`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 text-[14px] font-semibold text-ink">
              <MessageCircle size={16} /> Chat
            </Link>
          )}
        </div>
      ) : !enabled ? (
        <div className="relative mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15">
            <MaskIcon className="w-8 text-white" eyes="#6d4ff0" />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-white/85">Switch it on to meet someone new, masked, every hour from 6am to 2am.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onSettings?.();
          }}
          aria-label={`Next pair up by ${lagosTime(hour.next_at)}. Open your Masquerade settings`}
          className="relative mt-3.5 flex w-full items-center gap-4 rounded-2xl text-left transition active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/75">
              Next pair up by {lagosTime(hour.next_at).replace(/\s?([AP]M)$/i, (_, m: string) => m.toLowerCase())}
            </p>
            <p className="mt-1 text-[14px] leading-snug text-white/90">
              {cur?.status === "ended" || cur?.status === "lapsed"
                ? "This hour's chat is done. Someone new is coming."
                : !hour.hour_open
                  ? "Pairing runs 6am to 2am. Rest up."
                  : hour.hour_ran
                    ? "No matches found this hour."
                    : "We pair everyone on the hour."}
            </p>
            {hour.pulse && hour.pulse.all > 0 && (
              <p className="mt-2.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dffb5] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7dffb5]" />
                </span>
                <span className="truncate">{pulseText(hour)}</span>
              </p>
            )}
          </div>
          <p className="shrink-0 font-display text-[36px] leading-none font-semibold tabular-nums lg:text-[48px]">
            {now ? clock(new Date(hour.next_at).getTime() - serverNow) : "··:··"}
          </p>
        </button>
      )}

    </section>
  );
}

function Face({ alias, small }: { alias: string; small?: boolean }) {
  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full ring-[3px] ring-white/20", small ? "h-10 w-10 opacity-80" : "h-12 w-12")}
      style={{ background: nameColor(alias) }}
      title={small ? `You · ${alias}` : alias}
    >
      <MaskIcon className={clsx("text-white", small ? "w-6" : "w-8")} eyes={nameColor(alias)} />
    </span>
  );
}

/** "128 people available in Lagos" */
function pulseText(h: MasqueradeHour) {
  const p = h.pulse!;
  if (p.region >= 3 && p.region_name) return `${p.region} people available in ${p.region_name}`;
  if (p.country >= 3) return `${p.country} people available in your country`;
  return `${p.all} ${p.all === 1 ? "person" : "people"} available`;
}
