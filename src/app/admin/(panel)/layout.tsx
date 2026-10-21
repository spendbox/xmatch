import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";

// Always check the admin login on every visit
export const dynamic = "force-dynamic";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
