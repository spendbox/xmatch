export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin";
import { AdminTitle } from "@/components/admin/AdminShell";
import { MaskAllPhotos } from "@/components/admin/MaskAllPhotos";

/** Admin → Mask photos: mask every member's photos that aren't masked yet */
export default async function MasksPage() {
  await requireAdmin();
  return (
    <>
      <AdminTitle title="Mask photos" subtitle="Hide every member's face with a mask. Runs in this browser: keep this page open until it finishes." />
      <MaskAllPhotos />
    </>
  );
}
