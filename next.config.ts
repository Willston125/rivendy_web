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
// depuis le navigateur (parité vidéo app/site du 2026-10-04).
const STREAM_HOST = "https://customer-22iqkw4cwdg7uf5h.cloudflarestream.com";
const STREAM_UPLOAD = "https://upload.cloudflarestream.com https://upload.videodelivery.net";

const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${SUPABASE_HOST} ${STREAM_HOST}`,
  // Notes vocales (Storage Supabase) et préécoute d'un enregistrement (blob:).
  `media-src 'self' blob: ${SUPABASE_HOST}`,
  `frame-src ${STREAM_HOST}`,
  "style-src 'self' 'unsafe-inline'",
  scriptSources,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_HOST} wss://eiifosnczbgymcbhycwe.supabase.co ${STREAM_UPLOAD}`,
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    // Hôtes autorisés pour l'optimiseur next/image. Restreint au Storage
    // Supabase (source unique des images marchandes — vérifié en prod le
    // 2026-07-16 : tous les /_next/image servis pointent ce host). Le joker
    // "**" précédent faisait de l'optimiseur un proxy d'images ouvert
    // (RIV-007). Si un nouvel hôte d'images est introduit, l'ajouter ici.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eiifosnczbgymcbhycwe.supabase.co",
      },
    ],
  },
};

export default nextConfig;
