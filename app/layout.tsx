import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./site.css";
import { Providers } from "@/app/providers";
import { AppHeader } from "@/components/layout/app-header";
import { HideInPlay } from "@/components/layout/hide-in-play";
import { HideInMusic } from "@/components/layout/hide-in-music";
import { SiteFooter } from "@/components/layout/site-footer";
import { AppDownloadBanner } from "@/features/app-banner/app-download-banner";
import { PLAY_LISTING_URL, safeJsonLd, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  // Pas de modèle « %s | Rivendy » : chaque page nomme déjà Rivendy dans son
  // titre, et le modèle donnait « Connexion — Rivendy | Rivendy ».
  title: "Rivendy — Vendre et acheter en ligne aux Comores et à Djibouti",
  description:
    "Rivendy est la marketplace des Comores, de Djibouti et de 14 autres marchés. Achetez, vendez et commandez des produits locaux en toute sécurité.",
  metadataBase: new URL(SITE_URL),
  // Vérification Google Search Console (méthode « balise HTML ») : renseigner
  // GOOGLE_SITE_VERIFICATION sur Vercel puis redéployer. Inutile si le
  // domaine est vérifié par un enregistrement DNS.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
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
    images: [{ url: "/brand/og-rivendy.jpg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

// Item K — données structurées globales (Organization + WebSite). Injectées
// une seule fois à la racine ; les fiches produit portent leur JSON-LD
// Product propre. Le logo est le vrai logo carré (Google l'affiche dans le
// panneau de marque) ; `sameAs` relie le site à la fiche Google Play.
const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Rivendy",
      url: SITE_URL,
      logo: `${SITE_URL}/brand/rivendy-logo-square.png`,
      description: "Marketplace pour vendre et acheter en ligne aux Comores, à Djibouti et dans 14 autres marchés.",
      areaServed: ["Comores", "Djibouti"],
      sameAs: [PLAY_LISTING_URL],
    },
    {
      "@type": "WebSite",
      name: "Rivendy",
      url: SITE_URL,
      inLanguage: "fr",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "MobileApplication",
      name: "Rivendy",
      operatingSystem: "ANDROID",
      applicationCategory: "ShoppingApplication",
      installUrl: PLAY_LISTING_URL,
      offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          // Contenu 100 % statique défini ci-dessus — aucune donnée utilisateur.
          dangerouslySetInnerHTML={{ __html: safeJsonLd(SITE_JSONLD) }}
        />
        <Providers>
          {/* Rivendy Play a son en-tête et son pied de page sombres (refonte du 2026-10-22) ;
              la Musique est une application plein écran avec sa propre barre (même jour). */}
          <Suspense fallback={null}>
            <HideInPlay>
              <HideInMusic>
                <AppHeader />
              </HideInMusic>
            </HideInPlay>
          </Suspense>
          <main className="min-h-screen">{children}</main>
          <HideInPlay>
            <HideInMusic>
              <SiteFooter />
            </HideInMusic>
          </HideInPlay>
          <HideInMusic>
            <AppDownloadBanner />
          </HideInMusic>
        </Providers>
      </body>
    </html>
  );
}
