"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarHeart, Heart, LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Avatar } from "@/components/ui/Avatar";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { useWallet } from "@/components/keys/useWallet";
import { logOut } from "@/app/(auth)/actions";
import { FREE_MASQUERADES_PER_DAY } from "@/lib/keys";

export type ChromeUser = { id: string; name: string; photo?: string | null };

const items = [
  { href: "/home", label: "Home", icon: (on: boolean) => <MaskIcon className="w-[22px]" eyes={on ? "#5b3fd9" : "#faf7f2"} /> },
  { href: "/events", label: "Masquerade Nights", icon: () => <CalendarHeart size={21} /> },
  { href: "/matches", label: "Matches", icon: () => <Heart size={21} /> },
  { href: "/wallet", label: "Keys", icon: () => <KeyCoin size={22} /> },
  { href: "/profile", label: "Profile", icon: () => <UserRound size={21} /> },
];

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/") || (href === "/home" && path.startsWith("/masquerade"));
}

/** Left-hand navigation on computers and tablets in landscape. */
export function Sidebar({ user }: { user: ChromeUser }) {
  const path = usePathname();
  const { wallet } = useWallet(user.id);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo href="/home" />
      </div>

      <nav className="mt-8 space-y-1" aria-label="Main">
        {items.map((it) => {
          const on = isActive(path, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "group flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition",
                on ? "bg-brand text-white shadow-[0_8px_20px_-10px_rgb(91_63_217/0.7)]" : "text-ink-soft hover:bg-cream hover:text-ink",
              )}
            >
              <span className="grid w-7 place-items-center">{it.icon(on)}</span>
              {it.label}
              {it.href === "/wallet" && wallet && (
                <span className={clsx("ml-auto rounded-full px-2 py-0.5 text-[12px] font-bold", on ? "bg-white/20" : "bg-gold-soft text-[#8a5a00]")}>
                  {wallet.balance}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/home"
        className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-4 text-white transition hover:brightness-105"
      >
        <span aria-hidden className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10" />
        <MaskIcon className="relative w-9 animate-float text-white" eyes="#6d4ff0" />
        <p className="relative mt-2 text-[15px] font-semibold">Ready to mask up?</p>
        <p className="relative text-[12px] text-white/75">
          {wallet ? `${wallet.free_left} of ${FREE_MASQUERADES_PER_DAY} free left today` : "5 minutes, both masked"}
        </p>
      </Link>

      <div className="mt-auto flex items-center gap-3 rounded-2xl p-2">
        <Avatar src={user.photo} name={user.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{user.name}</p>
          <Link href="/profile" className="text-[12px] text-muted hover:text-brand">
            View profile
          </Link>
        </div>
        <form action={logOut}>
          <button className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-chili-soft hover:text-chili" aria-label="Log out" title="Log out">
            <LogOut size={17} />
          </button>
        </form>
      </div>
    </aside>
  );
}
