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
  expires_at: string;
};

/** Shows a pop-up when someone masked is looking for someone like you. */
export function InviteListener({ userId }: { userId: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("masquerade_invites")
      .select("id, intent, spice, from_age, expires_at")
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
    const { data } = await supabase.rpc("accept_masquerade_invite", { p_invite: invite.id });
    setBusy(false);
    setInvite(null);
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
      {invite && <InviteSheet invite={invite} busy={busy} onAccept={accept} onDecline={decline} onExpire={() => setInvite(null)} />}
      {note && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift animate-fade-up">
          {note}
        </div>
      )}
    </>
  );
}
