import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { MoveError, type MoveResult, type Side } from "@/lib/boardgames/types";
import * as checkers from "@/lib/boardgames/checkers";
import * as chess from "@/lib/boardgames/chess";
import * as ayo from "@/lib/boardgames/ayo";
import * as whot from "@/lib/boardgames/whot";
import * as bomb from "@/lib/boardgames/bomb";
import * as gems from "@/lib/boardgames/gems";
import * as ludo from "@/lib/boardgames/ludo";
import * as snakes from "@/lib/boardgames/snakes";
import { randomInt } from "node:crypto";
import { pushToUsers } from "@/lib/push";

/**
 * A move in Whot, Checkers, Chess, Ayo, Bombshell, Gem Clash, Ludo or Snakes & Ladders.
 * Dice are rolled here, never on the phone. The rules are checked here (the same
 * rules the phone uses to show legal moves), then saved with the service key.
 * Every save bumps `seq`, so a move made on an old view of the game is refused.
 */
const IDLE_MS = 5 * 60_000;
const KINDS = ["whot", "checkers", "chess", "ayo", "bomb", "gems", "ludo", "snakes"];
const dice = () => randomInt(1, 7);

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
    else if (g.kind === "gems") result = gems.applyMove(g.state, side, body.move as gems.GemsMove);
    else if (g.kind === "ludo") result = ludo.applyMove(g.state, side, body.move as ludo.LudoMove, dice);
    else if (g.kind === "snakes") result = snakes.applyMove(g.state, side, body.move as snakes.SnakesMove, dice);
    else if (g.kind === "bomb") {
      const { data: secrets } = await db.from("game_secrets").select("user_id, data").eq("game_id", g.id);
      const bombsOf = (id: string) => ((secrets ?? []).find((s) => s.user_id === id)?.data?.bombs ?? []) as number[];
      result = bomb.applyMove(g.state, side, body.move as bomb.BombMove, { a: bombsOf(g.player_a), b: bombsOf(g.player_b) });
    } else {
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

  const saveSecrets = () =>
    result.secrets
      ? Promise.all(
          (["a", "b"] as Side[]).map((s) =>
            result.secrets?.[s] !== undefined
              ? db.from("game_secrets").update({ data: result.secrets[s] }).eq("game_id", g.id).eq("user_id", s === "a" ? g.player_a : g.player_b)
              : null,
          ),
        )
      : null;
  // Bombshell: hidden bombs are saved first, so they're there the moment the round starts
  if (g.kind === "bomb") await saveSecrets();

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

  if (g.kind !== "bomb") await saveSecrets();
  if (result.priv !== undefined) await db.from("game_private").upsert({ game_id: g.id, data: result.priv });

  // Play games aren't in a chat: if it's now their turn and they've left the app, tell them
  const nextTurn = (result.state as { turn?: Side } | null)?.turn;
  if (g.play && !result.over && nextTurn && nextTurn !== side) {
    const them = nextTurn === "a" ? g.player_a : g.player_b;
    const { data: me } = await db.from("profiles").select("display_name, photos").eq("id", user.id).single();
    const title = ({ whot: "Whot", ayo: "Ayo", ludo: "Ludo", snakes: "Snakes & Ladders" } as Record<string, string>)[g.kind as string] ?? "your game";
    await pushToUsers(
      [them],
      { title: `Your turn in ${title} 🎲`, body: `${((me?.display_name as string) ?? "They").split(" ")[0]} made their move.`, url: `/home?game=${g.id}`, tag: `turn-${g.id}`, icon: (me?.photos as string[] | null)?.[0] ?? null },
      { skipIfActive: true },
    ).catch(() => {});
  }

  if (result.over) {
    const winner = result.over.winner ? (result.over.winner === "a" ? g.player_a : g.player_b) : null;
    await db.from("games").update({ winner }).eq("id", g.id);
    await db.rpc("game_finish", { p_game: g.id, p_reason: null, p_by: null });
  }
  return NextResponse.json({ ok: true });
}
