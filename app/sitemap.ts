import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/types/rivendy";
import { createAnonServerClient } from "@/lib/supabase/server";
import { absoluteUrl, HOME_MARKET_ID, marketHomePath, storesPath } from "@/lib/seo";

// Plafond raisonnable pour rester dans la limite d'un sitemap (50 000 URLs) et
// borner le coût du build. Au-delà, il faudrait un index de sitemaps paginés.
const MAX_PRODUCTS = 5000;

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));

/**
 * Sitemap dynamique (RIV-017, refondu pour le référencement le 2026-10-13).
 *
 * Chaque adresse listée est EXACTEMENT l'adresse officielle (canonical) que
 * déclare la page — sinon Google ignore l'entrée. Accueil nu `/` = Comores ;
 * les autres marchés sont listés sous `/?country=XX`, avec leurs catégories.
 * Seuls les couples marché × catégorie qui ont au moins un article visible
 * sont listés : une page vide est traitée par Google comme une erreur.
 *
 * Résilience : tout accès base est encapsulé dans try/catch. Si Supabase est
 * indisponible au build, on retombe proprement sur la base statique plutôt
 * que de faire échouer le build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const base: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/vendre-en-ligne"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl(storesPath(HOME_MARKET_ID)), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/help"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/legal"), lastModified: now, changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/droits-auteur"), lastModified: now, changeFrequency: "yearly", priority: 0.1 },
    // Rivendy Musique (Omnicanal lot D, 2026-10-21).
    { url: absoluteUrl("/music"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/music/hit"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("visible_products")
      .select("id, seller_id, country_id, category, updated_at, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_PRODUCTS);

    if (!error && data) {
      const markets = new Set<string>();
      const marketCategories = new Set<string>();
      const sellerIds = new Set<string>();

      const products: MetadataRoute.Sitemap = data.map((row) => {
        const market = String(row.country_id ?? "").toUpperCase();
        const category = String(row.category ?? "");
        if (market) {
          markets.add(market);
          if (CATEGORY_IDS.has(category)) marketCategories.add(`${market}|${category}`);
        }
        const sid = row.seller_id as string | null;
        if (sid) sellerIds.add(sid);
        return {
          url: absoluteUrl(`/products/${row.id as string}`),
          lastModified: new Date(
            (row.updated_at as string) || (row.created_at as string) || now,
          ),
          changeFrequency: "weekly" as const,
          priority: 0.6,
        };
      });

      // Le marché Comores est déjà couvert par `/` et `/boutiques` (base).
      const marketPages: MetadataRoute.Sitemap = [...markets]
        .filter((m) => m !== HOME_MARKET_ID)
        .flatMap((m) => [
          { url: absoluteUrl(marketHomePath(m)), lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
          { url: absoluteUrl(storesPath(m)), lastModified: now, changeFrequency: "daily" as const, priority: 0.7 },
        ]);

      const categoryPages: MetadataRoute.Sitemap = [...marketCategories].map((key) => {
        const [market, category] = key.split("|");
        return {
          url: absoluteUrl(marketHomePath(market, category)),
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: market === HOME_MARKET_ID ? 0.8 : 0.7,
        };
      });

      // Une entrée par boutique distincte ayant au moins un produit visible.
      const stores: MetadataRoute.Sitemap = [...sellerIds].map((sid) => ({
        url: absoluteUrl(`/store/${sid}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      }));

      dynamic = [...marketPages, ...categoryPages, ...products, ...stores];
    }
  } catch {
    // Base indisponible → on sert au moins le sitemap statique.
    dynamic = [];
  }

  // Sorties musicales publiées : une page complète chacune (/music/album).
  let albums: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAnonServerClient();
    const { data } = await supabase
      .from("music_releases")
      .select("id, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1000);
    albums = (data ?? []).map((r) => ({
      url: absoluteUrl(`/music/album/${r.id as string}`),
      lastModified: new Date((r.published_at as string) || now),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  } catch {
    albums = [];
  }

  return [...base, ...dynamic, ...albums];
}
