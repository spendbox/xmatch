"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { MessageCircle, UserRound, UsersRound } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import type { MenuBadges } from "./useMenuBadges";
import { badgeFor } from "./badges";
import { isActive } from "./Sidebar";

const tabs = [
  { href: "/home", label: "Home", icon: (on: boolean) => <MaskIcon className="w-6" eyes={on ? "#efebfd" : "#ffffff"} /> },
  { href: "/meet", label: "Meet", icon: () => <UsersRound size={22} /> },
  { href: "/matches", label: "Chats", icon: () => <MessageCircle size={22} /> },
  { href: "/profile", label: "Profile", icon: () => <UserRound size={22} /> },
];

export function BottomNav({ badges }: { badges?: MenuBadges }) {
  const path = usePathname();
  // The tab you just tapped lights up straight away, before its page arrives
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {tabs.map((t) => {
          const on = tapped ? tapped === t.href : isActive(path, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                // Load the whole tab ahead of time, so tapping it opens straight away
                prefetch
                onClick={() => setTapped(t.href)}
                className={clsx(
                  "flex h-full flex-col items-center justify-center gap-1 text-[12px] font-semibold transition",
                  on ? "text-brand" : "text-muted",
                )}
              >
                <span className="relative grid h-6 place-items-center">
                  {t.icon(on)}
                  {badgeFor(t.href, badges) !== null && (
                    <span className="absolute -top-1.5 -right-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-chili px-1 text-[10px] leading-none font-bold text-white ring-2 ring-surface">
                      {badgeFor(t.href, badges)}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
