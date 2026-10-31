"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Gamepad2, Mic, Pause, Play, RotateCcw, Send, Shuffle, Sparkles, Split, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Spinner, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { CardFace } from "@/components/profile/ThingsStack";
import { VoiceIcon } from "@/components/chat/VoiceIcon";
import { useVoiceRecorder } from "@/components/chat/useVoiceRecorder";
import { decodeRecording, disguise, VOICE_STYLES, type VoiceStyle } from "@/lib/voiceDisguise";
import { formatDuration } from "@/lib/chatMedia";
import type { Thing } from "@/lib/things";
import type { ExplorePerson } from "@/lib/explore";

export type IceKind = "card" | "this" | "voice" | "game";
type Status = {
  free_left: number;
  free_per_day: number;
  prices: Record<IceKind, number>;
  sent: { id: string; kind: IceKind; expires_at: string } | null;
  received: string | null;
};
type Question = { q: string; a: string; b: string };

export const ICE_GAMES: { id: "whot" | "xo" | "ludo" | "tot"; name: string; emoji: string }[] = [
  { id: "whot", name: "Whot", emoji: "🃏" },
  { id: "xo", name: "X and O", emoji: "⭕" },
  { id: "ludo", name: "Ludo", emoji: "🎲" },
  { id: "tot", name: "This or That", emoji: "🤔" },
];
const MAX_VOICE = 15;

/** Little openers for the card they wrote, so nobody stares at an empty box */
function openers(thing: Thing) {
  const a = thing.a;
  const low = a.charAt(0).toLowerCase() + a.slice(1);
  switch (thing.p) {
    case "food":
      return [`${a}? Where's the best one in town?`, `Okay but who makes the best ${low}?`, `I'd fight you for the last plate of ${low} 😅`];
    case "music":
      return [`${a} is a vibe. Favourite song?`, `Concert or headphones for ${a}?`, `Top 3 ${a} songs. Go.`];
    case "trip":
      return [`${a}! Who would you take?`, `First thing you'd do in ${a}?`, `${a} is on my list too 👀`];
    case "team":
      return [`${a}? We need to talk 😤`, `Best ${a} player right now?`, `How was your ${a} weekend?`];
    default:
      return [`"${a}"? Okay, now I'm curious`, `Tell me more about "${low}"`, `Same here! What's the story?`];
  }
}

const SAMPLE: Question[] = [
  { q: "Beach day or owambe?", a: "Beach day", b: "Owambe" },
  { q: "Jollof or fried rice?", a: "Jollof", b: "Fried rice" },
  { q: "Night out or night in?", a: "Night out", b: "Night in" },
];

function cleanError(m: string | undefined) {
  if (!m) return "Couldn't send. Try again.";
  if (m.includes("NOT_ENOUGH_KEYS")) return "NOT_ENOUGH_KEYS";
  return m.replace(/^.*?: /, "");
}

function hoursLeft(iso: string) {
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
  return h >= 1 ? `${h}h left` : "less than an hour left";
}

/**
 * Break the ice with someone you've never met: reply to one of their "Things about me" cards,
 * ask a This or That, send a short voice hello, or challenge them to a game. They see it without
 * knowing who you are; if they answer, your masked chat opens. Each kind has its own price
 * (Admin → Prices), with a few free each day; Keys come back if they don't answer.
 */
