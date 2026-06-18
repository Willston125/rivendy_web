"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Advertisement } from "@/types/rivendy";

import { hrefForAd, isExternalAd } from "./ad-link";
import { trackAdView, trackAdClick } from "./track";

export function AdBanner({ ads }: { ads: Advertisement[] }) {
  const ad = ads[0];

  // Compte une vue au montage (bannière toujours visible, pas de rotation).
  useEffect(() => {
    if (ad?.image_url) trackAdView(ad.id);
  }, [ad?.id, ad?.image_url]);

  if (!ad?.image_url) return null;
  const onClick = () => trackAdClick(ad.id);

  // Affiche pleine image, couleurs d'origine — aucun overlay ni texte superposé.
  const content = (
    <div className="relative h-36 overflow-hidden rounded-2xl bg-slate-900 md:h-52">
      <Image
        src={ad.image_url}
        alt={ad.title}
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        className="object-cover"
      />
    </div>
  );

  if (isExternalAd(ad)) {
    return (
      <a href={hrefForAd(ad)} target="_blank" rel="noreferrer" onClick={onClick} className="block w-full transition hover:opacity-95">
        {content}
      </a>
    );
  }

  return (
    <Link href={hrefForAd(ad)} onClick={onClick} className="block w-full transition hover:opacity-95">
      {content}
    </Link>
  );
}
