"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Advertisement } from "@/types/rivendy";
import { hrefForAd, isExternalAd } from "./ad-link";
import { trackAdView, trackAdClick } from "./track";

/**
 * Bannière publicitaire de l'onglet Restaurant (position web_restaurant_banner).
 * Remplace la bannière « Faim maintenant ? » par l'affiche du dashboard, en
 * plein cadre (~2.7:1). Vue + clic trackés. Un vendeur restaurant (link_type
 * « store ») ouvre directement son menu food-app /restaurant/[id].
 */
export function RestaurantBannerAd({ ad }: { ad: Advertisement }) {
  useEffect(() => {
    trackAdView(ad.id);
  }, [ad.id]);

  // Pour une bannière Restaurant, un lien « store » ouvre le menu food-app.
  const href =
    ad.link_type === "store" && ad.link_value
      ? `/restaurant/${ad.link_value}`
      : ad.link_type === "none"
        ? "/?category=restaurant"
        : hrefForAd(ad);
  const external = isExternalAd(ad);
  const onClick = () => trackAdClick(ad.id);

  const inner = (
    <div className="group relative aspect-[1600/600] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-sm transition hover:shadow-md">
      <Image
        src={ad.image_url}
        alt={ad.title}
        fill
        sizes="(max-width: 680px) 100vw, 680px"
        priority
        className="object-cover transition duration-300 group-hover:scale-[1.03]"
      />
      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
        Sponsorisé
      </span>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className="mb-4 block">
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} className="mb-4 block">
      {inner}
    </Link>
  );
}
