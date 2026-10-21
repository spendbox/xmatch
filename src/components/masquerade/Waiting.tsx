"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { intentLabel, spiceLabel, SEEKING } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Chilis } from "@/components/ui/Spice";
import type { SetupPrefs } from "@/components/home/prefs";

const TIPS = [
  "Ask follow-up questions. Curiosity is attractive.",
  "No photos, no names. Let your personality lead.",
  "You'll both decide to unmask when the timer ends.",
  "If the vibe is off, you can leave any time.",
];

export function Waiting({ prefs, userId, onCancel }: { prefs: SetupPrefs; userId: string; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const found = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const go = (id: string) => {
      if (found.current) return;
      found.current = true;
      window.location.assign(`/masquerade/${id}`);
    };

    const poll = async () => {
      const { data } = await supabase.rpc("poll_masquerade");
      if (data) go(data as string);
    };
    const pollTimer = setInterval(poll, 3000);
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000);

    const channel = supabase.channel(`waiting-${userId}`);
    for (const col of ["user_a", "user_b"]) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "masquerade_sessions", filter: `${col}=eq.${userId}` },
        (p) => go((p.new as { id: string }).id),
      );
    }
    channel.subscribe();

    return () => {
      clearInterval(pollTimer);
      clearInterval(clock);
      supabase.removeChannel(channel);
      if (!found.current) supabase.rpc("cancel_masquerade").then(() => {});
    };
  }, [userId]);

  const [cancelling, setCancelling] = useState(false);
  async function cancel() {
    setCancelling(true);
    await createClient().rpc("cancel_masquerade");
    onCancel();
  }

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  const tip = TIPS[Math.floor(seconds / 6) % TIPS.length];
  const seeking = SEEKING.find((s) => s.value === prefs.seeking)?.label;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-md flex-col items-center px-5 pt-14 text-center">
      <div className="relative grid h-44 w-44 place-items-center">
        <span className="absolute inset-0 rounded-full bg-brand/20 animate-pulse-ring" />
        <span className="absolute inset-0 rounded-full bg-brand/15 animate-pulse-ring [animation-delay:1.1s]" />
        <span className="relative grid h-28 w-28 place-items-center rounded-full bg-brand text-white shadow-lift animate-float">
          <MaskIcon className="w-16" eyes="#5b3fd9" />
        </span>
      </div>

      <h1 className="mt-8 font-display text-[28px] leading-tight font-semibold">Finding your masked match…</h1>
      <p className="mt-2 text-[15px] text-muted tabular-nums">
        Looking for {mm}:{ss}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Pill>{intentLabel(prefs.intent)}</Pill>
        <Pill>{seeking}</Pill>
        <Pill>
          {prefs.ageMin}–{prefs.ageMax}
        </Pill>
        <Pill>{prefs.maxKm ? `Within ${prefs.maxKm} km` : "Anywhere"}</Pill>
        <Pill>
          <Chilis level={prefs.spice} /> {spiceLabel(prefs.spice)}
        </Pill>
      </div>

      <p key={tip} className="mt-10 max-w-xs rounded-2xl bg-surface px-5 py-4 text-[15px] leading-relaxed text-ink-soft shadow-card animate-fade-up">
        {seconds > 60 ? "It's a little quiet right now. Stay here — we'll match you as soon as someone joins." : tip}
      </p>

      <div className="mt-auto w-full pt-10 pb-4">
        <Button variant="secondary" size="lg" onClick={cancel} loading={cancelling} loadingText="Taking off mask…">
          Take off mask
        </Button>
      </div>
    </main>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink-soft">
      {children}
    </span>
  );
}
