import type { NextConfig } from "next";

const SUPABASE_HOST = "https://eiifosnczbgymcbhycwe.supabase.co";
const isDevelopment = process.env.NODE_ENV === "development";
const scriptSources = [
  "script-src 'self' 'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
].join(" ");

// Content-Security-Policy en mode REPORT-ONLY (RIV-008). Ne bloque RIEN : le
// navigateur signale seulement les violations dans la console. C'est l'étape
// d'observation avant un éventuel passage en mode bloquant (qui nécessitera
// des nonces avec Next/Turbopack). 'unsafe-inline' reste toléré ici car Next
// injecte du style/script inline sans nonce ; connect-src autorise l'API +
// le Realtime (wss) Supabase.
// Cloudflare Stream : miniatures, lecteur (iframe) et envoi direct des vidéos
// depuis le navigateur (parité vidéo app/site du 2026-10-04).
const STREAM_HOST = "https://customer-22iqkw4cwdg7uf5h.cloudflarestream.com";
const STREAM_UPLOAD = "https://upload.cloudflarestream.com https://upload.videodelivery.net";

const cspReportOnly = [
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
].join("; ");

// En-têtes de sécurité appliqués à toutes les routes.
const securityHeaders = [
  // CSP d'observation (non bloquante) — voir cspReportOnly ci-dessus.
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
