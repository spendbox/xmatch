export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { PromptAnswers } from "@/components/admin/PromptAnswers";
import { lagosToday, type AdminAnswer } from "../actions";

export default async function PromptAnswersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: prompt }, { data: answers }] = await Promise.all([
    db.from("prompts").select("id, body, day, chat_cost").eq("id", id).maybeSingle(),
    db.rpc("admin_prompt_answers", { p_prompt: id }),
  ]);
  if (!prompt) notFound();
  return (
    <PromptAnswers
      prompt={prompt as { id: string; body: string; day: string; chat_cost: number }}
      answers={(answers ?? []) as AdminAnswer[]}
      today={await lagosToday()}
    />
  );
}
