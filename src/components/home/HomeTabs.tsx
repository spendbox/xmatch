"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Newspaper } from "lucide-react";
import { MaskLineIcon } from "@/components/ui/icons";
import { tapFeedback } from "@/components/ui/Button";
import { useMenuBadgesContext } from "@/components/app/useMenuBadges";
import { badgeFor } from "@/components/app/badges";

const TABS = [
  { href: "/home", label: "Masquerade", icon: <MaskLineIcon size={17} /> },
  { href: "/feed", label: "Feed", icon: <Newspaper size={16} /> },
];

/** Switch between the two parts of Home on phones: Masquerade and the Feed. (Computers use the side menu.) */
export function HomeTabs({ className }: { className?: string }) {
  const path = usePathname();
  const badges = useMenuBadgesContext();
  return (
    <nav aria-label="Home" className={clsx("grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 shadow-card lg:hidden", className)}>
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(t.href + "/");
        const badge = badgeFor(t.href === "/feed" ? "/feed" : "", badges);
        return (
          <Link
            key={t.href}
            href={t.href}
            onClick={() => tapFeedback()}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition",
              on ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgb(91_63_217/0.7)]" : "text-ink-soft hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
            {badge && !on && (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-chili px-1.5 text-[10px] leading-none font-bold text-white">{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
