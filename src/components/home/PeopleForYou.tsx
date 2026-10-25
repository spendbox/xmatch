"use client";

import { useState } from "react";
import { thumbFallback, thumbUrl } from "@/lib/photos";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { ExploreList } from "@/lib/explore";
import { tapFeedback } from "@/components/ui/Button";
import { useMeetList } from "@/components/explore/useMeetList";
import { ExploreProfileSheet } from "@/components/explore/ExploreProfileSheet";

const SHOWN = 20;

/** Home: your 20 closest matches from Meet, in one long sideways strip, and a way to the rest */
export function PeopleForYou({ userId, demo }: { userId: string; demo?: ExploreList }) {
  const { list, reload } = useMeetList(userId, demo ?? null);
  const [open, setOpen] = useState<string | null>(null);
  // Online now first, then everyone else in the order Dashpad suggests (most likely to click and reply)
  const people = [...(list?.people ?? [])].sort((a, b) => Number(b.online) - Number(a.online)).slice(0, SHOWN);
  if (list && people.length === 0) return null;

  return (
    <section data-tour="people" className="mt-5 lg:mt-8" aria-label="People for you">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">People for you</h2>
        <Link href="/meet" onClick={tapFeedback} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand">
          View more <ChevronRight size={16} />
        </Link>
      </div>

      {/* One long strip: swipe sideways through all 20 */}
      <ul className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1 no-scrollbar lg:mx-0 lg:px-0">
        {list
          ? people.map((p, i) => (
              <li key={p.id} className="shrink-0 animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setOpen(p.id);
                  }}
                  className="group flex w-[68px] flex-col items-center gap-1.5 text-center active:scale-95"
                  aria-label={p.online ? `${p.name}, online now` : p.name}
                >
                  <span className="relative block h-16 w-16">
                    <span className="absolute inset-0 overflow-hidden rounded-full bg-brand-soft ring-2 ring-surface shadow-[0_4px_12px_-6px_rgba(28,24,40,0.45)]">
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl(p.photo) ?? p.photo}
                          onError={thumbFallback(p.photo)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          // Softly blurred until you're connected, like on Meet
                          style={p.connected ? undefined : { filter: "blur(4px)", transform: "scale(1.15)" }}
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-[20px] font-semibold text-brand">{p.name.charAt(0)}</span>
                      )}
                    </span>
                    {p.online && <span className="absolute right-0.5 bottom-0.5 h-4 w-4 rounded-full bg-mint ring-2 ring-cream" aria-hidden />}
                  </span>
                  <span className={clsx("w-full truncate text-[12px] font-medium", p.connected ? "text-brand" : "text-ink-soft")}>
                    {p.name.split(" ")[0]}
                  </span>
                </button>
              </li>
            ))
          : Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                <span className="h-16 w-16 animate-pulse rounded-full bg-ink/[0.06]" />
                <span className="h-2.5 w-10 animate-pulse rounded-full bg-ink/[0.06]" />
              </li>
            ))}
      </ul>

      {open && <ExploreProfileSheet personId={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </section>
  );
}
