"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Gamepad2, Mic, Sparkles, Split } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { MaskAvatar } from "@/components/feed/MaskAvatar";
import { Photo } from "@/components/ui/Photo";
import { AudioPlayer } from "@/components/chat/AudioPlayer";
import { tapFeedback } from "@/components/ui/Button";
import { promptOf } from "@/lib/things";
import { voiceUrl } from "@/lib/voiceDisguise";
import { ICE_GAMES, type IceKind } from "@/components/home/IcebreakerSheet";
import { refreshMenuBadges } from "@/components/app/useMenuBadges";

/** Someone masked broke the ice with you */
export type IcebreakerIn = {
  id: string;
  alias: string;
  age: number | null;
  kind: IceKind;
  /** Your card they replied to */
  thing?: { p: string; a: string } | null;
  question?: { q: string; a: string; b: string } | null;
  body?: string | null;
  voice_key?: string | null;
  voice_seconds?: number | null;
  game?: string | null;
  expires_at: string;
};

/** One you sent */
export type IcebreakerOut = {
  id: string;
  name: string | null;
  photo: string | null;
  kind: IceKind;
  status: "pending" | "answered" | "declined" | "expired";
  paid: number;
  session_id: string | null;
  expires_at: string;
};

export type MyIcebreakers = { received: IcebreakerIn[]; sent: IcebreakerOut[] };

const KIND = {
  card: { icon: <Sparkles size={13} />, label: "Replied to your card", sent: "Replied to their card" },
  this: { icon: <Split size={13} />, label: "Asked you This or That", sent: "This or That" },
  voice: { icon: <Mic size={13} />, label: "Sent a voice hello", sent: "Voice hello" },
  game: { icon: <Gamepad2 size={13} />, label: "Wants to play", sent: "Game challenge" },
};

