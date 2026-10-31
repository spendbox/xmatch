"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import type { Intent } from "@/lib/types";

const MAX = 60;
const EMOJI = ["😂", "🔥", "😴", "⚽", "🎶", "🍛", "💃", "🙏", "👀", "❤️"];
/** A few lines to start from (tap, then change it however you like) */
const STARTERS: Record<Intent, string[]> = {
  friends: ["Bored, entertain me 😅", "Who's watching the match? ⚽", "Need a gym buddy 💪", "Weekend plans?"],
  dating: ["Looking for a good conversation ☕", "Who wants to argue about jollof? 🍛", "Coffee this weekend?", "Tell me your favourite song 🎶"],
  spicy: ["Up late, entertain me 👀", "Bored and in the mood to flirt 😏", "Truth or dare? 😈", "Who's still awake?"],
};

function hoursLeft(at: string | null | undefined) {
  if (!at) return null;
  const h = Math.ceil((new Date(at).getTime() + 24 * 3_600_000 - Date.now()) / 3_600_000);
  return h > 0 ? h : null;
}

/**
 * Your note: one short line everyone sees on your card and in their Recent chats for 24 hours,
 * like Instagram Notes. Easy to write: a starter line for your mood, emoji to tap, 60 characters.
 */
export function NoteSheet({
  open,
  onClose,
  note,
  noteAt,
  intent,
  onSaved,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  note: string | null;
  noteAt: string | null;
  intent: Intent;
  onSaved: (note: string | null, at: string | null) => void;
  demo?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const left = hoursLeft(noteAt);

  useEffect(() => {
    if (!open) return;
    setText(note ?? "");
    setError(null);
  }, [open, note]);

  async function save(value: string | null) {
    tapFeedback();
    setBusy(value ? "save" : "clear");
    setError(null);
    if (demo) {
      setBusy(null);
      onSaved(value, value ? new Date().toISOString() : null);
      return onClose();
    }
    const { data, error: err } = await supabase.rpc("set_note", { p_text: value ?? "" });
    setBusy(null);
    if (err) return setError(err.message.replace(/^.*?: /, "") || "Couldn't save. Try again.");
    const r = data as { note: string | null; note_at: string | null };
    onSaved(r.note, r.note_at);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your note"
      subtitle="One short line on your card and in Recent chats. Gone after 24 hours."
      footer={
        <div className="space-y-2">
          {error && <p className="text-center text-[13px] font-medium text-chili">{error}</p>}
          <Button size="lg" onClick={() => save(text.trim())} disabled={!text.trim() || text.trim() === (note ?? "")} loading={busy === "save"} loadingText="Sharing…">
            Share note
          </Button>
          {note && (
            <button
              type="button"
              onClick={() => save(null)}
              disabled={!!busy}
              className="mx-auto flex h-10 items-center gap-1.5 text-[14px] font-semibold text-chili disabled:opacity-50"
            >
              <Trash2 size={16} /> Remove note{left ? ` · ${left}h left` : ""}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* The bubble as people will see it */}
        <div className="relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            maxLength={MAX}
            autoFocus
            placeholder="What's on your mind?"
            aria-label="Your note"
            className="h-14 w-full rounded-[20px] border-2 border-brand/30 bg-surface pr-14 pl-4 text-[17px] font-medium outline-none focus:border-brand"
          />
          <span className={clsx("absolute top-1/2 right-4 -translate-y-1/2 text-[12px] font-semibold tabular-nums", text.length >= MAX - 5 ? "text-chili" : "text-muted")}>
            {MAX - text.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setText((t) => (t + (t && !t.endsWith(" ") ? " " : "") + e).slice(0, MAX))}
              className="grid h-10 w-10 place-items-center rounded-full bg-cream text-[20px] active:scale-90"
              aria-label={`Add ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-muted">Start from one</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS[intent].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className={clsx("rounded-full border px-3 py-1.5 text-[13px] transition", text === s ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-soft")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-muted">No links or phone numbers. You stay masked: people see your note, not who you are.</p>
      </div>
    </Sheet>
  );
}
