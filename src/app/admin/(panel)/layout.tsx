import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
