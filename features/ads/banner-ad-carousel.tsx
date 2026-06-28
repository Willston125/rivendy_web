"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Advertisement } from "@/types/rivendy";
import { hrefForAd, isExternalAd } from "./ad-link";
import { trackAdView, trackAdClick } from "./track";

// Aligné sur le carrousel d'accueil de l'app (4 s).
const AUTOPLAY_MS = 4000;

/**
 * Carrousel de bannière publicitaire réutilisable (format ~2.7:1).
 * Utilisé par l'onglet Restaurant (web_restaurant_banner) et l'onglet
 * Sur commande (web_preorder_banner).
 *
 * - 1 affiche  → image simple
 * - N affiches → rotation auto (4 s), pause au survol, swipe tactile,
 *   flèches ‹ › et points cliquables. Vue dédupliquée par affiche.
 *
 * `storeOpensRestaurant` : si vrai, un lien « store » ouvre le menu
 * food-app /restaurant/[id] (onglet Restaurant) ; sinon la boutique
 * générique via hrefForAd (/store/[id]).
 */
export function BannerAdCarousel({
  ads,
  storeOpensRestaurant = false,
  fallbackHref = "/",
}: {
  ads: Advertisement[];
  storeOpensRestaurant?: boolean;
  fallbackHref?: string;
}) {
  const slides = useMemo(() => ads.filter((a) => a.image_url), [ads]);
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    const ad = slides[index];
    if (ad && !seen.current.has(ad.id)) {
      seen.current.add(ad.id);
      trackAdView(ad.id);
    }
  }, [slides, index]);

  const hrefFor = useCallback(
    (ad: Advertisement): string => {
      if (storeOpensRestaurant && ad.link_type === "store" && ad.link_value)
        return `/restaurant/${ad.link_value}`;
      if (ad.link_type === "none") return fallbackHref;
      return hrefForAd(ad);
    },
    [storeOpensRestaurant, fallbackHref],
  );

  if (count === 0) return null;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchStartX.current = null;
  }

  return (
    <section
      className="relative mb-4"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="overflow-hidden rounded-2xl bg-slate-900">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((ad) => (
            <BannerSlide
              key={ad.id}
              ad={ad}
              href={hrefFor(ad)}
              external={isExternalAd(ad)}
              onActivate={() => trackAdClick(ad.id)}
            />
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Affiche précédente"
            onClick={prev}
            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-900 shadow-md backdrop-blur transition hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Affiche suivante"
            onClick={next}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-900 shadow-md backdrop-blur transition hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {slides.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                aria-label={`Aller à l'affiche ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={
                  i === index
                    ? "h-2 w-6 rounded-full bg-white transition-all"
                    : "h-2 w-2 rounded-full bg-white/55 transition-all hover:bg-white/80"
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BannerSlide({
  ad,
  href,
  external,
  onActivate,
}: {
  ad: Advertisement;
  href: string;
  external: boolean;
  onActivate: () => void;
}) {
  const content = (
    <div className="relative aspect-[1600/600] w-full overflow-hidden">
      <Image
        src={ad.image_url}
        alt={ad.title}
        fill
        sizes="(max-width: 680px) 100vw, 680px"
        className="object-cover"
        priority
      />
      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
        Sponsorisé
      </span>
    </div>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onActivate}
        className="block w-full shrink-0 transition hover:opacity-95"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onActivate} className="block w-full shrink-0 transition hover:opacity-95">
      {content}
    </Link>
  );
}
