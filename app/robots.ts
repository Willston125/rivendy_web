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
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
