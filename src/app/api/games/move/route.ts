import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { MoveError, type MoveResult, type Side } from "@/lib/boardgames/types";
import * as checkers from "@/lib/boardgames/checkers";
import * as chess from "@/lib/boardgames/chess";
import * as ayo from "@/lib/boardgames/ayo";
import * as whot from "@/lib/boardgames/whot";

/**
 * A move in Whot, Checkers, Chess or Ayo. The rules are checked here (the same
 * rules the phone uses to show legal moves), then saved with the service key.
 * Every save bumps `seq`, so a move made on an old view of the game is refused.
 */
const IDLE_MS = 5 * 60_000;
const KINDS = ["whot", "checkers", "chess", "ayo"];

export async function POST(req: Request) {
  const { user } = await getAuth();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { game?: string; move?: unknown } | null;
  if (!body?.game || body.move === undefined) return NextResponse.json({ error: "Missing move" }, { status: 400 });

  const db = createAdminClient();
  const { data: g } = await db.from("games").select("*").eq("id", body.game).maybeSingle();
  if (!g || (g.player_a !== user.id && g.player_b !== user.id)) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (!KINDS.includes(g.kind)) return NextResponse.json({ error: "Not this kind of game" }, { status: 400 });
  if (g.status !== "active") return NextResponse.json({ error: "This game is over" }, { status: 409 });
  if (g.started_at && new Date(g.started_at).getTime() > Date.now()) return NextResponse.json({ error: "Get ready…" }, { status: 409 });
  const side: Side = g.player_a === user.id ? "a" : "b";

  let result: MoveResult<unknown, unknown, unknown>;
  try {
    if (g.kind === "checkers") result = checkers.applyMove(g.state, side, body.move as checkers.CheckersMove);
    else if (g.kind === "chess") result = chess.applyMove(g.state, side, body.move as chess.ChessMove);
    else if (g.kind === "ayo") result = ayo.applyMove(g.state, side, Number(body.move));
    else {
      const [{ data: secrets }, { data: priv }] = await Promise.all([
        db.from("game_secrets").select("user_id, data").eq("game_id", g.id),
        db.from("game_private").select("data").eq("game_id", g.id).maybeSingle(),
      ]);
      const handOf = (id: string) => ((secrets ?? []).find((s) => s.user_id === id)?.data?.hand ?? []) as string[];
      result = whot.applyMove(g.state, side, body.move as whot.WhotMove, { a: handOf(g.player_a), b: handOf(g.player_b) }, (priv?.data?.deck ?? []) as string[]);
    }
  } catch (e) {
    if (e instanceof MoveError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }

  // Save, but only if nobody else moved first
  const { data: saved } = await db
    .from("games")
    .update({
      state: result.state,
      seq: g.seq + 1,
      deadline_at: new Date(Date.now() + IDLE_MS).toISOString(),
      ...(result.over ? { score_a: result.over.score_a, score_b: result.over.score_b } : {}),
    })
    .eq("id", g.id)
    .eq("seq", g.seq)
    .eq("status", "active")
    .select("id");
  if (!saved?.length) return NextResponse.json({ error: "The game moved on. Try again." }, { status: 409 });

  if (result.secrets) {
    await Promise.all(
      (["a", "b"] as Side[]).map((s) =>
        result.secrets?.[s] !== undefined
          ? db.from("game_secrets").update({ data: result.secrets[s] }).eq("game_id", g.id).eq("user_id", s === "a" ? g.player_a : g.player_b)
          : null,
      ),
    );
  }
  if (result.priv !== undefined) await db.from("game_private").upsert({ game_id: g.id, data: result.priv });

  if (result.over) {
    const winner = result.over.winner ? (result.over.winner === "a" ? g.player_a : g.player_b) : null;
    await db.from("games").update({ winner }).eq("id", g.id);
    await db.rpc("game_finish", { p_game: g.id, p_reason: null, p_by: null });
  }
  return NextResponse.json({ ok: true });
}
