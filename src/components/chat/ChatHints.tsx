"use client";

import { useEffect, useMemo, useState } from "react";
import { Lightbulb, RefreshCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildHints, hintPage, type HintData } from "@/lib/chatHints";

/**
 * "Ask them about…" above the message box: three openers made for this pair. Tapping one
 * puts it in the message box to edit or send. Shows at the start of a chat and when it goes quiet.
 */
export function ChatHints({
  other,
  session,
  theirInterests,
  show,
  onPick,
  onVisible,
}: {
  other?: string;
  session?: string;
  theirInterests: string[];
  /** The chat is new or has gone quiet */
  show: boolean;
  onPick: (text: string) => void;
  /** Whether the ideas are on screen (so other things above the box can wait) */
  onVisible?: (visible: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<HintData | null>(null);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  useEffect(() => {
    if (!other && !session) return;
    supabase.rpc("in_common", { p_other: other ?? null, p_session: session ?? null }).then(({ data: d, error }) => {
      if (!error && d) setData(d as HintData);
    });
  }, [supabase, other, session]);
  // Back after a quiet spell: show again
  useEffect(() => {
    if (show) setHidden(false);
  }, [show]);

  const all = useMemo(() => buildHints(data, theirInterests, new Date(), seed), [data, theirInterests, seed]);
  const visible = show && !hidden && all.length > 0;
  useEffect(() => {
    onVisible?.(visible);
  }, [visible, onVisible]);
  if (!visible) return null;
  const hints = hintPage(all, page);

  return (
    <div className="px-3 pb-2" aria-label="Ideas to say">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-muted">
        <Lightbulb size={13} className="text-gold" /> Ask them about…
        <span className="flex-1" />
        {all.length > 3 && (
          <button type="button" onClick={() => setPage((p) => p + 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5" aria-label="More ideas">
            <RefreshCw size={14} />
          </button>
        )}
        <button type="button" onClick={() => setHidden(true)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5" aria-label="Hide ideas">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {hints.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => {
              onPick(h.text);
              setHidden(true);
            }}
            className="w-[220px] shrink-0 rounded-2xl border border-line bg-surface px-3 py-2 text-left shadow-card transition active:scale-[0.98]"
          >
            <span className="block truncate text-[11.5px] font-semibold text-brand">{h.label}</span>
            <span className="mt-0.5 line-clamp-2 block text-[13.5px] leading-snug text-ink">{h.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
