"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Ban, ChevronLeft, ChevronRight, Flag, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { AdminTitle } from "./AdminShell";

export type MemberRow = {
  id: string;
  display_name: string | null;
  photo: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
  last_seen_at: string;
  email: string | null;
  banned_at: string | null;
  balance: number;
  reports: number;
  matches: number;
  onboarded: boolean;
};

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "online", label: "Online now" },
  { key: "new", label: "New this week" },
  { key: "reported", label: "Reported" },
  { key: "banned", label: "Banned" },
  { key: "incomplete", label: "Didn't finish sign-up" },
];

export const sexOf = (g: string | null) => (g === "woman" ? "Female" : g === "man" ? "Male" : g === "other" ? "Other" : "");

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 150) return "online";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function MembersList({
  rows, total, q, filter, page, pageSize,
}: { rows: MemberRow[]; total: number; q: string; filter: string; page: number; pageSize: number }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [pending, start] = useTransition();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const go = (next: { q?: string; f?: string; p?: number }) => {
    const sp = new URLSearchParams();
    const nq = next.q ?? q;
    const nf = next.f ?? filter;
    const np = next.p ?? 1;
    if (nq) sp.set("q", nq);
    if (nf !== "all") sp.set("f", nf);
    if (np > 1) sp.set("p", String(np));
    start(() => router.push(`/admin/members${sp.size ? `?${sp}` : ""}`));
  };

  return (
    <>
      <AdminTitle title="Members" subtitle={`${total.toLocaleString()} ${total === 1 ? "member" : "members"}${filter !== "all" ? ` · ${FILTERS.find((f) => f.key === filter)?.label}` : ""}`} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
        className="flex gap-2"
      >
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-brand">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search by name or email"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            enterKeyHint="search"
          />
        </label>
        <button className="h-12 shrink-0 rounded-2xl bg-ink px-5 text-[14px] font-semibold text-white">Search</button>
      </form>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => go({ f: f.key })}
            className={clsx(
              "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition",
              filter === f.key ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft hover:border-line-strong",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={clsx("mt-4 overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <p className="p-10 text-center text-[15px] text-muted">No members match.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-cream">
                  <span className="relative shrink-0">
                    <Avatar src={m.photo} name={m.display_name ?? m.email ?? "?"} size={44} />
                    {Date.now() - new Date(m.last_seen_at).getTime() < 300_000 && (
                      <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-mint ring-2 ring-surface" title="Online" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                      <span className="truncate">
                        {m.display_name ?? <span className="text-muted italic">No name yet</span>}
                        {m.age ? <span className="font-normal text-muted">, {m.age}</span> : null}
                      </span>
                      {sexOf(m.gender) && <span className="text-[12px] font-medium text-muted">· {sexOf(m.gender)}</span>}
                    </p>
                    <p className="truncate text-[13px] text-muted">{m.email}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    {m.banned_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-chili-soft px-2 py-0.5 text-[11px] font-bold text-chili">
                        <Ban size={11} /> Banned
                      </span>
                    )}
                    {m.reports > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-[#8a5a00]">
                        <Flag size={11} /> {m.reports}
                      </span>
                    )}
                    {!m.onboarded && <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-muted">Not finished</span>}
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums">
                      <KeyCoin size={14} /> {m.balance}
                    </span>
                  </div>
                  <div className="w-20 shrink-0 text-right text-[12px] text-muted">
                    <span className={clsx(ago(m.last_seen_at) === "online" && "font-semibold text-mint")}>{ago(m.last_seen_at)}</span>
                    <span className="block sm:hidden">
                      {m.banned_at ? <span className="font-semibold text-chili">Banned</span> : m.reports > 0 ? <span className="font-semibold text-[#8a5a00]">{m.reports} reports</span> : null}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => go({ p: page - 1 })}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-[13px] text-muted">
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => go({ p: page + 1 })}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold disabled:opacity-40"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
