import Image from "next/image";
import Link from "next/link";
import type { Advertisement } from "@/types/rivendy";

import { CATEGORIES } from "@/types/rivendy";

function getCategoryId(value: string): string {
  const normalizedValue = value.toLowerCase().replace(/ & /g, "").replace(/ /g, "");
  const match = CATEGORIES.find(
    (c) =>
      c.id.toLowerCase() === normalizedValue ||
      c.label.toLowerCase().replace(/ & /g, "").replace(/ /g, "") === normalizedValue
  );
  return match ? match.id : value;
}

function hrefForAd(ad: Advertisement) {
  if (ad.link_type === "product" && ad.link_value) return `/products/${ad.link_value}`;
  if (ad.link_type === "store" && ad.link_value) return `/store/${ad.link_value}`;
  if (ad.link_type === "category" && ad.link_value) return `/?category=${getCategoryId(ad.link_value)}`;
  if (ad.link_type === "whatsapp" && ad.link_value) return `https://wa.me/${ad.link_value.replace(/\+/g, "")}`;
  if (ad.link_type === "external" && ad.link_value) return ad.link_value;
  return "/";
}

export function AdBanner({ ads }: { ads: Advertisement[] }) {
  const ad = ads[0];
  if (!ad?.image_url) return null;

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

  if (ad.link_type === "external") {
    return (
      <a href={hrefForAd(ad)} target="_blank" rel="noreferrer" className="block w-full transition hover:opacity-95">
        {content}
      </a>
    );
  }

  return (
    <Link href={hrefForAd(ad)} className="block w-full transition hover:opacity-95">
      {content}
    </Link>
  );
}
