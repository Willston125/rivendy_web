"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Advertisement } from "@/types/rivendy";
import { hrefForAd, isExternalAd } from "./ad-link";
import { trackAdView, trackAdClick } from "./track";

/**
 * Carte « slot promo » de l'accueil web (Offres exclusives / Sur commande).
 * Affiche l'image dashboard en plein cadre (h-120) à la place de la carte en
 * dur. Lien configurable ; si le type est « aucun », on retombe sur la
 * destination naturelle du slot (`fallbackHref`). Vue + clic trackés.
 *
 * Le rendu est volontairement « image pleine » (couleurs d'origine, sans
 * overlay) : l'affiche promo porte elle-même son message — cohérent avec le
 * reste du système pub Rivendy.
 */
export function PromoSlotCard({
  ad,
  fallbackHref,
}: {
  ad: Advertisement;
  fallbackHref: string;
}) {
  useEffect(() => {
    trackAdView(ad.id);
  }, [ad.id]);

  const href = ad.link_type === "none" ? fallbackHref : hrefForAd(ad);
  const external = isExternalAd(ad);
  const onClick = () => trackAdClick(ad.id);

  const inner = (
    <div className="group relative h-[120px] overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-sm transition hover:shadow-md">
      <Image
        src={ad.image_url}
        alt={ad.title}
        fill
        sizes="(max-width: 640px) 100vw, 420px"
        className="object-cover transition duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className="block">
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} className="block">
      {inner}
    </Link>
  );
}
