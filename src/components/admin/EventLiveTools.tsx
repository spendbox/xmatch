"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Mail, Megaphone, RefreshCw, Send, Sparkles } from "lucide-react";
import { emailAttendeesNow, postToRoom, roomMessages, type AdminRoomMessage } from "@/app/admin/(panel)/actions";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Textarea } from "@/components/ui/Field";
import { plural } from "@/lib/plural";

const MOMENTS = [
  "🔥 Shout-out to everyone on the dance floor!",
  "⏳ 10 minutes left",
  "💜 Say hi to someone new right now",
  "🎶 Next song is a big one — turn it up!",
  "📸 Haven't revealed anyone yet? Now's the time",
];

/** Live room controls: announcements, hype moments and the latest messages. */
export function LiveRoomCard({ eventId, initial }: { eventId: string; initial: AdminRoomMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [announce, setAnnounce] = useState("");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = () => start(async () => setMessages(await roomMessages(eventId)));

  function post(kind: "announce" | "moment", body: string, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await postToRoom(eventId, kind, body);
      if ("error" in res && res.error) return setError(res.error);
      after?.();
      setFlash(kind === "announce" ? "Announcement sent" : "Moment posted");
      setTimeout(() => setFlash(null), 2500);
      setMessages(await roomMessages(eventId));
    });
  }

  return (
    <div className="rounded-3xl border border-mint/40 bg-surface p-5 shadow-card lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
          </span>
          <h2 className="text-[17px] font-semibold">Live room</h2>
        </div>
        {flash && <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-mint"><Check size={15} /> {flash}</span>}
      </div>

      <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><Megaphone size={15} /> Announcement</label>
      <Textarea rows={2} maxLength={300} value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder="e.g. Welcome everyone! Reveal a photo and say hi 👋" />
      <div className="mt-2 flex justify-end">
        <Button onClick={() => post("announce", announce, () => setAnnounce(""))} disabled={pending || !announce.trim()}>
          <Send size={16} /> Send to the room
        </Button>
      </div>

      <p className="mt-5 mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><Sparkles size={15} /> Hype moments</p>
      <div className="flex flex-wrap gap-2">
        {MOMENTS.map((m) => (
          <button key={m} type="button" disabled={pending} onClick={() => post("moment", m)}
            className="rounded-full border border-line bg-cream/60 px-3.5 py-2 text-left text-[13px] font-semibold transition hover:border-brand hover:bg-brand-soft disabled:opacity-50">
            {m}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input className="h-11 text-[15px]" maxLength={300} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Your own moment…"
          onKeyDown={(e) => e.key === "Enter" && custom.trim() && post("moment", custom, () => setCustom(""))} />
        <Button variant="secondary" onClick={() => post("moment", custom, () => setCustom(""))} disabled={pending || !custom.trim()}>Post</Button>
      </div>
      <div className="mt-2"><FormError message={error} /></div>

      <div className="mt-5 mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-soft">Latest in the room</p>
        <button type="button" onClick={refresh} disabled={pending} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand disabled:opacity-50">
          <RefreshCw size={14} className={clsx(pending && "animate-spin")} /> Refresh
        </button>
      </div>
      <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-2xl bg-cream/60 p-3">
        {messages.length === 0 && <p className="py-6 text-center text-[13px] text-muted">Nothing yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={clsx("rounded-xl px-3 py-2 text-[14px]",
            m.kind === "announce" ? "bg-brand text-white" : m.kind === "moment" ? "bg-gold-soft" : "bg-surface")}>
            <span className={clsx("mr-1.5 font-semibold", m.kind === "announce" ? "text-white" : "text-ink")}>{m.name}</span>
            <span className={m.kind === "announce" ? "text-white/90" : "text-ink-soft"}>{m.body}</span>
            <span className={clsx("ml-1.5 text-[11px]", m.kind === "announce" ? "text-white/60" : "text-muted")}>
              {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Email everyone going, right now. */
export function EmailAttendeesCard({ eventId, going }: { eventId: string; going: number }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    if (!going) return;
    if (!confirm(`Email ${plural(going, "person", "people")} going to this event now?`)) return;
    setError(null);
    setResult(null);
    start(async () => {
      const res = await emailAttendeesNow(eventId, message);
      if (res.error) return setError(res.error);
      setResult(`Sent to ${plural(res.sent ?? 0, "person", "people")}${res.failed ? ` · ${res.failed} couldn't be sent` : ""}.`);
    });
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-card lg:p-6">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><Mail size={17} /></span>
        <h2 className="text-[17px] font-semibold">Notify attendees now</h2>
      </div>
      <p className="mb-3 text-[13px] text-muted">Sends an email and a phone notification (to those who turned them on) to everyone going ({going}). Leave it empty to send &ldquo;We&apos;re live — come in!&rdquo;</p>
      <Textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="We're live — come in!" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={send} loading={pending} loadingText="Sending…" disabled={!going}>
          <Send size={16} /> Send
        </Button>
        {result && <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-mint"><Check size={15} /> {result}</span>}
        {!going && <span className="text-[13px] text-muted">Nobody is going yet.</span>}
      </div>
      <div className="mt-3"><FormError message={error} /></div>
    </div>
  );
}