function left(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h}h left` : `${Math.max(1, Math.round(ms / 60_000))}m left`;
}

/**
 * Chats → Icebreakers: answer one and your masked chat opens (a game starts straight away),
 * or "Not now" (their Keys go back to them). Below, the ones you sent and how they went.
 */
export function IcebreakersReceived({ data, onChanged, demo }: { data: MyIcebreakers | null; onChanged?: () => void; demo?: boolean }) {
  if (!data) return <p className="rounded-2xl bg-surface p-4 text-center text-[14px] text-muted">Loading…</p>;
  return (
    <div className="space-y-5">
      {data.received.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-center text-[14px] text-muted">
          No icebreakers right now. When someone breaks the ice with you, it shows up here.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {data.received.map((i) => (
            <Received key={i.id} i={i} onChanged={onChanged} demo={demo} />
          ))}
        </ul>
      )}

      {data.sent.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">You sent</h3>
          <ul className="divide-y divide-line rounded-3xl border border-line bg-surface">
            {data.sent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-soft">
                  {s.photo && <Photo src={s.photo} className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14.5px] font-semibold">{s.name ?? "Someone"}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                    {KIND[s.kind].icon} {KIND[s.kind].sent}
                  </span>
                </span>
                {s.status === "answered" && s.session_id ? (
                  <a href={`/masquerade/${s.session_id}`} className="inline-flex h-9 shrink-0 items-center rounded-full bg-brand px-3.5 text-[12.5px] font-semibold text-white">
                    Answered · Chat
                  </a>
                ) : s.status === "pending" ? (
                  <span className="shrink-0 text-[12px] font-medium text-muted">Waiting · {left(s.expires_at)}</span>
                ) : (
                  <span className="shrink-0 text-right text-[12px] leading-tight text-muted">
                    {s.status === "declined" ? "Not now" : "No answer"}
                    {s.paid > 0 && <span className="block text-mint">{s.paid} Keys back</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Received({ i, onChanged, demo }: { i: IcebreakerIn; onChanged?: () => void; demo?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [text, setText] = useState("");
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const [busy, setBusy] = useState<"answer" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsText = i.kind === "card" || i.kind === "voice";
  const ready = i.kind === "this" ? !!pick : needsText ? !!text.trim() : true;
  const gameName = ICE_GAMES.find((g) => g.id === i.game);

  async function answer() {
    if (!ready || busy || demo) return;
    tapFeedback();
    setBusy("answer");
    setError(null);
    const { data, error: err } = await supabase.rpc("ice_answer", { p_id: i.id, p_text: text.trim() || null, p_pick: pick });
    if (err || !data) {
      setBusy(null);
      return setError(err?.message?.replace(/^.*?: /, "") || "Couldn't answer. Try again.");
    }
    notify({ kind: "icebreaker_answer", iceId: i.id });
    refreshMenuBadges();
    const r = data as { session_id: string; game_id?: string | null };
    router.push(`/masquerade/${r.session_id}`);
  }

  async function decline() {
    if (busy || demo) return;
    setBusy("decline");
    await supabase.rpc("ice_decline", { p_id: i.id });
    setBusy(null);
    refreshMenuBadges();
    onChanged?.();
  }

  return (
    <li className="rounded-3xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-3">
        <MaskAvatar alias={i.alias} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-semibold">
            {i.alias}
            {i.age != null && <span className="font-normal text-muted">, {i.age}</span>}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-brand">
            {KIND[i.kind].icon} {i.kind === "game" && gameName ? `Wants to play ${gameName.name} ${gameName.emoji}` : KIND[i.kind].label}
          </p>
        </div>
        <span className="shrink-0 text-[11.5px] text-muted">{left(i.expires_at)}</span>
      </div>

      {/* What they sent */}
      {i.kind === "card" && i.thing && (
        <p className="mt-3 truncate rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: promptOf(i.thing.p).tone }}>
          {promptOf(i.thing.p).text} {i.thing.a}
        </p>
      )}
      {i.kind === "voice" && i.voice_key ? (
        <div className="mt-2 w-fit max-w-full rounded-2xl rounded-tl-md bg-cream px-2 py-1.5">
          <AudioPlayer localUrl={voiceUrl(i.voice_key) ?? undefined} duration={i.voice_seconds ?? undefined} seed={i.alias.length} />
        </div>
      ) : (
        i.body && <p className="mt-2 w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-cream px-3.5 py-2 text-[14.5px]">{i.body}</p>
      )}

      {/* Your answer */}
      {i.kind === "this" && i.question && (
        <div className="mt-3 rounded-2xl bg-brand-soft p-3">
          <p className="text-center font-display text-[17px] font-semibold text-brand-ink">{i.question.q}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["a", "b"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPick(k)}
                aria-pressed={pick === k}
                className={clsx("rounded-xl border-2 py-2.5 text-[14px] font-semibold transition", pick === k ? "border-brand bg-surface text-brand-ink" : "border-transparent bg-surface")}
              >
                {pick === k && <Check size={14} className="mr-1 inline" />}
                {i.question![k]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11.5px] text-muted">You&apos;ll see what they picked once you answer.</p>
        </div>
      )}
      {i.kind !== "game" && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={i.kind === "this" ? "Add a message (optional)" : "Write your reply…"}
          className="mt-3 h-11 w-full rounded-full border border-line bg-surface px-4 text-[14.5px] outline-none focus:border-brand"
        />
      )}
      {error && <p className="mt-2 text-[13px] font-medium text-chili">{error}</p>}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button type="button" onClick={answer} disabled={!ready || !!busy} className="h-10 rounded-full bg-brand text-[14px] font-semibold text-white disabled:opacity-50">
          {busy === "answer" ? "Opening your chat…" : i.kind === "game" ? "Accept and play" : i.kind === "this" ? "Answer" : "Reply"}
        </button>
        <button type="button" onClick={decline} disabled={!!busy} className="h-10 rounded-full border border-line px-4 text-[14px] font-semibold text-ink-soft disabled:opacity-50">
          Not now
        </button>
      </div>
    </li>
  );
}
