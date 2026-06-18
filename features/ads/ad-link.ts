import type { Advertisement } from "@/types/rivendy";
import { CATEGORIES } from "@/types/rivendy";

/** Résout l'id de catégorie de l'app (ex. "Beauté & Parfums" → "beauteparfums"). */
function getCategoryId(value: string): string {
  const normalizedValue = value.toLowerCase().replace(/ & /g, "").replace(/ /g, "");
  const match = CATEGORIES.find(
    (c) =>
      c.id.toLowerCase() === normalizedValue ||
      c.label.toLowerCase().replace(/ & /g, "").replace(/ /g, "") === normalizedValue
  );
  return match ? match.id : value;
}

/** Construit l'URL de destination d'une pub selon son type de lien. */
export function hrefForAd(ad: Advertisement): string {
  if (ad.link_type === "product" && ad.link_value) return `/products/${ad.link_value}`;
  if (ad.link_type === "store" && ad.link_value) return `/store/${ad.link_value}`;
  if (ad.link_type === "category" && ad.link_value) return `/?category=${getCategoryId(ad.link_value)}`;
  if (ad.link_type === "whatsapp" && ad.link_value) return `https://wa.me/${ad.link_value.replace(/\+/g, "")}`;
  if (ad.link_type === "external" && ad.link_value) return ad.link_value;
  return "/";
}

/** Vrai si le lien doit s'ouvrir dans un nouvel onglet (lien sortant). */
export function isExternalAd(ad: Advertisement): boolean {
  return ad.link_type === "external" || ad.link_type === "whatsapp";
}
