import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/types/rivendy";
import { createAnonServerClient } from "@/lib/supabase/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";

// Plafond raisonnable pour rester dans la limite d'un sitemap (50 000 URLs) et
// borner le coût du build. Au-delà, il faudrait un index de sitemaps paginés.
const MAX_PRODUCTS = 5000;

/**
 * Sitemap dynamique (RIV-017). Base statique (accueil + catégories) + URLs
 * produits et boutiques tirées de la vue `visible_products`.
 *
 * Résilience : tout accès base est encapsulé dans try/catch. Si Supabase est
 * indisponible au build, on retombe proprement sur la base statique plutôt
 * que de faire échouer le build (comportement de l'ancien sitemap statique).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const base: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/?category=${c.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("visible_products")
      .select("id, seller_id, updated_at, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_PRODUCTS);

    if (!error && data) {
      const products: MetadataRoute.Sitemap = data.map((row) => ({
        url: `${SITE_URL}/products/${row.id as string}`,
        lastModified: new Date(
          (row.updated_at as string) || (row.created_at as string) || now,
        ),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

      // Une entrée par boutique distincte ayant au moins un produit visible.
      const sellerIds = new Set<string>();
      for (const row of data) {
        const sid = row.seller_id as string | null;
        if (sid) sellerIds.add(sid);
      }
      const stores: MetadataRoute.Sitemap = [...sellerIds].map((sid) => ({
        url: `${SITE_URL}/store/${sid}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      }));

      dynamic = [...products, ...stores];
    }
  } catch {
    // Base indisponible → on sert au moins le sitemap statique.
    dynamic = [];
  }

  return [...base, ...dynamic];
}
