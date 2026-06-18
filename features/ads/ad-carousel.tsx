"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Advertisement } from "@/types/rivendy";
import { hrefForAd, isExternalAd } from "./ad-link";
import { trackAdView, trackAdClick } from "./track";

const AUTOPLAY_MS = 5000;

/**
 * Carrousel de bannières publicitaires (position web_home_banner / home_banner).
 *
 * - 1 affiche  → image simple (aucun contrôle)
 * - N affiches → rotation auto (5 s), pause au survol, swipe tactile,
 *   flèches ‹ › et points de navigation cliquables.
 *
 * Les affiches sont gérées dans le Dashboard Rivendy (table `advertisements`).
 * Palette stricte Rivendy : #009688 / #007168.
 */
export function AdCarousel({ ads }: { ads: Advertisement[] }) {
  const slides = useMemo(() => ads.filter((a) => a.image_url), [ads]);
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Rotation automatique (désactivée si une seule affiche ou survol).
  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  // Garde l'index valide si la liste change.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  // Compte une vue pour la diapo active (une seule fois par affiche / montage).
  useEffect(() => {
    const ad = slides[index];
    if (ad && !seen.current.has(ad.id)) {
      seen.current.add(ad.id);
      trackAdView(ad.id);
    }
  }, [slides, index]);

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
      className="relative"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Piste glissante */}
      <div className="overflow-hidden rounded-2xl bg-slate-900">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((ad, i) => (
            <AdSlide key={ad.id} ad={ad} priority={i === 0} onActivate={() => trackAdClick(ad.id)} />
          ))}
        </div>
      </div>

      {/* Flèches + points (seulement si plusieurs affiches) */}
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

/** Une diapo : image plein cadre + dégradé + titre, cliquable selon le type de lien. */
function AdSlide({ ad, priority, onActivate }: { ad: Advertisement; priority: boolean; onActivate: () => void }) {
  const content = (
    <div className="relative h-36 w-full overflow-hidden md:h-52">
      <Image
        src={ad.image_url}
        alt={ad.title}
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        className="object-cover"
        priority={priority}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/20 to-transparent" />
      <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-end p-5 text-white md:p-7">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Rivendy</p>
        <h2 className="mt-1 text-2xl font-black leading-tight md:text-3xl">{ad.title}</h2>
      </div>
    </div>
  );

  if (ad.link_type === "none") {
    return <div className="w-full shrink-0">{content}</div>;
  }

  if (isExternalAd(ad)) {
    return (
      <a
        href={hrefForAd(ad)}
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
    <Link href={hrefForAd(ad)} onClick={onActivate} className="block w-full shrink-0 transition hover:opacity-95">
      {content}
    </Link>
  );
}
