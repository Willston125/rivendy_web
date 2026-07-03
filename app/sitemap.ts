import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/types/rivendy";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://rivendy.com";

/**
 * Sitemap statique de base : accueil + une entrée par catégorie.
 * Volontairement sans fetch Supabase pour rester robuste au build même
 * si la base est indisponible. Les URLs produits pourront être ajoutées
 * plus tard (sitemap dynamique) si le référencement fiche produit devient
 * une priorité.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const home: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const categories: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE_URL}/?category=${c.id}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...home, ...categories];
}
