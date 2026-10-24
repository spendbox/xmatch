"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bug, Check, ChevronLeft, ChevronRight, HelpCircle, Lightbulb, MessageSquareHeart, RotateCcw, Trash2 } from "lucide-react";
import { deleteFeedback, setFeedbackStatus } from "@/app/admin/(panel)/feedback/actions";
import { Avatar } from "@/components/ui/Avatar";
import { AdminTitle } from "./AdminShell";

export type FeedbackRow = {
  id: number;
  kind: "feedback" | "bug" | "help" | "idea";
  message: string;
  page: string | null;
  device: string | null;
  status: "new" | "done";
  created_at: string;
  user_id: string | null;
  profiles: { display_name: string | null; photos: string[] | null } | null;
};

const KIND = {
  feedback: { label: "Feedback", icon: MessageSquareHeart, cls: "bg-brand-soft text-brand" },
  bug: { label: "Something's broken", icon: Bug, cls: "bg-chili-soft text-chili" },
  help: { label: "Needs help", icon: HelpCircle, cls: "bg-gold-soft text-[#9a6a0c]" },
  idea: { label: "Idea", icon: Lightbulb, cls: "bg-mint/15 text-[#16865a]" },
} as const;

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Shortens a browser description to something readable, e.g. "iPhone · Safari" */
function deviceName(ua: string | null) {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : null;
  const browser = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? "Chrome" : /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  return [os, browser].filter(Boolean).join(" · ") || null;
}

export function FeedbackInbox({ rows, total, fresh, filter, page, pageSize, missing }: { rows: FeedbackRow[]; total: number; fresh: number; filter: "new" | "done" | "all"; page: number; pageSize: number; missing: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [gone, setGone] = useState<Set<number>>(new Set());
  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function act(id: number, fn: () => Promise<{ error?: string }>) {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (r.error) return alert(r.error);
    setGone((s) => new Set(s).add(id));
    router.refresh();
  }

  const tabs: { id: typeof filter; label: string }[] = [
    { id: "new", label: fresh ? `New (${fresh.toLocaleString()})` : "New" },
    { id: "done", label: "Handled" },
    { id: "all", label: "All" },
  ];
  return (
    <div className="pb-16">
      <AdminTitle title="Feedback" subtitle="Messages people send from the help and feedback button in the app." />
      {missing && <p className="mb-4 rounded-2xl bg-gold-soft px-4 py-3 text-[14px] text-[#7a5208]">Run update 45 (supabase/updates/45_feedback.sql) in Supabase to start collecting feedback.</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.id} href={`/admin/feedback?f=${t.id}`} className={clsx("inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold", filter === t.id ? "bg-ink text-white" : "border border-line-strong bg-white text-ink-soft")}>
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-[15px] text-muted">{filter === "new" ? "No new messages. You're all caught up." : "Nothing here yet."}</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const k = KIND[r.kind] ?? KIND.feedback;
            const name = r.profiles?.display_name ?? (r.user_id ? "Member" : "Deleted account");
            const device = deviceName(r.device);
            return (
              <li key={r.id} className={clsx("rounded-3xl border border-line bg-surface p-4 shadow-card transition", gone.has(r.id) && filter !== "all" && "opacity-40")}>
                <div className="flex items-start gap-3">
                  {r.user_id ? (
                    <Link href={`/admin/members/${r.user_id}`} className="shrink-0"><Avatar src={r.profiles?.photos?.[0]} name={name} size={40} /></Link>
                  ) : (
                    <Avatar name={name} size={40} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {r.user_id ? <Link href={`/admin/members/${r.user_id}`} className="truncate text-[15px] font-semibold hover:text-brand">{name}</Link> : <span className="text-[15px] font-semibold text-muted">{name}</span>}
                      <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold", k.cls)}><k.icon size={12} /> {k.label}</span>
                      {r.status === "done" && <span className="rounded-full bg-line px-2 py-0.5 text-[11.5px] font-bold text-muted">Handled</span>}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted">{[when(r.created_at), r.page, device].filter(Boolean).join(" · ")}</p>
                    <p className="mt-2 text-[14.5px] leading-relaxed break-words whitespace-pre-wrap">{r.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status === "new" ? (
                        <button disabled={busy === r.id} onClick={() => act(r.id, () => setFeedbackStatus(r.id, "done"))} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-60"><Check size={15} /> Mark handled</button>
                      ) : (
                        <button disabled={busy === r.id} onClick={() => act(r.id, () => setFeedbackStatus(r.id, "new"))} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-[13px] font-semibold disabled:opacity-60"><RotateCcw size={14} /> Move to new</button>
                      )}
                      <button disabled={busy === r.id} onClick={() => confirm("Delete this message?") && act(r.id, () => deleteFeedback(r.id))} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 text-[13px] font-semibold text-chili disabled:opacity-60" aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <PageLink href={`/admin/feedback?f=${filter}&p=${page - 1}`} off={page <= 1}><ChevronLeft size={16} /> Newer</PageLink>
          <span className="text-[13px] text-muted">Page {page} of {pages}</span>
          <PageLink href={`/admin/feedback?f=${filter}&p=${page + 1}`} off={page >= pages}>Older <ChevronRight size={16} /></PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({ href, off, children }: { href: string; off: boolean; children: React.ReactNode }) {
  if (off) return <span className="inline-flex h-10 items-center gap-1 px-3 text-[13.5px] font-semibold text-muted/50">{children}</span>;
  return <Link href={href} className="inline-flex h-10 items-center gap-1 rounded-full border border-line-strong bg-white px-4 text-[13.5px] font-semibold">{children}</Link>;
}
