import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/app/providers";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";

export const metadata: Metadata = {
  title: {
    default: "Rivendy — Marketplace Djibouti",
    template: "%s | Rivendy",
  },
  description:
    "Rivendy est la marketplace #1 à Djibouti. Achetez, vendez et commandez des produits locaux en toute sécurité.",
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
          <main className="min-h-screen pb-24 md:pb-0">{children}</main>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
