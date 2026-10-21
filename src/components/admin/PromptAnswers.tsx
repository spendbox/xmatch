"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Eye, EyeOff, Flag, Gift, Search } from "lucide-react";
import { plural } from "@/lib/plural";
import { Avatar } from "@/components/ui/Avatar";
import { setAnswerHidden, type AdminAnswer } from "@/app/admin/(panel)/prompts/actions";
import { AdminTitle } from "./AdminShell";
import { dayLabel } from "./PromptManager";

/** Every answer to one prompt, with who really wrote it. Reported ones first. */
export function PromptAnswers({ prompt, answers, today }: { prompt: { id: string; body: string; day: string }; answers: AdminAnswer[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "reported" | "hidden">("all");
  const list = answers.filter(
    (a) =>
      (only === "all" || (only === "reported" ? a.reports > 0 : !!a.hidden_at)) &&
      (!q || (a.body + " " + (a.display_name ?? "") + " " + a.alias).toLowerCase().includes(q.toLowerCase())),
  );
  const reported = answers.filter((a) => a.reports > 0).length;
  const hidden = answers.filter((a) => a.hidden_at).length;

  async function toggle(a: AdminAnswer) {
    await setAnswerHidden(a.id, !a.hidden_at, prompt.id);
    start(() => router.refresh());
  }

  return (
    <>
      <Link href="/admin/prompts" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> All prompts
      </Link>
      <AdminTitle title={prompt.body} subtitle={`${dayLabel(prompt.day, today)} · ${plural(answers.length, "answer")}`} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-brand">
          <Search size={17} className="shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers or names" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        </label>
        {(
          [
            ["all", `All ${answers.length}`],
            ["reported", `Reported ${reported}`],
            ["hidden", `Hidden ${hidden}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setOnly(k)}
            className={clsx("h-9 rounded-full px-3.5 text-[13px] font-semibold", only === k ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft")}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className={clsx("mt-4 space-y-2.5 transition", pending && "opacity-60")}>
        {list.length === 0 && <li className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-[14px] text-muted">Nothing here.</li>}
        {list.map((a) => (
          <li key={a.id} className={clsx("rounded-3xl border bg-surface p-4 shadow-card", a.reports > 0 ? "border-chili/40" : "border-line", a.hidden_at && "opacity-60")}>
            <div className="flex items-center gap-3">
              <Link href={`/admin/members/${a.user_id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={a.photo} name={a.display_name ?? "?"} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{a.display_name ?? "No name"}</span>
                  <span className="block truncate text-[12px] text-muted">Posted as {a.alias}</span>
                </span>
              </Link>
              <button
                onClick={() => toggle(a)}
                className={clsx(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                  a.hidden_at ? "bg-mint-soft text-mint" : "bg-chili-soft text-chili",
                )}
              >
                {a.hidden_at ? <Eye size={15} /> : <EyeOff size={15} />} {a.hidden_at ? "Show" : "Hide"}
              </button>
            </div>
            <p className="mt-3 text-[15px] leading-snug whitespace-pre-wrap">{a.body}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 text-[12px] text-muted">
              <span>{plural(a.reactions, "reaction")}</span>
              <span className="inline-flex items-center gap-1">
                <Gift size={12} /> {a.gifts}
              </span>
              {a.reports > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-chili">
                  <Flag size={12} /> {plural(a.reports, "report")}
                </span>
              )}
              {a.hidden_at && <span className="font-semibold">Hidden</span>}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
