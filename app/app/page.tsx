import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PLAY_LISTING_URL } from "@/lib/seo";
import { appPageTarget } from "@/features/app-download/app-download-logic";
import { AppDownloadView } from "@/features/app-download/app-download-view";

/**
 * www.rivendy.com/app — l'adresse du QR code « Télécharger Rivendy » (vidéos,
 * affiches, flyers ; 2026-11-14). Android part directement sur Google Play ;
 * iPhone, ordinateur et robots voient la page. Règle : `appPageTarget`.
 */
export const metadata: Metadata = {
  title: "Télécharger l'application Rivendy",
  description:
    "Téléchargez Rivendy sur Google Play : Marketplace, Musique et Play dans une seule application. Sur iPhone, Rivendy s'utilise sur le site.",
  alternates: { canonical: "/app" },
};

export default async function AppDownloadPage() {
  const target = appPageTarget((await headers()).get("user-agent"), PLAY_LISTING_URL);
  if (target.kind === "android") redirect(target.url);
  return <AppDownloadView ios={target.kind === "ios"} />;
}
