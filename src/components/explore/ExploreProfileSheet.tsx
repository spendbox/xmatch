"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, MessageCircle, Snowflake } from "lucide-react";
import { IcebreakerSheet } from "@/components/home/IcebreakerSheet";
import { createClient } from "@/lib/supabase/client";
import { clearNotice, notify } from "@/lib/pushClient";
import { isOnline, usePresence } from "@/lib/usePresence";
import type { ExploreProfile } from "@/lib/explore";
import type { Profile } from "@/lib/types";
import { Button, Spinner, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { keysError } from "@/components/keys/GiftSheet";
import { ProfileSheet } from "@/components/matches/ProfileSheet";

/** Someone's profile from Meet or Home: wave, message, or see their other photos */
export function ExploreProfileSheet({
  personId,
  onClose,
  onChanged,
  demo,
  inChat,
}: {
  personId: string;
  onClose: () => void;
  /** Keys were spent, or you waved (refresh the list) */
  onChanged?: () => void;
  /** Design previews */
  demo?: ExploreProfile;
  /** Opened from your chat with them: no chat buttons */
  inChat?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [p, setP] = useState<ExploreProfile | null>(demo ?? null);
  const [busy, setBusy] = useState<"photos" | "message" | "wave" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [breaking, setBreaking] = useState(false);
  // Online, checked the same way as everywhere else
  const presence = usePresence(demo ? [] : [personId]);

  useEffect(() => {
    if (demo) return;
    supabase.rpc("explore_profile", { p_id: personId }).then(({ data }) => {
      if (data) setP(data as ExploreProfile);
      else setError("This profile isn't available.");
    });
    // They'll see you viewed them (unless you're in ghost mode)
    // (.then makes the request actually go out)
    supabase.rpc("log_profile_view", { p_id: personId }).then(() => {});
  }, [supabase, personId, demo]);

  async function unlock() {
    setBusy("photos");
    setError(null);
    const { error: err } = await supabase.rpc("unlock_photos", { p_id: personId });
    if (err) {
      setBusy(null);
      return setError(keysError(err.message));
    }
    const { data } = await supabase.rpc("explore_profile", { p_id: personId });
    if (data) setP(data as ExploreProfile);
    setBusy(null);
    onChanged?.();
  }

  function openChat(r: { kind: "match" | "masked"; id: string }) {
    router.push(r.kind === "match" ? `/matches/${r.id}` : `/masquerade/${r.id}`);
  }

  async function message() {
    if (p?.match_id) return openChat({ kind: "match", id: p.match_id });
    if (p?.masked_id) return openChat({ kind: "masked", id: p.masked_id });
    if (demo) return;
    setBusy("message");
    setError(null);
    const { data, error: err } = await supabase.rpc("message_person", { p_id: personId });
    if (err || !data) {
      setBusy(null);
      return setError(keysError(err?.message));
    }
    onChanged?.();
    // Paid chats from Meet start masked: you both unmask when you're ready
    const r = data as { kind: "match" | "masked"; id: string };
    if (r.kind === "masked") notify({ kind: "masked_start", sessionId: r.id });
    openChat(r);
  }

  async function wave() {
    if (!p || demo) {
      if (p) setP({ ...p, i_waved: true });
      return;
    }
    tapFeedback();
    setBusy("wave");
    setError(null);
    const { data, error: err } = await supabase.rpc("wave_person", { p_id: personId });
    setBusy(null);
    if (err || !data) return setError((err?.message?.includes("NOT_ENOUGH_KEYS") ? keysError(err.message) : err?.message?.replace(/^.*?: /, "")) || "Couldn't wave. Try again.");
    const r = data as { kind: "waved" | "match" | "masked"; id?: string; again?: boolean; mutual?: boolean };
    onChanged?.();
    if (r.kind === "waved") {
      setP({ ...p, i_waved: true });
      if (!r.again) notify({ kind: "wave", personId });
      return;
    }
    if (r.mutual) notify({ kind: "wave", personId });
    clearNotice(`wave-${personId}`);
    openChat({ kind: r.kind, id: r.id! });
  }

  if (!p) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40" role="dialog" aria-modal="true" aria-label="Profile">
        <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
        <div className="relative rounded-3xl bg-surface px-6 py-5 text-[14px] shadow-lift">{error ?? <Spinner />}</div>
      </div>
    );
  }

  const first = p.name?.split(" ")[0] ?? "them";
  const hidden = Math.max(0, p.photo_count - p.photos.length);
  const canPay = p.photos_paid !== false;
  const profile = { id: p.id, display_name: p.name, gender: p.gender, bio: p.bio, interests: p.interests, photos: p.photos, things: p.things ?? [] } as Profile;
  const both = p.shared_words?.length ? `You both mentioned ${listOf(p.shared_words)}` : null;
  const fresh = !p.match_id && !p.masked_id;
  // Waving first can cost Keys (set in admin); waving back is always free
  const waveCost = p.wave_cost ?? 0;
  const unlockButton = (
    <button
      type="button"
      onClick={unlock}
      disabled={!!busy}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-gold/50 bg-gold-soft px-3.5 text-[14px] font-bold text-[#8a5a00] disabled:opacity-60"
    >
      {busy === "photos" ? <Spinner className="h-4 w-4" /> : <KeyCoin size={18} />} Unlock · {p.photos_cost}
    </button>
  );

  return (
    <>
    <ProfileSheet
      profile={profile}
      age={p.age}
      locked={
        hidden > 0
          ? { count: hidden, note: canPay ? "They stay masked. Unlock them now, or they show free once you're connected." : "They show, masked, once you're connected.", action: canPay ? unlockButton : undefined }
          : undefined
      }
      commonWith={p.id}
      shared={p.shared_interests}
      onClose={onClose}
      note={[(personId in presence.seen ? isOnline(presence.seen[personId], presence.now) : p.online) ? "Online now" : null, p.place, both].filter(Boolean).join(" · ") || undefined}
      extra={
        <>
          {fresh && p.waved_me && (
            <section className="flex items-center gap-3 rounded-3xl bg-gold-soft p-4 shadow-card">
              <span className="text-[30px] leading-none" aria-hidden>👋</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{first} waved at you</p>
                <p className="text-[13px] text-ink-soft">Wave back and your chat opens, free.</p>
              </div>
            </section>
          )}

          {/* Older servers only sent the count before you'd connected */}
          {!p.match_id && (p.things_count ?? 0) > 0 && !(p.things?.length) && (
            <section className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-card">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Lock size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{p.things_count} {p.things_count === 1 ? "thing" : "things"} about {first}</p>
                <p className="text-[13px] text-muted">Shows once you&apos;ve both unmasked</p>
              </div>
            </section>
          )}
          {hidden > 0 && (
            <section className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-card">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-[#8a5a00]">
                <Lock size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{hidden} more {hidden === 1 ? "photo" : "photos"}</p>
                <p className="text-[13px] text-muted">{canPay ? "Free once you're connected" : "Shows once you're connected"}</p>
              </div>
              {canPay && unlockButton}
            </section>
          )}
        </>
      }
      footer={
        inChat ? undefined : (
        <div className="space-y-2">
          {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
          {fresh ? (
            <>
              <div className="flex gap-2">
                {p.waved_me ? (
                  <Button size="lg" variant="gold" onClick={wave} loading={busy === "wave"} loadingText="Opening…" className="flex-1">
                    <span aria-hidden>👋</span> Wave back · free chat
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={wave}
                    disabled={!!p.i_waved || !!busy}
                    loading={busy === "wave"}
                    loadingText="Waving…"
                    className="w-auto! shrink-0 px-5"
                    aria-label={p.i_waved ? `You waved at ${first}` : waveCost > 0 ? `Wave at ${first} for ${waveCost} Keys` : `Wave at ${first}, free`}
                  >
                    {p.i_waved ? (
                      <>
                        <Check size={18} /> Waved
                      </>
                    ) : (
                      <>
                        <span aria-hidden className="text-[20px]">👋</span> Wave
                        {waveCost > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[15px]">
                            · <KeyCoin size={18} /> {waveCost}
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                )}
                {/* People you've never met: break the ice instead of a plain message */}
                {!p.waved_me && (
                  <Button size="lg" onClick={() => setBreaking(true)} className="min-w-0 flex-1">
                    <Snowflake size={20} /> Break the ice
                  </Button>
                )}
              </div>
              {!p.waved_me && (
                <p className="text-center text-[12px] text-muted">Reply to one of {first}&apos;s cards, ask a This or That, send a voice hello or a game.</p>
              )}
              {!p.waved_me && p.i_waved && <p className="text-center text-[12px] text-muted">If {first} waves back, your chat opens free.</p>}
            </>
          ) : (
            <Button size="lg" onClick={message} loading={busy === "message"} loadingText="Opening chat…">
              <MessageCircle size={20} />
              {p.match_id ? "Message" : "Continue your masked chat"}
            </Button>
          )}
        </div>
        )
      }
    />
    {/* Break the ice, over the profile */}
    <IcebreakerSheet
      person={{ id: p.id, name: p.name, age: p.age, gender: p.gender, photo: p.photos[0] ?? null, place: p.place, intent: null, online: p.online, connected: false }}
      open={breaking}
      onClose={() => setBreaking(false)}
      onSent={onChanged}
      demo={!!demo}
      layer="z-[70]"
    />
    </>
  );
}

const listOf = (w: string[]) => (w.length < 2 ? w[0] : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`);
