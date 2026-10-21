import { requireAdmin } from "@/lib/admin";
import { NightEditor } from "@/components/admin/NightEditor";

export default async function NewNightPage() {
  await requireAdmin();
  return <NightEditor />;
}
