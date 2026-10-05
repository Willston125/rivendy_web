import type { Product } from "@/types/rivendy";

/**
 * 👁️ Stories vues — miroir de `StorySeenStore` (app) : stockage LOCAL, par
 * vendeur, de l'horodatage de la story la plus récente déjà ouverte. Une
 * NOUVELLE story (story_started_at plus récent) rallume l'anneau ; vider le
 * stockage remet simplement tout en « non vu ». Aucun schéma serveur.
 */
const KEY = "rivendy_story_seen_v1";
const NO_TIMESTAMP = "seen";

export function loadSeen(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function latestOf(products: Product[]): string {
  let latest: number | null = null;
  for (const p of products) {
    const t = p.story_started_at ? Date.parse(p.story_started_at) : NaN;
    if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
  }
  return latest === null ? NO_TIMESTAMP : new Date(latest).toISOString();
}

/** `true` si TOUTES les stories actuelles de ce vendeur ont déjà été vues. */
export function isSeen(seen: Record<string, string>, sellerId: string, products: Product[]): boolean {
  const stored = seen[sellerId];
  if (!stored) return false;
  const latest = latestOf(products);
  if (latest === NO_TIMESTAMP || stored === NO_TIMESTAMP) return stored === latest;
  return Date.parse(stored) >= Date.parse(latest);
}

export function markSeen(sellerId: string, products: Product[]): Record<string, string> {
  const next = { ...loadSeen(), [sellerId]: latestOf(products) };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
  return next;
}
