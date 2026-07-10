import type { Product, Profile } from "@/types/rivendy";

/** Sélection vedette sans nouvelle donnée : boostés → nouveautés (<14j) → premiers actifs. */
export function pickFeatured(active: Product[], max = 8): Product[] {
  if (active.length < 5) return []; // pas assez pour justifier une section séparée
  const boosted = active.filter((p) => p.status === "boosted");
  if (boosted.length >= 3) return boosted.slice(0, max);

  const now = Date.now();
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
  const fresh = active.filter((p) => {
    const t = new Date(p.created_at).getTime();
    return !Number.isNaN(t) && now - t < FOURTEEN_DAYS;
  });
  const merged = [...boosted];
  for (const p of fresh) if (!merged.some((m) => m.id === p.id)) merged.push(p);
  if (merged.length >= 3) return merged.slice(0, max);

  return active.slice(0, max);
}

/** Complétude boutique (0-100) pour le propriétaire, depuis données existantes. */
export function storeCompleteness(
  seller: Profile,
  hasProduct: boolean,
): {
  pct: number;
  missing: { label: string; href: string }[];
} {
  const checks: { ok: boolean; label: string; href: string }[] = [
    { ok: !!(seller.store_banner_url_web || seller.store_banner_url), label: "Ajouter une couverture", href: "" },
    { ok: !!seller.avatar_url, label: "Ajouter une photo de profil", href: "" },
    { ok: !!seller.store_description, label: "Ajouter une description", href: "/seller" },
    { ok: !!seller.country_id, label: "Renseigner votre pays", href: "/seller" },
    { ok: !!seller.voice_note_url, label: "Ajouter une présentation vocale", href: "/seller" },
    { ok: hasProduct, label: "Publier votre premier produit", href: "/sell" },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok).map(({ label, href }) => ({ label, href }));
  return { pct, missing };
}

/** Catégories principales présentes dans le catalogue (pour filtre + À propos). */
export function distinctCategories(products: Product[]): string[] {
  const set = new Set<string>();
  for (const p of products) if (p.category) set.add(String(p.category));
  return Array.from(set);
}
