import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rivendy.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Espaces privés / transactionnels : non indexés.
        disallow: [
          "/seller",
          "/wallet",
          "/checkout",
          "/api",
          "/cart",
          "/orders",
          "/profile",
          "/favorites",
          "/notifications",
          "/plus/abonnement",
          "/music/library",
          "/music/favorites",
          "/music/history",
          "/music/search",
          // Aperçu privé d'une radio : réservé à la station (2026-11-11).
          "/music/radio/apercu",
          // Studio de l'artiste (publier sur le site, 2026-11-11).
          "/music/studio",
          // Rivendy Play (Omnicanal lot C) : lecteur et pages du compte.
          "/play/watch",
          "/play/my-list",
          "/play/history",
          "/play/search",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
