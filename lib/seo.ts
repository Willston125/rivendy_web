import { cache } from "react";
import { PLAY_STORE_URL } from "@/lib/config/app-links";

// Sérialisation JSON-LD sûre (anti-XSS). Vit dans un fichier pur sans import
// pour rester testable sous `node --test` ; réexportée ici pour que les pages
// l'importent depuis @/lib/seo comme le reste du SEO (audit 21, WEBMEDIA-1).
export { safeJsonLd } from "./safe-json-ld";
import { inMarket } from "@/lib/utils/market-phrase";
import { getSellerMarket } from "@/services/public-data";
import type { Country } from "@/types/rivendy";

/**
 * Référencement Google — règles communes (2026-10-13).
 *
 * Priorité du propriétaire : LES COMORES D'ABORD. L'accueil nu `/` est donc
 * servi aux Comores (voir HOME_MARKET_ID) ; chaque autre marché a son adresse
 * `/?country=XX`. Toute page déclare son adresse officielle (canonical) pour
 * que Google ne disperse pas son classement entre `?sort=`, `?page=`, filtres…
 *
 * Expressions visées : « vendre en ligne Comores », « boutique Moroni »,
 * « livraison Djibouti ». Aucune promesse ici qui ne soit vraie dans le
 * produit : livraison par quartier en Grande Comore (zones structurées),
 * zones tarifées à Djibouti (DEC-2), le vendeur encaisse son prix fixé.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";

/** Fiche Google Play — publiée sous `com.rivendy.app`. La variable Vercel
 *  reste prioritaire (même source que la bannière de téléchargement). */
export const PLAY_LISTING_URL =
  PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.rivendy.app";

/**
 * Marché servi sur l'accueil nu `/` (et donc lu par Google en premier).
 * Distinct de DEFAULT_COUNTRY_ID, qui reste le repli des DONNÉES (pays d'un
 * profil, d'un article sans marché…) et ne doit pas bouger pour du SEO.
 */
export const HOME_MARKET_ID = "KM";

/** Adresse officielle d'un fil d'accueil : marché + catégorie + page. Les
 *  filtres (tri, prix, sous-catégorie, recherche) n'en font pas partie. */
export function marketHomePath(countryId: string, category?: string | null, page = 1): string {
  const params = new URLSearchParams();
  const id = countryId.toUpperCase();
  if (id !== HOME_MARKET_ID) params.set("country", id);
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/** Annuaire des boutiques d'un marché. */
export function storesPath(countryId: string): string {
  const id = countryId.toUpperCase();
  return id === HOME_MARKET_ID ? "/boutiques" : `/boutiques?country=${id}`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Ce que chaque marché met en avant — uniquement des faits vérifiés. */
const MARKET_PITCH: Record<string, { places: string; delivery: string }> = {
  KM: { places: "boutiques de Moroni et de Grande Comore", delivery: "livraison par quartier en Grande Comore" },
  DJ: { places: "boutiques de Djibouti-ville", delivery: "livraison à Djibouti selon votre quartier" },
};

export function marketPitch(country: Pick<Country, "id" | "name">) {
  return MARKET_PITCH[country.id] ?? { places: `boutiques locales`, delivery: "livraison ou retrait selon le vendeur" };
}

/** Titre + description de l'accueil d'un marché, avec ou sans catégorie. */
export function homeSeo(country: Pick<Country, "id" | "name">, categoryLabel?: string | null) {
  const where = inMarket(country);
  const { places, delivery } = marketPitch(country);
  if (categoryLabel) {
    return {
      title: `${categoryLabel} ${where} — achat en ligne | Rivendy`,
      description: clip(
        `${categoryLabel} ${where} : achetez en ligne auprès des ${places} sur Rivendy, avec ${delivery}. Commande suivie par Rivendy.`,
      ),
    };
  }
  return {
    title: `Vendre et acheter en ligne ${where} — Rivendy`,
    description: clip(
      `Achetez et vendez en ligne ${where} : ${places}, restaurants, pharmacies et ${delivery}. Ouvrez votre boutique Rivendy en quelques minutes.`,
    ),
  };
}

/** Description courte pour Google : ~155 caractères, coupée sur un mot. */
export function clip(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

/**
 * Marché d'une boutique = celui où elle a le plus d'articles visibles. Le
 * `country_id` du profil vaut DJ pour tous les comptes créés depuis le
 * 2026-09-02 : il faisait dire « à Djibouti » aux boutiques comoriennes.
 */
export const getSellerMarketId = cache(async (sellerId: string): Promise<string | null> => {
  try {
    return await getSellerMarket(sellerId);
  } catch {
    return null;
  }
});
