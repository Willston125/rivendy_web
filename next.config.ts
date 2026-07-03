import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les routes. Volontairement
// non-cassants : pas de Content-Security-Policy stricte ici (elle
// nécessite des nonces avec Next/Turbopack — chantier dédié) pour ne
// pas casser le rendu SSR / les images distantes.
const securityHeaders = [
  // Anti-clickjacking : le site ne peut être embarqué que par lui-même.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Empêche le navigateur de "deviner" le type MIME (anti-sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne fuite pas l'URL complète en referrer vers les domaines tiers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS pendant 2 ans (n'a d'effet qu'en prod HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Désactive par défaut des capacités sensibles côté navigateur.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eiifosnczbgymcbhycwe.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
