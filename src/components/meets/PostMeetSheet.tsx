"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronRight, Gamepad2, MapPin, MessageCircle, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GAMES, type GameKind } from "@/lib/games";
import { intentLabel, seekingLabel } from "@/lib/constants";
import { meetError } from "@/lib/meets";
import { Sheet } from "@/components/ui/Sheet";
import { Choice } from "@/components/ui/Choice";
import { Button, tapFeedback } from "@/components/ui/Button";
import { INTENT_ICONS } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { usePrices } from "@/components/keys/usePrices";
import type { SetupPrefs } from "@/components/home/prefs";
import { MeetTile } from "./MeetCard";

const TEXT_MAX = 140;
const LINE_MAX = 80;

/** Post a meet in three steps: game or text, the game (or the words), then check and post. */
export function PostMeetSheet({
  open,
  onClose,
  prefs,
  place,
  cost,
  hours,
  onEditSettings,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  /** Your Masquerade settings: who gets to see the meet */
  prefs: SetupPrefs;
  place: string | null;
  cost: number;
  hours: number;
  onEditSettings: () => void;
  onPosted: (balance: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const prices = usePrices();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<"game" | "text">("game");
  const [game, setGame] = useState<GameKind | null>(null);
  const [line, setLine] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const games = GAMES.filter((g) => (prices as Record<string, number>)[`game_${g.kind}`] !== 0);

  // Start fresh each time it opens
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
  }, [open]);

  const body = kind === "game" ? line.trim() : text.trim();
  const ready = step === 1 || (step === 2 && (kind === "game" ? !!game : body.length > 0)) || step === 3;

  async function post() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("post_meet", { p_kind: kind, p_game: kind === "game" ? game : null, p_body: body });
    setBusy(false);
    if (err) return setError(meetError(err.message));
    setLine("");
    setText("");
    setGame(null);
    onPosted((data as { balance: number }).balance);
  }

  const titles = ["Post a meet", kind === "game" ? "Pick your game" : "Say something", "Ready to post?"];
  const subtitles = [
    `It stays up for ${hours} ${hours === 1 ? "hour" : "hours"}. Meet as many people as you like from it.`,
    kind === "game" ? "Everyone who meets you from this post plays you in it, one at a time." : "A question or a hot take works best. Each reply opens a masked chat with you.",
    "Only people who fit your Masquerade settings, and whose settings fit you, will see it.",
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={titles[step - 1]}
      subtitle={subtitles[step - 1]}
      icon={step === 1 ? <UsersRound size={22} strokeWidth={1.75} /> : kind === "game" ? <Gamepad2 size={22} strokeWidth={1.75} /> : <MessageCircle size={22} strokeWidth={1.75} />}
      footer={
        <div className="space-y-3">
          <div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={clsx("h-1.5 flex-1 rounded-full transition", n <= step ? "bg-brand" : "bg-line-strong")} />
            ))}
          </div>
          {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
          <div className="flex gap-2.5">
            {step > 1 && (
              <Button variant="secondary" size="lg" className="w-auto! shrink-0 px-6" onClick={() => setStep((s) => s - 1)} disabled={busy}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button size="lg" disabled={!ready} onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button size="lg" onClick={post} loading={busy} loadingText="Posting…">
                {cost > 0 ? (
                  <>
                    Post · <KeyCoin size={20} /> {cost}
                  </>
                ) : (
                  "Post · Free"
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {step === 1 && (
        <Choice
          name="What do you want to post?"
          columns={1}
          layout="row"
          value={kind}
          onChange={setKind}
          options={[
            { value: "game", label: "Game challenge", hint: "Play a quick game first, then decide", icon: <Gamepad2 size={22} strokeWidth={1.75} /> },
            { value: "text", label: "Text post", hint: "Say something. People reply and you chat", icon: <MessageCircle size={22} strokeWidth={1.75} /> },
          ]}
        />
      )}

      {step === 2 && kind === "game" && (
        <div className="space-y-5">
          <div role="radiogroup" aria-label="Game" className="grid grid-cols-2 gap-3">
            {games.map((g) => {
              const on = game === g.kind;
              return (
                <button
                  key={g.kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    tapFeedback();
                    setGame(g.kind);
                  }}
                  className={clsx("relative flex min-h-[120px] flex-col justify-end rounded-[22px] p-3.5 text-left text-white transition active:scale-[0.97]", on && "ring-[3px] ring-gold ring-offset-[3px] ring-offset-surface")}
                  style={{ background: g.card, boxShadow: `0 4px 0 ${g.edge}` }}
                >
                  {on && (
                    <span className="absolute top-2.5 right-2.5 grid h-6 w-6 animate-pop place-items-center rounded-full bg-gold text-ink">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                  <span className="text-[15px] leading-tight font-extrabold">{g.title}</span>
                  <span className="text-[12px] text-white/75">{g.short}</span>
                </button>
              );
            })}
          </div>
          <label className="block">
            <span className="mb-2 block text-[14px] font-semibold">
              Add a line <span className="font-medium text-muted">(optional)</span>
            </span>
            <input
              value={line}
              onChange={(e) => setLine(e.target.value.slice(0, LINE_MAX))}
              placeholder="Nobody has beaten me this week"
              className="h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-brand"
            />
          </label>
        </div>
      )}

      {step === 2 && kind === "text" && (
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold">Your post</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            rows={4}
            placeholder="Best small chops spot in town? Wrong answers only"
            className="w-full resize-none rounded-2xl border border-line-strong bg-surface px-4 py-3 text-[16px] leading-snug outline-none focus:border-brand"
          />
          <span className="mt-1 block text-right text-[12px] text-muted">
            {text.length} / {TEXT_MAX}
          </span>
        </label>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-cream p-3">
            <MeetTile meet={{ kind, game }} size={44} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{kind === "game" && game ? GAMES.find((g) => g.kind === game)?.title : "Text post"}</p>
              {body && <p className="truncate text-[13px] text-muted">“{body}”</p>}
            </div>
          </div>

          <section className="rounded-2xl border border-line">
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
              <div>
                <p className="text-[14px] font-semibold">Shown to people who fit</p>
                <p className="text-[12px] text-muted">From your Masquerade settings</p>
              </div>
              <button type="button" onClick={onEditSettings} className="inline-flex h-9 items-center gap-0.5 rounded-full px-2 text-[13px] font-semibold text-brand hover:bg-brand-soft">
                Change <ChevronRight size={16} />
              </button>
            </div>
            <ul className="divide-y divide-line px-4">
              <Setting icon={INTENT_ICONS[prefs.intent]({ size: 18 })} label="In the mood for" value={intentLabel(prefs.intent)} />
              <Setting icon={<UsersRound size={18} strokeWidth={1.75} />} label="Who you meet" value={`${seekingLabel(prefs.seeking)} · ${prefs.ageMin}–${prefs.ageMax}`} />
              <Setting icon={<MapPin size={18} strokeWidth={1.75} />} label="Where you are" value={place ? `${place} · closest first` : "Anywhere"} />
            </ul>
          </section>

          <div className="space-y-2 rounded-2xl border border-line px-4 py-3.5 text-[14px]">
            <p className="flex items-center justify-between">
              <span className="font-semibold">Stays up for</span>
              <span className="font-semibold">
                {hours} {hours === 1 ? "hour" : "hours"}
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span className="font-semibold">Cost</span>
              {cost > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft py-0.5 pr-3 pl-1 text-[13px] font-bold text-[#8a5a00]">
                  <KeyCoin size={20} /> {cost} Keys
                </span>
              ) : (
                <span className="rounded-full bg-mint-soft px-3 py-1 text-[13px] font-bold text-mint">Free · your first one</span>
              )}
            </p>
            <p className="pt-1 text-[12px] leading-relaxed text-muted">People who meet you join free.</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Setting({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream text-ink-soft">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] text-muted">{label}</span>
        <span className="block truncate text-[14px] font-semibold">{value}</span>
      </span>
    </li>
  );
}
