"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearErrors } from "@/app/admin/(panel)/errors/actions";

export type ErrorRow = { id: number; message: string; stack: string | null; url: string | null; agent: string | null; created_at: string; name: string | null };

const when = (t: string) => new Date(t).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });

/** Admin: app errors, the same error grouped together, newest first */
export function ErrorsList({ rows }: { rows: ErrorRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const groups = new Map<string, ErrorRow[]>();
  for (const r of rows) groups.set(r.message, [...(groups.get(r.message) ?? []), r]);

  async function clear(message?: string) {
    if (!message && !confirm("Clear every error on this list?")) return;
    setBusy(message ?? "all");
    const r = await clearErrors(message);
    setBusy(null);
    if (r.error) setNote(r.error);
    start(() => router.refresh());
  }

  if (!rows.length) return <p className="rounded-3xl border border-line bg-surface p-5 text-[15px] text-muted shadow-card">No errors. All good.</p>;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {groups.size} {groups.size === 1 ? "problem" : "problems"} · {rows.length} {rows.length === 1 ? "report" : "reports"}
        </p>
        <button type="button" onClick={() => void clear()} disabled={!!busy} className="h-9 rounded-full border border-line px-3.5 text-[13px] font-semibold disabled:opacity-50">
          Clear all
        </button>
      </div>
      {note && <p className="mb-3 text-[13px] font-semibold text-chili">{note}</p>}
      <ul className="flex flex-col gap-2.5">
        {[...groups.entries()].map(([message, list]) => {
          const last = list[0];
          const people = new Set(list.map((r) => r.name).filter(Boolean));
          return (
            <li key={message} className="rounded-3xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-full bg-chili/10 px-2 text-[13px] font-extrabold text-chili">{list.length}×</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold break-words">{message}</p>
                  <p className="mt-1 text-[12.5px] text-muted">
                    Last {when(last.created_at)}
                    {people.size ? ` · ${[...people].slice(0, 3).join(", ")}${people.size > 3 ? ` +${people.size - 3}` : ""}` : ""}
                    {last.url ? ` · ${last.url}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {last.stack && (
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-[13px] font-semibold text-muted">Details</summary>
                    <pre className="mt-2 max-h-60 overflow-auto rounded-2xl bg-cream p-3 text-[11.5px] leading-snug whitespace-pre-wrap">{last.stack}</pre>
                    {last.agent && <p className="mt-1 text-[11.5px] break-words text-muted">{last.agent}</p>}
                  </details>
                )}
                <button
                  type="button"
                  onClick={() => void clear(message)}
                  disabled={!!busy}
                  className="ml-auto h-9 shrink-0 self-start rounded-full bg-mint-soft px-3.5 text-[13px] font-semibold text-mint disabled:opacity-50"
                >
                  {busy === message ? "Clearing…" : "Fixed · clear"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
