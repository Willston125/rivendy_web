import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/app/providers";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Rivendy — Marketplace",
    template: "%s | Rivendy",
  },
  description:
    "Rivendy est la marketplace multi-marchés africaine. Achetez, vendez et commandez des produits locaux en toute sécurité.",
  metadataBase: new URL("https://rivendy.com"),
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
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
