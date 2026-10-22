"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BellRing, Gift, Handshake, MapPin, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { intentLabel } from "@/lib/constants";
import { sexLabel } from "@/lib/eventSpace";
import { clock, connectionsLabel, lagosHour, lagosTime, replyLabel, type MasqueradeHour } from "@/lib/hourly";
import { usePushState } from "@/components/app/Notifications";
import { useInvites, useShareInvite } from "@/components/profile/InviteCard";
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
  hasPlace,
  onPlace,
}: {
  userId: string;
  ctl: ReturnType<typeof useMasqueradeHour>;
  hasPlace: boolean;
  onPlace: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { hour, setHour, skew } = ctl;
  const [now, setNow] = useState<number | null>(null);
  const push = usePushState();
  const invites = useInvites();
  const { share, copied } = useShareInvite(invites);

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

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-5 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)] lg:p-8">
      <div aria-hidden className="absolute -top-14 -right-12 h-48 w-48 rounded-full bg-white/10" />

      <div className="relative flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] font-semibold tracking-wide text-white/80 uppercase">
          {!enabled && !live ? "Masquerade is off" : live && hour ? `Your ${lagosHour(hour.hour_at)} pair` : "Masquerade"}
        </p>
        <Toggle checked={enabled} onChange={toggle} label="Masquerade pairing" />
      </div>

      {!hour ? (
        <p className="relative py-12 text-center text-[14px] text-white/80">Checking your pair…</p>
      ) : live && cur ? (
        <div className="relative mt-4 text-center">
          <p className="font-display text-[56px] leading-none font-semibold tabular-nums lg:text-[72px]">
            {now ? clock(new Date(cur.ends_at).getTime() - serverNow) : "··:··"}
          </p>
          <p className="mt-1 text-[12px] text-white/70">left together</p>

          <div className="mt-5 flex items-center justify-center gap-4">
            <Face alias={cur.my_alias} small />
            <span className="h-px w-6 border-t-2 border-dashed border-white/40" />
            <Face alias={cur.their_alias} />
          </div>
          <p className="mt-3 text-[18px] font-semibold">{cur.their_alias}</p>
          <p className="text-[13px] text-white/75">
            {[cur.their_age, sexLabel(cur.their_gender), intentLabel(cur.intent)].filter(Boolean).join(" · ")}
          </p>
          {cur.their_place && (
            <p className="text-[12px] text-white/60">
              {cur.their_tier && cur.their_tier !== "state" ? `Nobody free nearby, so we found someone in ${cur.their_place}` : cur.their_place}
            </p>
          )}
          <div className="mt-3 flex justify-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{connectionsLabel(cur.their_connections)}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">{replyLabel(cur.their_reply_seconds)}</span>
          </div>

          <p className="mx-auto mt-4 max-w-xs text-[13px] leading-snug text-white/90">
            {cur.my_vote === true
              ? `You unmasked. If ${cur.their_alias} does too, you're connected.`
              : cur.they_voted
                ? `${cur.their_alias} has made a choice. Your move.`
                : cur.messages === 0
                  ? "Say hi before the hour is up."
                  : cur.last_from_them && cur.last_message
                    ? `“${cur.last_message.length > 70 ? cur.last_message.slice(0, 67) + "…" : cur.last_message}”`
                    : "Keep the vibe going."}
          </p>
          <Link
            href={`/masquerade/${cur.id}`}
            onClick={() => tapFeedback()}
            className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3.5 text-[16px] font-semibold text-ink shadow-[0_8px_24px_-6px_rgb(242_179_61/0.6)] transition active:scale-[0.98]"
          >
            <MessageCircle size={19} /> {cur.messages ? "Open chat" : "Say hi"}
          </Link>
        </div>
      ) : cur?.status === "matched" ? (
        <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/12 p-3">
          {cur.their_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.their_photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-brand">
              <Handshake size={24} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold">You clicked!</p>
            <p className="truncate text-[13px] text-white/85">With {cur.their_name ?? cur.their_alias} · next pair {lagosTime(hour.next_at)}</p>
          </div>
          {cur.match_id && (
            <Link href={`/matches/${cur.match_id}`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 text-[14px] font-semibold text-ink">
              <MessageCircle size={16} /> Chat
            </Link>
          )}
        </div>
      ) : !enabled ? (
        <div className="relative mt-5 pb-1 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/15">
            <MaskIcon className="w-10 text-white" eyes="#6d4ff0" />
          </span>
          <p className="mx-auto mt-3 max-w-xs text-[14px] text-white/85">Switch it on to meet someone new, masked, every hour from 6am to 2am.</p>
        </div>
      ) : (
        <div className="relative mt-4 text-center">
          <p className="text-[13px] text-white/70">Next pair at {lagosTime(hour.next_at)}</p>
          <p className="mt-1 font-display text-[56px] leading-none font-semibold tabular-nums lg:text-[72px]">
            {now ? clock(new Date(hour.next_at).getTime() - serverNow) : "··:··"}
          </p>
          {hour.pulse && hour.pulse.all > 0 && (
            <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dffb5] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7dffb5]" />
              </span>
              {pulseText(hour)}
            </p>
          )}
          <p className="mx-auto mt-3 max-w-xs text-[13px] leading-snug text-white/80">
            {cur?.status === "ended" || cur?.status === "lapsed"
              ? "This hour's chat is done. Someone new is coming."
              : !hour.hour_open
                ? "Pairing runs 6am to 2am. Rest up."
                : hour.hour_ran
                  ? "Nobody fit your settings this hour."
                  : "We pair everyone on the hour."}
          </p>
        </div>
      )}

      {hour && enabled && !live && cur?.status !== "matched" && (
        <button
          type="button"
          onClick={share}
          className="relative mt-5 flex w-full items-center gap-2.5 rounded-2xl bg-white/12 px-4 py-3 text-left text-[13px] transition hover:bg-white/20"
        >
          <Gift size={17} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{copied ? "Link copied!" : "While you wait: invite friends"}</span>
            <span className="text-white/75"> · earn {hour.invite_reward ?? 10} Keys when they first buy Keys</span>
          </span>
        </button>
      )}

      {hour && (enabled || live) && push.state === "off" && (
        <button
          type="button"
          onClick={() => push.turnOn()}
          disabled={push.busy}
          className="relative mt-5 flex w-full items-center gap-2.5 rounded-2xl bg-white/12 px-4 py-3 text-left text-[13px] transition hover:bg-white/20"
        >
          <BellRing size={17} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{push.busy ? "Turning on…" : "Turn on notifications"}</span>
            <span className="text-white/75"> · know the moment your pair arrives</span>
          </span>
        </button>
      )}

      {hour && !hasPlace && (enabled || live) && (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onPlace();
          }}
          className="relative mt-5 flex w-full items-center gap-2.5 rounded-2xl bg-white/12 px-4 py-3 text-left text-[13px] transition hover:bg-white/20"
        >
          <MapPin size={17} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Add where you are</span>
            <span className="text-white/75"> · so we pair you with people nearby</span>
          </span>
        </button>
      )}
    </section>
  );
}

function Face({ alias, small }: { alias: string; small?: boolean }) {
  return (
    <span
      className={clsx("grid place-items-center rounded-full ring-4 ring-white/20", small ? "h-12 w-12 opacity-80" : "h-20 w-20")}
      style={{ background: nameColor(alias) }}
      title={small ? `You · ${alias}` : alias}
    >
      <MaskIcon className={clsx("text-white", small ? "w-8" : "w-12")} eyes={nameColor(alias)} />
    </span>
  );
}

/** "128 people masking up in Lagos" */
function pulseText(h: MasqueradeHour) {
  const p = h.pulse!;
  const when = h.hour_open ? "this hour" : "today";
  if (p.region >= 3 && p.region_name) return `${p.region} people masking up in ${p.region_name} ${when}`;
  if (p.country >= 3) return `${p.country} people masking up in your country ${when}`;
  return `${p.all} ${p.all === 1 ? "person" : "people"} masking up ${when}`;
}
