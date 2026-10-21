"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { giftById } from "@/lib/keys";
import { sexLabel } from "@/lib/eventSpace";
import { ago, feedError, type FeedGift } from "@/lib/feed";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar } from "@/components/ui/Avatar";
import { GiftArt } from "@/components/keys/GiftArt";
import { refreshMenuBadges } from "@/components/app/useMenuBadges";

/** Gifts people sent for your answers. You see who sent each one and can chat back for free. */
export function GiftsSheet({ open, onClose, demo }: { open: boolean; onClose: () => void; demo?: FeedGift[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [gifts, setGifts] = useState<FeedGift[] | null>(demo ?? null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || demo) return;
    let live = true;
    supabase.rpc("my_feed_gifts").then(({ data }) => {
      if (live && Array.isArray(data)) setGifts(data as FeedGift[]);
      supabase.rpc("mark_feed_gifts_seen").then(() => refreshMenuBadges());
    });
    return () => {
      live = false;
    };
  }, [open, demo, supabase]);

  async function chatBack(g: FeedGift) {
    setBusy(g.id);
    setError(null);
    const { data, error: err } = await supabase.rpc("chat_back_gift", { p_gift: g.id });
    if (err || !data) {
      setBusy(null);
      return setError(feedError(err?.message));
    }
    router.push(`/feed/chat/${data}`);
  }

  const now = Date.now();
  return (
    <Sheet open={open} onClose={onClose} title="Gifts for you" subtitle="People who loved your answers. They chose to show who they are.">
      {error && <p className="mb-3 rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
      {!gifts ? (
        <p className="py-6 text-center text-[14px] text-muted">Loading…</p>
      ) : gifts.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-muted">No gifts yet. Answer today&apos;s prompt and see who notices.</p>
      ) : (
        <ul className="space-y-2.5">
          {gifts.map((g) => {
            const gift = giftById(g.gift_id);
            return (
              <li key={g.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <Avatar src={g.from_photo} name={g.from_name ?? "?"} size={46} />
                    <span className="absolute -right-1.5 -bottom-1.5 grid h-7 w-7 place-items-center rounded-full bg-white shadow-card">
                      <GiftArt id={g.gift_id} size={20} />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">
                      {g.from_name ?? "Someone"}
                      <span className="font-normal text-muted">
                        {g.from_age ? `, ${g.from_age}` : ""}
                        {sexLabel(g.from_gender) ? ` · ${sexLabel(g.from_gender)}` : ""}
                      </span>
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      Sent you {gift ? `a ${gift.name.toLowerCase()}` : "a gift"} · {ago(g.created_at, now)}
                    </p>
                  </div>
                  {!g.seen_at && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-chili" aria-label="New" />}
                </div>
                {g.answer_body && <p className="mt-2 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-[13px] text-ink-soft">For: &ldquo;{g.answer_body}&rdquo;</p>}
                <div className="mt-2.5 flex justify-end">
                  {g.match_id ? (
                    <Link href={`/matches/${g.match_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-mint-soft px-3.5 text-[13px] font-semibold text-mint">
                      <MessageCircle size={15} /> In your Chats
                    </Link>
                  ) : g.chat_id ? (
                    <Link href={`/feed/chat/${g.chat_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white">
                      <MessageCircle size={15} /> Open chat
                    </Link>
                  ) : g.can_chat ? (
                    <button
                      onClick={() => chatBack(g)}
                      disabled={busy !== null}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-white disabled:opacity-60"
                    >
                      <MessageCircle size={15} /> {busy === g.id ? "Opening…" : "Chat back · free"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
