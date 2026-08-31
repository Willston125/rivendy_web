import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/app/providers";
import { AppHeader } from "@/components/layout/app-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppDownloadBanner } from "@/features/app-banner/app-download-banner";

export const metadata: Metadata = {
  title: {
    default: "Rivendy — Marketplace",
    template: "%s | Rivendy",
  },
  description:
    "Rivendy est la marketplace multi-marchés africaine. Achetez, vendez et commandez des produits locaux en toute sécurité.",
  metadataBase: new URL("https://www.rivendy.com"),
  // Item K (audit) — Open Graph par défaut : tout partage d'une page sans
  // metadata propre (accueil, catégories…) affiche quand même une carte
  // complète. Les fiches produit/boutique gardent leur generateMetadata,
  // qui prend le dessus.
  openGraph: {
    siteName: "Rivendy",
    locale: "fr_FR",
    type: "website",
    title: "Rivendy — Marketplace",
    description:
      "Achetez, vendez et commandez des produits locaux en toute sécurité — Djibouti, Comores et 14 autres marchés.",
    images: [{ url: "/brand/hero-woman.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

// Item K — données structurées globales (Organization + WebSite). Injectées
// une seule fois à la racine ; les fiches produit portent leur JSON-LD
// Product propre. Pas de SearchAction : le site n'a pas de route /search.
const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Rivendy",
      url: "https://www.rivendy.com",
      logo: "https://www.rivendy.com/brand/hero-woman.png",
    },
    { "@type": "WebSite", name: "Rivendy", url: "https://www.rivendy.com" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          // Contenu 100 % statique défini ci-dessus — aucune donnée utilisateur.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
        />
        <Providers>
          <Suspense fallback={null}>
            <AppHeader />
          </Suspense>
          <main className="min-h-screen">{children}</main>
          <SiteFooter />
          <AppDownloadBanner />
        </Providers>
      </body>
    </html>
  );
}
