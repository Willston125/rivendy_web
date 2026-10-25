import type { NextConfig } from "next";

const SUPABASE_HOST = "https://eiifosnczbgymcbhycwe.supabase.co";
const isDevelopment = process.env.NODE_ENV === "development";
const scriptSources = [
  "script-src 'self' 'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
].join(" ");

// Content-Security-Policy BLOQUANTE depuis le 2026-10-07 (audit n°2, S-5 a).
// Elle a tourné en REPORT-ONLY de juillet à octobre ; relevé du 2026-10-07 sur
// www.rivendy.com (accueil, fiche, boutique, recherche, connexion, légal,
// hôtels) : aucune violation, et toutes les images en base viennent de
// Supabase. 'unsafe-inline' reste toléré car Next injecte du script/style
// inline sans nonce — les nonces imposeraient le rendu dynamique de TOUTES
// les pages. Ce qui est désormais BLOQUÉ : tout script, image, cadre ou appel
// réseau vers un domaine non listé, les plugins (object-src), et le
// détournement de <base> ou des formulaires.
// ⚠️ Ajouter un service tiers (analytics, carte, paiement) = l'ajouter ICI,
// sinon il est bloqué en silence (visible seulement dans la console).
// Cloudflare Stream : miniatures, lecteur (iframe) et envoi direct des vidéos
// depuis le navigateur (parité vidéo app/site du 2026-10-04). Rivendy Play sur
// le site (Omnicanal lot C) : hls.js charge le manifeste et les segments
// (connexions), Safari les lit en HLS natif (médias), et hls.js travaille dans
// un worker créé depuis un blob: (worker-src).
const STREAM_HOST = "https://customer-22iqkw4cwdg7uf5h.cloudflarestream.com";
const STREAM_UPLOAD = "https://upload.cloudflarestream.com https://upload.videodelivery.net";

const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${SUPABASE_HOST} ${STREAM_HOST}`,
  // Notes vocales (Storage Supabase), préécoute d'un enregistrement (blob:) et
  // Rivendy Music (Omnicanal lot D) : liens audio signés du stockage R2.
  `media-src 'self' blob: ${SUPABASE_HOST} https://*.r2.cloudflarestorage.com ${STREAM_HOST}`,
  `frame-src ${STREAM_HOST}`,
  "style-src 'self' 'unsafe-inline'",
  scriptSources,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_HOST} wss://eiifosnczbgymcbhycwe.supabase.co ${STREAM_UPLOAD} ${STREAM_HOST}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// En-têtes de sécurité appliqués à toutes les routes.
const securityHeaders = [
  // CSP bloquante — voir csp ci-dessus.
  { key: "Content-Security-Policy", value: csp },
  // Anti-clickjacking : le site ne peut être embarqué que par lui-même.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Empêche le navigateur de "deviner" le type MIME (anti-sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne fuite pas l'URL complète en referrer vers les domaines tiers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS pendant 2 ans (n'a d'effet qu'en prod HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Désactive par défaut des capacités sensibles côté navigateur. Le micro est
  // ouvert au SEUL site (self) pour la présentation vocale de boutique —
  // `microphone=()` bloquait tout enregistrement, sans message.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Rivendy Music (Omnicanal lot D, 2026-10-21) : les sorties ont leur page
  // complète sous /music. L'app intercepte toujours ses liens /musique/… avant
  // toute requête (App Links) : la redirection ne concerne que le navigateur.
  async redirects() {
    return [
      { source: "/musique/release/:id", destination: "/music/album/:id", permanent: true },
      { source: "/musique", destination: "/music", permanent: true },
    ];
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
    // Audit 21, P0-5 : l'optimiseur /_next/image de Vercel renvoyait 402
    // (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED, quota épuisé) → toute image de
    // vendeur non encore en cache était cassée. On sert les images SANS passer
    // par l'optimiseur : elles viennent du Storage Supabase et sont déjà
    // compressées à l'upload (app et site). Plus de 402, coût nul.
    // Évolution possible : un `loader` vers Cloudflare Images ou les
    // transformations Supabase (offre payante) pour le redimensionnement.
    unoptimized: true,
    // Conservé comme documentation des hôtes d'images autorisés (inopérant
    // tant que unoptimized=true, mais à garder si l'optimiseur revient).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eiifosnczbgymcbhycwe.supabase.co",
      },
    ],
  },
};

export default nextConfig;
