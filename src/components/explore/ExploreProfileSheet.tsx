"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { intentLabel } from "@/lib/constants";
import type { ExploreProfile } from "@/lib/explore";
import type { Profile } from "@/lib/types";
import { Button, Spinner } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { keysError } from "@/components/keys/GiftSheet";
import { ProfileSheet } from "@/components/matches/ProfileSheet";

/** Someone's profile from Explore: unlock their other photos, or pay to message them */
export function ExploreProfileSheet({
  personId,
  onClose,
  onChanged,
  demo,
}: {
  personId: string;
  onClose: () => void;
  /** Keys were spent (refresh the wallet) */
  onChanged?: () => void;
  /** Design previews */
  demo?: ExploreProfile;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [p, setP] = useState<ExploreProfile | null>(demo ?? null);
  const [busy, setBusy] = useState<"photos" | "message" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    supabase.rpc("explore_profile", { p_id: personId }).then(({ data }) => {
      if (data) setP(data as ExploreProfile);
      else setError("This profile isn't available.");
    });
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

  async function message() {
    if (p?.match_id) return router.push(`/matches/${p.match_id}`);
    setBusy("message");
    setError(null);
    const { data, error: err } = await supabase.rpc("message_person", { p_id: personId });
    if (err || !data) {
      setBusy(null);
      return setError(keysError(err?.message));
    }
    onChanged?.();
    router.push(`/matches/${data as string}`);
  }

  if (!p) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40" role="dialog" aria-modal="true" aria-label="Profile">
        <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
        <div className="relative rounded-3xl bg-surface px-6 py-5 text-[14px] shadow-lift">{error ?? <Spinner />}</div>
      </div>
    );
  }

  const hidden = p.photo_count - p.photos.length;
  const profile = { id: p.id, display_name: p.name, gender: p.gender, bio: p.bio, interests: p.interests, photos: p.photos } as Profile;

  return (
    <ProfileSheet
      profile={profile}
      age={p.age}
      shared={p.shared_interests}
      onClose={onClose}
      note={[p.online ? "Online now" : null, p.place, p.intent ? intentLabel(p.intent) : null].filter(Boolean).join(" · ") || undefined}
      extra={
        !p.photos_unlocked && hidden > 0 ? (
          <section className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-card">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-[#8a5a00]">
              <Lock size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">
                {hidden} more {hidden === 1 ? "photo" : "photos"}
              </p>
              <p className="text-[13px] text-muted">Free once you&apos;re connected</p>
            </div>
            <button
              type="button"
              onClick={unlock}
              disabled={!!busy}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-gold/50 bg-gold-soft px-3.5 text-[14px] font-bold text-[#8a5a00] disabled:opacity-60"
            >
              {busy === "photos" ? <Spinner className="h-4 w-4" /> : <KeyCoin size={18} />} Unlock · {p.photos_cost}
            </button>
          </section>
        ) : null
      }
      footer={
        <div className="space-y-2">
          {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
          <Button size="lg" onClick={message} loading={busy === "message"} loadingText="Opening chat…">
            <MessageCircle size={20} />
            {p.match_id ? (
              "Message"
            ) : (
              <>
                Message · <KeyCoin size={20} /> {p.message_cost}
              </>
            )}
          </Button>
        </div>
      }
    />
  );
}
