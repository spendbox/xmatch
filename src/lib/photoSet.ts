/**
 * Your photos as pairs: the masked copy everyone sees, the original, and the mask it wears.
 * Plain helpers (no browser code), so the server can use them too.
 */
import type { PhotoMask, Profile } from "./types";

/** Shown instead of a photo that hasn't been masked yet */
export const PLACEHOLDER = "/masked-photo.svg";

export type MyPhoto = { masked: string; real: string; mask: PhotoMask | null };

export function photosOf(p: Pick<Profile, "photos" | "real_photos" | "photo_masks">): MyPhoto[] {
  const masked = p.photos ?? [];
  const real = p.real_photos ?? masked;
  const masks = p.photo_masks ?? [];
  return masked.map((m, i) => ({ masked: m, real: real[i] ?? m, mask: masks[i] ?? null }));
}

export function photosPatch(items: MyPhoto[]) {
  return { photos: items.map((i) => i.masked), real_photos: items.map((i) => i.real), photo_masks: items.map((i) => i.mask ?? { none: true as const }) };
}
