"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { useCountry } from "@/features/country/country-provider";
import { marketHomePath } from "@/lib/seo";
import { cn } from "@/lib/utils/cn";

/**
 * Signature de Rivendy Play : le logo officiel de Rivendy, puis « PLAY ▶ »
 * dans le vert de Play — la même marque, l'expression du cinéma.
 */

/** Logo officiel, proportions d'origine, passé en blanc sur le fond sombre (comme l'app). */
export function Wordmark({ className }: { className?: string }) {
  // Taille d'affichage (≈ 32 px de haut) : sinon l'optimiseur servait la version 3840 px.
  // 90 × 32 : les proportions exactes du fichier (91 faisait signaler une image déformée).
  return <Image src="/brand/rivendy-wordmark.png" alt="" width={90} height={32} priority className={cn("w-auto brightness-0 invert", className)} />;
}

/** « PLAY ▶ » (ou « RIVENDY PLAY ▶ »), en capitales très espacées. */
export function PlayMark({ className, prefix }: { className?: string; prefix?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 font-extrabold uppercase text-rvp-accent", className)}>
      {prefix ? `${prefix} Play` : "Play"} <Play className="h-[0.85em] w-[0.85em] fill-current" aria-hidden />
    </span>
  );
}

/** Accueil de la marketplace dans le pays choisi (le logo y ramène). */
export function useHomeHref(): string {
  const { country } = useCountry();
  return country?.id ? marketHomePath(country.id) : "/";
}
