"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarHeart, ExternalLink, LayoutDashboard, LogOut, MessageCircleQuestion } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { adminLogout } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/nights", label: "Events", icon: CalendarHeart },
  { href: "/admin/icebreakers", label: "Icebreakers", icon: MessageCircleQuestion },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <div className="min-h-dvh bg-cream lg:pl-[250px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-ink px-4 py-6 text-white lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand">
            <MaskIcon className="w-6 text-white" eyes="#5b3fd9" />
          </span>
          <div>
            <p className="font-display text-[18px] leading-none font-semibold">Dashpad</p>
            <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Admin</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition",
                on(n.href) ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <n.icon size={18} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <Link href="/" target="_blank" className="flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] text-white/70 hover:bg-white/10">
            <ExternalLink size={17} /> View site
          </Link>
          <form action={adminLogout}>
            <button className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] text-white/70 hover:bg-chili/30 hover:text-white">
              <LogOut size={17} /> Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Phone/tablet top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-ink px-3 py-2.5 text-white no-scrollbar lg:hidden">
        <MaskIcon className="mr-1 w-7 shrink-0 text-white" eyes="#1c1828" />
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={clsx("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold", on(n.href) ? "bg-white text-ink" : "text-white/70")}
          >
            <n.icon size={15} /> {n.label}
          </Link>
        ))}
        <form action={adminLogout} className="ml-auto">
          <button className="grid h-9 w-9 place-items-center rounded-full text-white/70" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

export function AdminTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[32px] leading-tight font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
