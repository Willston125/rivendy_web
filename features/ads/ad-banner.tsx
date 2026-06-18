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

  const content = (
    <div className="relative h-36 overflow-hidden rounded-2xl bg-slate-900 md:h-52">
      <Image
        src={ad.image_url}
        alt={ad.title}
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/20 to-transparent" />
      <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-end p-5 text-white md:p-7">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Rivendy</p>
        <h2 className="mt-1 text-2xl font-black leading-tight md:text-3xl">{ad.title}</h2>
      </div>
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
