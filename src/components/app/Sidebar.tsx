"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, MessageCircle, Newspaper, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { MaskLineIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { useWallet } from "@/components/keys/useWallet";
import { FREE_MASQUERADES_PER_DAY } from "@/lib/keys";
import type { MenuBadges } from "./useMenuBadges";
import { badgeFor } from "./badges";

export type ChromeUser = { id: string; name: string; photo?: string | null };

const items = [
  { href: "/home", label: "Home", icon: (on: boolean) => <MaskIcon className="w-[22px]" eyes={on ? "#5b3fd9" : "#faf7f2"} /> },
  { href: "/events", label: "Events", icon: () => <CalendarDays size={21} /> },
  { href: "/matches", label: "Chats", icon: () => <MessageCircle size={21} /> },
  { href: "/wallet", label: "Keys", icon: () => <KeyCoin size={22} /> },
  { href: "/profile", label: "Profile", icon: () => <UserRound size={21} /> },
];

/** The two parts of Home, shown under it in the menu */
const homeParts = [
  { href: "/home", label: "Masquerade", icon: <MaskLineIcon size={17} /> },
  { href: "/feed", label: "Feed", icon: <Newspaper size={17} /> },
];

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/") || (href === "/home" && (path.startsWith("/masquerade") || path.startsWith("/feed")));
}

function toggleCollapsed() {
  const root = document.documentElement;
  const next = root.dataset.sidebar === "collapsed" ? "" : "collapsed";
  if (next) root.dataset.sidebar = next;
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem("dp-sidebar", next || "open");
  } catch {}
}

/** Left-hand navigation on computers. Can be folded down to icons. */
export function Sidebar({ user, badges }: { user: ChromeUser; badges?: MenuBadges }) {
  const path = usePathname();
  const { wallet } = useWallet(user.id);
  const hideWhenFolded = "collapsed:hidden";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col overflow-hidden border-r border-line bg-surface px-4 py-6 transition-[width] duration-300 lg:flex collapsed:px-3">
      <div className="flex items-center justify-between gap-2 px-2 collapsed:flex-col collapsed:px-0">
        <Link href="/home" className="inline-flex items-center gap-2" aria-label="Dashpad home">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <MaskIcon className="w-5" eyes="#5b3fd9" />
          </span>
          <span className={clsx("font-display text-xl font-semibold tracking-tight text-ink", hideWhenFolded)}>Dashpad</span>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-cream hover:text-ink collapsed:mt-3"
          aria-label="Fold or unfold the menu"
          title="Fold or unfold the menu"
        >
          <PanelLeftClose size={19} className={hideWhenFolded} />
          <PanelLeftOpen size={19} className="hidden collapsed:block" />
        </button>
      </div>

      <nav className="mt-8 space-y-1" aria-label="Main">
        {items.map((it) => {
          const on = isActive(path, it.href);
          const home = it.href === "/home";
          return (
            <div key={it.href}>
            <Link
              href={it.href}
              title={it.label}
              className={clsx(
                "group flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold whitespace-nowrap transition collapsed:justify-center collapsed:px-0",
                on ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgb(91_63_217/0.7)]" : "text-ink-soft hover:bg-cream hover:text-ink",
              )}
            >
              <span className="relative grid w-7 shrink-0 place-items-center">
                {it.icon(on)}
                {badgeFor(it.href, badges) !== null && (
                  <span className={clsx("absolute -top-1 -right-1 hidden h-2.5 w-2.5 rounded-full ring-2 collapsed:block", on ? "bg-white ring-brand" : "bg-chili ring-surface")} />
                )}
              </span>
              <span className={hideWhenFolded}>{it.label}</span>
              {!home && badgeFor(it.href, badges) !== null && (
                <span
                  className={clsx(
                    "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold",
                    hideWhenFolded,
                    on ? "bg-white text-brand" : "bg-chili text-white",
                  )}
                >
                  {badgeFor(it.href, badges)}
                </span>
              )}
              {it.href === "/wallet" && wallet && (
                <span className={clsx("ml-auto rounded-full px-2 py-0.5 text-[12px] font-bold", hideWhenFolded, on ? "bg-white/20" : "bg-gold-soft text-[#8a5a00]")}>
                  {wallet.balance}
                </span>
              )}
            </Link>
            {home && (
              <div className={clsx("mt-1 mb-2 ml-[26px] space-y-0.5 border-l-2 border-line pl-3", hideWhenFolded)}>
                {homeParts.map((sub) => {
                  const subOn = path === sub.href || path.startsWith(sub.href + "/") || (sub.href === "/home" && path.startsWith("/masquerade"));
                  const b = sub.href === "/feed" ? badgeFor("/feed", badges) : null;
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      aria-current={subOn ? "page" : undefined}
                      className={clsx(
                        "flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] font-semibold whitespace-nowrap transition",
                        subOn ? "bg-brand-soft text-brand" : "text-muted hover:bg-cream hover:text-ink",
                      )}
                    >
                      {sub.icon}
                      {sub.label}
                      {b && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-chili px-1.5 text-[11px] font-bold text-white">{b}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
            </div>
          );
        })}
      </nav>

      <Link
        href="/home"
        className={clsx(
          "relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-4 text-white transition hover:brightness-105",
          hideWhenFolded,
        )}
      >
        <span aria-hidden className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10" />
        <MaskIcon className="relative w-9 animate-float text-white" eyes="#6d4ff0" />
        <p className="relative mt-2 text-[15px] font-semibold">Ready to mask up?</p>
        <p className="relative text-[12px] text-white/75">
          {wallet ? `${wallet.free_left} of ${FREE_MASQUERADES_PER_DAY} free left today` : "5 minutes, both masked"}
        </p>
      </Link>

      <div className="mt-auto flex items-center gap-3 rounded-2xl p-2 collapsed:flex-col collapsed:p-0">
        <Link href="/profile" title="View profile" className="shrink-0">
          <Avatar src={user.photo} name={user.name} size={40} />
        </Link>
        <div className={clsx("min-w-0 flex-1", hideWhenFolded)}>
          <p className="truncate text-[14px] font-semibold">{user.name}</p>
          <Link href="/profile" className="text-[12px] text-muted hover:text-brand">
            View profile
          </Link>
        </div>
      </div>
    </aside>
  );
}
