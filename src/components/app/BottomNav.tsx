"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarHeart, Heart, UserRound } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";

const tabs = [
  { href: "/home", label: "Home", icon: (on: boolean) => <MaskIcon className="w-6" eyes={on ? "#efebfd" : "#ffffff"} /> },
  { href: "/events", label: "Nights", icon: () => <CalendarHeart size={22} /> },
  { href: "/matches", label: "Matches", icon: () => <Heart size={22} /> },
  { href: "/profile", label: "Profile", icon: () => <UserRound size={22} /> },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {tabs.map((t) => {
          const on = path === t.href || path.startsWith(t.href + "/") || (t.href === "/home" && path.startsWith("/masquerade"));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={clsx(
                  "flex h-full flex-col items-center justify-center gap-1 text-[12px] font-semibold transition",
                  on ? "text-brand" : "text-muted",
                )}
              >
                <span className="grid h-6 place-items-center">{t.icon(on)}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
