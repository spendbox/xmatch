"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, LayoutDashboard, LogOut, Menu, MessageCircleQuestion, Sparkles, Users, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { adminLogout } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/nights", label: "Events", icon: CalendarDays },
  { href: "/admin/prompts", label: "Daily prompts", icon: Sparkles },
  { href: "/admin/icebreakers", label: "Icebreakers", icon: MessageCircleQuestion },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const current = NAV.find((n) => on(n.href));
  const [menu, setMenu] = useState(false);

  // Close the menu after moving to another page, and lock the page behind it while open
  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
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

      {/* Phone/tablet: top bar with a menu button */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-ink px-3 text-white lg:hidden">
        <button
          onClick={() => setMenu(true)}
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={menu}
        >
          <Menu size={22} />
        </button>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand">
          <MaskIcon className="w-5 text-white" eyes="#5b3fd9" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{current?.label ?? "Admin"}</p>
      </header>

      {/* Phone/tablet: slide-in menu */}
      <div className={clsx("fixed inset-0 z-50 lg:hidden", menu ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!menu}>
        <button
          className={clsx("absolute inset-0 bg-ink/50 transition-opacity duration-300", menu ? "opacity-100" : "opacity-0")}
          onClick={() => setMenu(false)}
          aria-label="Close menu"
          tabIndex={menu ? 0 : -1}
        />
        <aside
          className={clsx(
            "absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-lift transition-transform duration-300",
            menu ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-label="Admin menu"
        >
          <div className="flex items-center gap-2.5 px-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand">
              <MaskIcon className="w-6 text-white" eyes="#5b3fd9" />
            </span>
            <div className="flex-1">
              <p className="font-display text-[18px] leading-none font-semibold">Dashpad</p>
              <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Admin</p>
            </div>
            <button onClick={() => setMenu(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10" aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
          <nav className="mt-8 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenu(false)}
                className={clsx(
                  "flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition",
                  on(n.href) ? "bg-white text-ink" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <n.icon size={19} /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-1 border-t border-white/10 pt-3">
            <Link href="/" target="_blank" className="flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-white/75 hover:bg-white/10">
              <ExternalLink size={18} /> View site
            </Link>
            <form action={adminLogout}>
              <button className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-white/75 hover:bg-chili/30 hover:text-white">
                <LogOut size={18} /> Log out
              </button>
            </form>
          </div>
        </aside>
      </div>

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
