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
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>
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
