import Link from "next/link";
import type { Pact, PactQuestion, PactView } from "@/lib/pacts";
import { PactFlow } from "./PactFlow";

const STAGES = [
  { id: "open", label: "Taking answers" },
  { id: "matching", label: "Matching" },
  { id: "teaser", label: "Reveal teaser" },
  { id: "revealed", label: "Match revealed" },
] as const;

/** What people will see, at each stage, with a bar to switch between them */
export function AdminPreview({ pact, questions, count, as }: { pact: Pact; questions: PactQuestion[]; count: number; as?: string }) {
  const stage = STAGES.find((s) => s.id === as)?.id ?? "open";
  const hour = 3600_000;
  const now = Date.now();
  const shown: Pact =
    stage === "open"
      ? { ...pact, status: "live", closes_at: new Date(Math.max(new Date(pact.closes_at).getTime(), now + 2 * 86400_000)).toISOString(), reveal_at: new Date(Math.max(new Date(pact.reveal_at).getTime(), now + 3 * 86400_000)).toISOString() }
      : stage === "matching"
        ? { ...pact, status: "live", closes_at: new Date(now - hour).toISOString(), reveal_at: new Date(now + 9 * hour).toISOString() }
        : { ...pact, status: "revealed", closes_at: new Date(now - 12 * hour).toISOString(), reveal_at: new Date(now - hour).toISOString() };
  // A made-up match from the pact's own questions
  const intent = pact.intents[0] ?? "friendship";
  const shared = questions.filter((q) => q.kind !== "scale").slice(0, 4).map((q) => ({ q: q.title, a: q.options[0]?.label ?? "" }));
  const view: PactView | null =
    stage === "teaser"
      ? { kind: "teaser", score: 87, intent, inCommon: shared.length, rematch: false }
      : stage === "revealed"
        ? { kind: "match", match: { alias: "Golden Panther", score: 87, intent, age: 27, area: pact.areas[0] ?? null, work: intent === "business" ? "Tech" : null, shared, differ: null, sessionId: null, theyHaveAccount: false } }
        : null;
  return (
    <>
      <div className="sticky top-0 z-50 bg-[#0d0820]/95 px-3 py-2 text-white backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center gap-2">
          <span className="rounded-full bg-[#f2c45a] px-2 py-0.5 text-[11px] font-extrabold text-[#1c1310] uppercase">{pact.status === "draft" ? "Draft preview" : "Preview"}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-white/70">Only admins see this. Nothing is saved.</span>
          <Link href={`/admin/link-ups/${pact.id}`} className="shrink-0 text-[12.5px] font-bold text-[#f2c45a]">Editor</Link>
        </div>
        <div className="no-scrollbar mx-auto mt-2 flex max-w-[480px] gap-1.5 overflow-x-auto">
          {STAGES.map((s) => (
            <Link key={s.id} href={`/link/${pact.slug}?preview=1&as=${s.id}`} className={"shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-bold " + (s.id === stage ? "bg-white text-[#1c1310]" : "bg-white/10 text-white/80")}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>
      <PactFlow key={stage} pact={shown} questions={questions} count={count} signedIn={stage === "revealed"} mine={null} result={view} preview />
    </>
  );
}
