"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { gameInfo } from "@/lib/games";
import { meetError, meetLeft, type Meet } from "@/lib/meets";
import { tapFeedback, Spinner } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";

/** The square on the left of a meet: the game's colours, or a speech bubble for a text post */
export function MeetTile({ meet, size = 56 }: { meet: Pick<Meet, "kind" | "game">; size?: number }) {
  if (meet.kind === "game" && meet.game) {
    const g = gameInfo(meet.game);
    return (
      <span
        className="grid shrink-0 place-items-center rounded-[18px] text-gold"
        style={{ width: size, height: size, background: g.card, boxShadow: `0 3px 0 ${g.edge}` }}
        aria-hidden
      >
        <Gamepad2 size={Math.round(size * 0.46)} />
      </span>
    );
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-[18px] bg-brand-soft text-brand" style={{ width: size, height: size }} aria-hidden>
      <MessageCircle size={Math.round(size * 0.43)} />
    </span>
  );
}

/** Someone's meet. Tap it to open a masked chat with them. */
export function MeetCard({ meet, now }: { meet: Meet; now: number | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = meet.kind === "game" && meet.game ? `${meet.alias} · ${gameInfo(meet.game).title}` : meet.alias;
  const line = meet.body || (meet.game ? gameInfo(meet.game).short : "");

  async function open() {
    tapFeedback();
    if (meet.session_id) return router.push(`/masquerade/${meet.session_id}`);
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("join_meet", { p_meet: meet.id });
    if (err || !data) {
      setBusy(false);
      return setError(meetError(err?.message));
    }
    notify({ kind: "meet_join", sessionId: data as string });
    router.push(`/masquerade/${data as string}`);
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-label={`Meet ${meet.alias}`}
        className="flex w-full items-center gap-3 rounded-3xl bg-surface p-3 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99] disabled:opacity-70"
      >
        <MeetTile meet={meet} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{title}</span>
          {line && <span className="mt-0.5 block truncate text-[13px] text-muted">“{line}”</span>}
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-ink-soft">{now ? meetLeft(meet.ends_at, now) : " "}</span>
            {meet.session_id && <span className="rounded-full bg-mint-soft px-2.5 py-1 text-[12px] font-semibold text-mint">Chatting</span>}
          </span>
        </span>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_6px_18px_-8px_rgb(91_63_217/0.6)]" aria-hidden>
          {busy ? <Spinner /> : <MaskIcon className="w-[26px]" eyes="#5b3fd9" />}
        </span>
      </button>
      {error && <p className="mt-1.5 px-3 text-[13px] font-medium text-chili">{error}</p>}
    </div>
  );
}
