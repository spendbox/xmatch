"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Intent } from "@/lib/types";
import { InviteSheet } from "./InviteSheet";

export type Invite = {
  id: string;
  intent: Intent;
  spice: number;
  from_age: number;
  distance_km: number | null;
  expires_at: string;
};

/** Shows a pop-up when someone masked is looking for someone like you. */
export function InviteListener({ userId }: { userId: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [needsKeys, setNeedsKeys] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("masquerade_invites")
      .select("id, intent, spice, from_age, distance_km, expires_at")
      .eq("to_user", userId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => data?.[0] && setInvite(data[0] as Invite));

    const channel = supabase
      .channel(`invites-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "masquerade_invites", filter: `to_user=eq.${userId}` },
        (payload) => setInvite(payload.new as Invite),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const accept = useCallback(async () => {
    if (!invite) return;
    setBusy(true);
    const supabase = createClient();
    if (needsKeys) {
      const { error: payErr } = await supabase.rpc("buy_masquerade_pass");
      if (payErr) {
        setBusy(false);
        setInvite(null);
        setNeedsKeys(false);
        setNote(payErr.message.includes("NOT_ENOUGH_KEYS") ? "You need 5 Keys to join. Get Keys from Home." : "Couldn't use Keys. Try again.");
        return;
      }
    }
    const { data, error } = await supabase.rpc("accept_masquerade_invite", { p_invite: invite.id });
    setBusy(false);
    if (error?.message.includes("NEEDS_KEYS")) {
      setNeedsKeys(true); // ask again, this time for 5 Keys
      return;
    }
    setInvite(null);
    setNeedsKeys(false);
    if (data) router.push(`/masquerade/${data}`);
    else setNote("They already found someone. Keep your mask handy!");
  }, [invite, router]);

  const decline = useCallback(async () => {
    if (!invite) return;
    const supabase = createClient();
    setInvite(null);
    await supabase.rpc("decline_masquerade_invite", { p_invite: invite.id });
  }, [invite]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  return (
    <>
      {invite && <InviteSheet invite={invite} busy={busy} needsKeys={needsKeys} onAccept={accept} onDecline={decline} onExpire={() => setInvite(null)} />}
      {note && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift animate-fade-up">
          {note}
        </div>
      )}
    </>
  );
}
