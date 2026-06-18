"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Advertisement } from "@/types/rivendy";
import { hrefForAd, isExternalAd } from "./ad-link";
import { trackAdView, trackAdClick } from "./track";

/**
 * Carte pub inline — même format visuel que ProductCard (carré 1:1 + zone texte).
 * Position `web_feed_inline` — insérée comme cellule dans la grille produits.
 * Badge « Sponsorisé » discret + CTA « Voir l'offre » teal.
 */
export function AdCardInline({ ad }: { ad: Advertisement }) {
  useEffect(() => {
    trackAdView(ad.id);
  }, [ad.id]);

  const onClick = () => trackAdClick(ad.id);

  const inner = (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
      {/* Image carrée 1:1 — même ratio que ProductCard */}
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <Image
          src={ad.image_url}
          alt={ad.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        {/* Badge Sponsorisé — haut gauche (comme NOUVEAU/BOOST sur ProductCard) */}
        <span className="absolute left-2 top-2 rounded-md bg-[#1A1A1A]/80 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
          Sponsorisé
        </span>
      </div>

      {/* Zone texte — même padding que ProductCard */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-[#1A1A1A]">
          {ad.title}
        </p>
        <p className="text-[15px] font-black text-[#009688]">Voir l&apos;offre →</p>
      </div>
    </article>
  );

  if (ad.link_type === "none") {
    return <div className="cursor-default" onClick={onClick}>{inner}</div>;
  }

  if (isExternalAd(ad)) {
    return (
      <a href={hrefForAd(ad)} target="_blank" rel="noreferrer" onClick={onClick}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={hrefForAd(ad)} onClick={onClick}>
      {inner}
    </Link>
  );
}
