"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Bug, CheckCircle2, HelpCircle, Lightbulb, LifeBuoy, MessageSquareHeart } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { sendFeedback, type FeedbackKind } from "@/app/(app)/feedback/actions";

const KINDS: { id: FeedbackKind; label: string; icon: typeof Bug; hint: string }[] = [
  { id: "feedback", label: "Feedback", icon: MessageSquareHeart, hint: "What do you like? What would make Dashpad better?" },
  { id: "bug", label: "A problem", icon: Bug, hint: "What happened, and what were you trying to do?" },
  { id: "help", label: "I need help", icon: HelpCircle, hint: "Tell us what you need help with." },
  { id: "idea", label: "Idea", icon: Lightbulb, hint: "What should we build next?" },
];

/** The support button: opens a pop-up to send feedback, report a problem or ask for help */
export function FeedbackButton({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("feedback");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function show() {
    tapFeedback();
    setSent(false);
    setError(null);
    setOpen(true);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await sendFeedback({ kind, message, page: path, device: navigator.userAgent });
    setBusy(false);
    if (r.error) return setError(r.error);
    setSent(true);
    setMessage("");
  }

  const current = KINDS.find((k) => k.id === kind)!;
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={show}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition active:scale-95"
          aria-label="Help and feedback"
          title="Help and feedback"
        >
          <LifeBuoy size={20} strokeWidth={2} />
        </button>
      ) : (
        <button type="button" onClick={show} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-[14px] font-semibold text-ink-soft transition hover:bg-ink/5 active:scale-[0.98] collapsed:justify-center collapsed:px-0" title="Help and feedback">
          <LifeBuoy size={19} /> <span className="collapsed:hidden">Help and feedback</span>
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={sent ? "Thanks, we got it" : "Help and feedback"}
        subtitle={sent ? "The Dashpad team reads every message." : "Tell us anything. The Dashpad team reads every message."}
        icon={sent ? <CheckCircle2 size={22} /> : <LifeBuoy size={22} />}
      >
        {sent ? (
          <div className="grid gap-2 pb-2">
            <Button size="lg" onClick={() => setOpen(false)}>Done</Button>
            <Button size="lg" variant="ghost" onClick={() => setSent(false)}>Send another</Button>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={clsx(
                    "flex h-12 items-center gap-2 rounded-2xl border px-3 text-left text-[14px] font-semibold transition active:scale-[0.97]",
                    kind === k.id ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-ink-soft",
                  )}
                >
                  <k.icon size={17} className="shrink-0" /> <span className="truncate">{k.label}</span>
                </button>
              ))}
            </div>
            <Textarea rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={current.hint} aria-label="Your message" />
            {error && <p role="alert" className="rounded-xl bg-chili-soft px-4 py-3 text-sm font-medium text-chili">{error}</p>}
            <Button type="submit" size="lg" loading={busy} loadingText="Sending…" disabled={message.trim().length < 2}>Send</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
