"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useState } from "react";

import { ProductVideoPlayer, streamThumbnail } from "./product-video-player";

/** Galerie fiche produit. Si le produit a une vidéo `ready`, elle devient le
 *  PREMIER média (parité app Flutter, plan D) — lecture au clic, jamais
 *  d'autoplay. Sans vidéo, comportement photo strictement identique. */
export function ProductGallery({
  photos,
  title,
  videoUid,
  videoStatus,
  videoThumbnail,
}: {
  photos: string[];
  title: string;
  videoUid?: string | null;
  videoStatus?: string | null;
  videoThumbnail?: string | null;
}) {
  const safePhotos = photos.filter(Boolean).length ? photos.filter(Boolean) : ["/brand/rivendy-logo-square.png"];
  const hasVideo = Boolean(videoUid) && videoStatus === "ready";
  const mediaCount = safePhotos.length + (hasVideo ? 1 : 0);
  const [activeIdx, setActiveIdx] = useState(0);

  const showVideo = hasVideo && activeIdx === 0;
  const photoIdx = hasVideo ? activeIdx - 1 : activeIdx;
  const active = safePhotos[Math.max(0, photoIdx)];
  const videoPoster = hasVideo ? (videoThumbnail || streamThumbnail(videoUid as string, 180)) : "";

  function prev() { setActiveIdx((i) => (i === 0 ? mediaCount - 1 : i - 1)); }
  function next() { setActiveIdx((i) => (i === mediaCount - 1 ? 0 : i + 1)); }

  return (
    <div className="space-y-3">
      {/* Média principal */}
      <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
        {showVideo ? (
          <ProductVideoPlayer
            uid={videoUid as string}
            thumbnail={videoThumbnail}
            title={title}
          />
        ) : (
          <Image
            src={active}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-opacity duration-300"
            priority
          />
        )}

        {/* Flèches navigation (si plusieurs médias) */}
        {mediaCount > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-white"
              aria-label="Média précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-white"
              aria-label="Média suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Indicateur page */}
            <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {activeIdx + 1} / {mediaCount}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {mediaCount > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {hasVideo && (
            <button
              type="button"
              onClick={() => setActiveIdx(0)}
              className={`relative aspect-square overflow-hidden rounded-xl bg-black transition-all ${
                activeIdx === 0
                  ? "ring-2 ring-[#009688] ring-offset-1"
                  : "opacity-60 hover:opacity-100"
              }`}
              aria-label="Vidéo du produit"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={videoPoster} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <Play className="h-5 w-5 fill-white text-white drop-shadow" />
              </span>
            </button>
          )}
          {safePhotos.map((photo, idx) => {
            const mediaIdx = hasVideo ? idx + 1 : idx;
            return (
              <button
                key={photo}
                type="button"
                onClick={() => setActiveIdx(mediaIdx)}
                className={`relative aspect-square overflow-hidden rounded-xl transition-all ${
                  activeIdx === mediaIdx
                    ? "ring-2 ring-[#009688] ring-offset-1"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={photo} alt="" fill sizes="90px" className="object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
