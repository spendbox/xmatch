"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, MessageCircle, UserRound } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import type { MenuBadges } from "./useMenuBadges";
import { badgeFor } from "./badges";

const tabs = [
  { href: "/home", label: "Home", icon: (on: boolean) => <MaskIcon className="w-6" eyes={on ? "#efebfd" : "#ffffff"} /> },
  { href: "/events", label: "Events", icon: () => <CalendarDays size={22} /> },
  { href: "/matches", label: "Chats", icon: () => <MessageCircle size={22} /> },
  { href: "/profile", label: "Profile", icon: () => <UserRound size={22} /> },
];

export function BottomNav({ badges }: { badges?: MenuBadges }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {tabs.map((t) => {
          const on = path === t.href || path.startsWith(t.href + "/") || (t.href === "/home" && (path.startsWith("/masquerade") || path.startsWith("/feed")));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
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