export function IcebreakerSheet({
  person,
  open,
  onClose,
  onSent,
  demo,
  demoMode,
}: {
  person: ExplorePerson | null;
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  /** Design previews: sample data, nothing is sent */
  demo?: boolean;
  demoMode?: IceKind;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const first = person?.name.split(" ")[0] ?? "them";
  const [mode, setMode] = useState<IceKind>(demoMode ?? "card");
  const [status, setStatus] = useState<Status | null>(null);
  const [things, setThings] = useState<Thing[] | null>(null);
  const [ti, setTi] = useState(0);
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<"a" | "b" | null>(null);
  const [game, setGame] = useState<(typeof ICE_GAMES)[number]["id"]>("whot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Voice hello: record, pick a voice (disguised on the phone), listen, send
  const voice = useVoiceRecorder();
  const [raw, setRaw] = useState<AudioBuffer | null>(null);
  const [style, setStyle] = useState<VoiceStyle>("deep");
  const [clip, setClip] = useState<{ blob: Blob; seconds: number; url: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio() : null));

  // Fresh each time it opens
  useEffect(() => {
    if (!open || !person) return;
    setMode(demoMode ?? "card");
    setText("");
    setPick(null);
    setError(null);
    setDone(false);
    setTi(0);
    setRaw(null);
    setClip(null);
    if (demo) {
      setStatus({ free_left: 2, free_per_day: 3, prices: { card: 2, this: 2, voice: 3, game: 1 }, sent: null, received: null });
      setThings([
        { p: "food", a: "Jollof rice" },
        { p: "music", a: "Tems" },
      ]);
      setQuestions(SAMPLE);
      return;
    }
    setStatus(null);
    setThings(null);
    void supabase.rpc("ice_status", { p_to: person.id }).then(({ data }) => data && setStatus(data as Status));
    void supabase.rpc("explore_profile", { p_id: person.id }).then(({ data }) => {
      const t = (data as { things?: Thing[] } | null)?.things;
      setThings(Array.isArray(t) ? t.filter((x) => x?.a) : []);
    });
    void supabase
      .from("tot_questions")
      .select("prompt, a, b")
      .eq("active", true)
      .lte("spice", 1)
      .limit(60)
      .then(({ data }) => {
        const list = ((data ?? []) as { prompt: string; a: string; b: string }[]).map((r) => ({ q: r.prompt, a: r.a, b: r.b }));
        setQuestions(list.length ? list.sort(() => Math.random() - 0.5) : SAMPLE);
      });
  }, [open, person, demo, demoMode, supabase]);

  // No cards to reply to: start on This or That
  useEffect(() => {
    if (things && !things.length && mode === "card") setMode("this");
  }, [things, mode]);

  // A new voice picked: disguise it again
  useEffect(() => {
    if (!raw) return;
    let live = true;
    disguise(raw, style).then((r) => {
      if (!live) return;
      setClip((c) => {
        if (c) URL.revokeObjectURL(c.url);
        return { ...r, url: URL.createObjectURL(r.blob) };
      });
    });
    return () => {
      live = false;
    };
  }, [raw, style]);

  // Up to 15 seconds
  useEffect(() => {
    if (voice.recording && voice.seconds >= MAX_VOICE) void stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.recording, voice.seconds]);

  async function stopRecording() {
    const r = await voice.stop();
    if (!r || r.seconds < 1) return setError("That was too short. Hold on a little longer.");
    try {
      setRaw(await decodeRecording(r.blob));
    } catch {
      setError("Couldn't read that recording. Try again.");
    }
  }

  function close() {
    voice.cancel();
    audio?.pause();
    onClose();
  }

  const thing = things?.length ? things[ti % things.length] : null;
  const question = questions.length ? questions[qi % questions.length] : SAMPLE[0];
  const price = !status ? null : mode === "game" ? status.prices.game : status.free_left > 0 ? 0 : status.prices[mode];
  const ready =
    mode === "card" ? !!thing && !!text.trim() : mode === "this" ? !!pick : mode === "voice" ? !!clip && !voice.recording : true;

  async function send() {
    if (!person || !ready || busy) return;
    tapFeedback();
    setBusy(true);
    setError(null);
    if (demo) {
      setBusy(false);
      setDone(true);
      return;
    }
    try {
      let voiceKey: string | null = null;
      if (mode === "voice" && clip) {
        const res = await fetch("/api/media/ice-voice", { method: "POST" });
        const link = (await res.json().catch(() => null)) as { key?: string; upload?: string; error?: string } | null;
        if (!res.ok || !link?.key || !link.upload) throw new Error(link?.error || "Couldn't send. Try again.");
        const put = await fetch(link.upload, { method: "PUT", body: clip.blob, headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
        if (!put.ok) throw new Error("Couldn't upload. Check your connection and try again.");
        voiceKey = link.key;
      }
      const { data, error: err } = await supabase.rpc("ice_send", {
        p_to: person.id,
        p_kind: mode,
        p_body: mode === "card" || mode === "game" ? text.trim() || null : null,
        p_thing: mode === "card" ? thing : null,
        p_question: mode === "this" ? question : null,
        p_pick: mode === "this" ? pick : null,
        p_voice_key: voiceKey,
        p_voice_seconds: mode === "voice" ? clip?.seconds ?? null : null,
        p_voice_style: mode === "voice" ? style : null,
        p_game: mode === "game" ? game : null,
      });
      if (err) throw new Error(cleanError(err.message));
      const r = data as { kind: "sent" | "masked" | "match"; id: string };
      // Already talking: go to that chat instead
      if (r.kind === "masked") return router.push(`/masquerade/${r.id}`);
      if (r.kind === "match") return router.push(`/matches/${r.id}`);
      notify({ kind: "icebreaker", iceId: r.id });
      setDone(true);
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const waitingFor = status?.sent;
  const theyWaiting = status?.received;

  return (
    <Sheet
      open={open}
      onClose={close}
      title={done ? "Sent!" : `Break the ice with ${first}`}
      subtitle={done ? undefined : `${first} sees it without knowing who you are. If ${first} answers, your masked chat opens.`}
      footer={
        done || waitingFor || theyWaiting ? (
          <Button size="lg" variant="secondary" onClick={close}>
            Done
          </Button>
        ) : (
          <div className="space-y-2">
            {error && error !== "NOT_ENOUGH_KEYS" && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
            {error === "NOT_ENOUGH_KEYS" ? (
              <Link href="/wallet" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-ink">
                <KeyCoin size={22} /> Get Keys
              </Link>
            ) : (
              <Button size="lg" onClick={send} disabled={!ready || !status} loading={busy} loadingText="Sending…">
                {mode === "game" ? <Gamepad2 size={18} /> : <Send size={18} />}
                {mode === "game" ? "Challenge" : "Send"} ·{" "}
                {price === null ? (
                  "…"
                ) : price === 0 ? (
                  "free"
                ) : (
                  <>
                    <KeyCoin size={18} /> {price}
                  </>
                )}
              </Button>
            )}
            {/* When you pay, and when it comes back */}
            {status && (
              <p className="text-center text-[12px] leading-snug text-muted">
                {mode === "game"
                  ? `Back to you if ${first} doesn't accept in 30 minutes.`
                  : status.free_left > 0
                    ? `${status.free_left} of ${status.free_per_day} free today. After that ${status.prices[mode]} Keys, back to you if ${first} doesn't answer in 2 days.`
                    : `Back to you if ${first} doesn't answer in 2 days.`}
              </p>
            )}
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-mint-soft text-mint">
            <Check size={30} strokeWidth={2.5} />
          </span>
          <p className="max-w-[280px] text-[15px] text-ink-soft">
            We&apos;ll let you know when {first} answers. Then your masked chat opens, and you&apos;ll find it in Chats.
          </p>
        </div>
      ) : waitingFor ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-center text-[14px] text-brand-ink">
          You already broke the ice with {first}. Waiting for an answer · {hoursLeft(waitingFor.expires_at)}.
        </p>
      ) : theyWaiting ? (
        <div className="space-y-3 text-center">
          <p className="rounded-2xl bg-gold-soft px-4 py-3 text-[14px] text-[#8a5a00]">{first} already broke the ice with you!</p>
          <Link href="/matches?f=ice" className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white">
            Answer in Chats
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* How to break the ice */}
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["card", "Their card", <Sparkles key="i" size={20} />],
                ["this", "This or That", <Split key="i" size={20} />],
                ["voice", "Voice hello", <Mic key="i" size={20} />],
                ["game", "Play a game", <Gamepad2 key="i" size={20} />],
              ] as const
            ).map(([k, label, icon]) => {
              const off = k === "card" && things !== null && !things.length;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    tapFeedback();
                    setError(null);
                    setMode(k);
                  }}
                  aria-pressed={mode === k}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 rounded-2xl border py-2.5 text-[11.5px] font-semibold transition active:scale-95 disabled:opacity-40",
                    mode === k ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-soft",
                  )}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>

          {mode === "card" &&
            (!things ? (
              <div className="grid h-40 place-items-center">
                <Spinner className="h-6 w-6 text-brand" />
              </div>
            ) : thing ? (
              <>
                <div className="mx-auto aspect-[4/3] w-full max-w-[300px] overflow-hidden rounded-[24px] shadow-[0_18px_40px_-20px_rgba(28,24,40,0.55)]">
                  <CardFace thing={thing} big />
                </div>
                {things.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTi((i) => i + 1);
                      setText("");
                    }}
                    className="mx-auto -mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-brand"
                  >
                    <Shuffle size={15} /> Another of {first}&apos;s cards
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  {openers(thing).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setText(o)}
                      className={clsx("rounded-full border px-3 py-1.5 text-left text-[13px] transition", text === o ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-soft")}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  maxLength={160}
                  placeholder={`Say something about "${thing.a}"…`}
                  className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-brand"
                />
              </>
            ) : null)}

          {mode === "this" && (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-muted">Pick your answer. {first} answers without seeing it, then you both find out.</p>
              <div className="rounded-[24px] bg-brand-soft p-4">
                <p className="text-center font-display text-[20px] leading-tight font-semibold text-brand-ink [text-wrap:balance]">{question.q}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        tapFeedback();
                        setPick(k);
                      }}
                      aria-pressed={pick === k}
                      className={clsx(
                        "rounded-2xl border-2 px-2 py-3 text-center text-[15px] font-semibold transition active:scale-95",
                        pick === k ? "border-brand bg-surface text-brand-ink" : "border-transparent bg-surface text-ink",
                      )}
                    >
                      {question[k]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQi((i) => i + 1);
                  setPick(null);
                }}
                className="mx-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand"
              >
                <Shuffle size={15} /> Another question
              </button>
            </div>
          )}

          {mode === "voice" && (
            <div className="flex flex-col items-center gap-3 py-1">
              {!clip || voice.recording ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setError(null);
                      if (voice.recording) void stopRecording();
                      else {
                        setRaw(null);
                        setClip(null);
                        void voice.start();
                      }
                    }}
                    className={clsx("relative grid h-20 w-20 place-items-center rounded-full text-white shadow-lift transition active:scale-95", voice.recording ? "bg-chili" : "bg-brand")}
                    aria-label={voice.recording ? "Stop recording" : "Start recording"}
                  >
                    {voice.recording && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-chili/40" />}
                    {voice.recording ? <Square size={26} fill="currentColor" /> : <Mic size={32} />}
                  </button>
                  <p className="text-[14px] font-semibold tabular-nums">
                    {voice.recording ? `${formatDuration(voice.seconds)} / ${formatDuration(MAX_VOICE)}` : "Tap to say hi (up to 15 seconds)"}
                  </p>
                  {voice.error && <p className="text-[13px] text-chili">{voice.error}</p>}
                </>
              ) : (
                <>
                  <div className="flex w-full items-center gap-3 rounded-2xl bg-brand-soft p-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!audio) return;
                        if (playing) {
                          audio.pause();
                          setPlaying(false);
                        } else {
                          audio.src = clip.url;
                          audio.onended = () => setPlaying(false);
                          void audio.play().then(() => setPlaying(true)).catch(() => {});
                        }
                      }}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white"
                      aria-label={playing ? "Pause" : "Listen"}
                    >
                      {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <p className="min-w-0 flex-1 text-[14px] font-semibold text-brand-ink">
                      Listen · {formatDuration(clip.seconds)} · {VOICE_STYLES.find((v) => v.id === style)?.label} voice
                    </p>
                    <button type="button" onClick={() => setClip(null)} className="grid h-9 w-9 place-items-center rounded-full text-brand" aria-label="Record again">
                      <RotateCcw size={18} />
                    </button>
                  </div>
                  <div className="grid w-full grid-cols-4 gap-2">
                    {VOICE_STYLES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          audio?.pause();
                          setPlaying(false);
                          setStyle(v.id);
                        }}
                        className={clsx("flex flex-col items-center gap-1 rounded-2xl border py-2 text-[12px] font-semibold", style === v.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-soft")}
                      >
                        <VoiceIcon style={v.id} size={22} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                  {style === "normal" && <p className="text-[12.5px] text-muted">{first} will hear your real voice.</p>}
                </>
              )}
            </div>
          )}

          {mode === "game" && (
            <div className="space-y-3">
              <p className="text-center text-[13px] text-muted">Challenge {first} to a quick game. If {first} accepts, you play masked and chat while you play.</p>
              <div className="grid grid-cols-2 gap-2">
                {ICE_GAMES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGame(g.id)}
                    aria-pressed={game === g.id}
                    className={clsx("flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left text-[14px] font-semibold transition", game === g.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface")}
                  >
                    <span className="text-[22px]">{g.emoji}</span> {g.name}
                  </button>
                ))}
              </div>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={160}
                placeholder="Add a line (optional): loser buys the Chapman 😄"
                className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none focus:border-brand"
              />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
