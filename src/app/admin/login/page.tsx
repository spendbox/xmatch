import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin";
import { AdminLoginForm } from "./AdminLoginForm";
import { MaskIcon } from "@/components/ui/MaskIcon";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  const configured = adminConfigured();
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-5">
      <div aria-hidden className="absolute -top-32 -left-24 h-96 w-96 animate-blob rounded-full text-brand/40 glow" />
      <div aria-hidden className="absolute -right-24 -bottom-32 h-96 w-96 animate-blob rounded-full text-[#c2306b]/30 glow [animation-delay:-6s]" />
      <div className="relative w-full max-w-sm animate-fade-up rounded-[32px] bg-surface p-7 shadow-lift">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white">
          <MaskIcon className="w-9" eyes="#1c1828" />
        </span>
        <h1 className="mt-5 font-display text-[28px] font-semibold">Dashpad Admin</h1>
        <p className="mt-1 text-[14px] text-muted">For the Dashpad team only.</p>
        {configured ? (
          <AdminLoginForm />
        ) : (
          <p className="mt-6 rounded-2xl bg-gold-soft p-4 text-[14px] text-[#8a5a00]">
            Admin isn&apos;t set up yet. Add <b>ADMIN_EMAIL</b> and <b>ADMIN_PASSWORD</b> in Vercel → Settings → Environment Variables, then redeploy.
          </p>
        )}
      </div>
    </main>
  );
}
