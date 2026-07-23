"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export function ProductGallery({ photos, title }: { photos: string[]; title: string }) {
  const safePhotos = photos.filter(Boolean).length ? photos.filter(Boolean) : ["/brand/rivendy-logo-square.png"];
  const [activeIdx, setActiveIdx] = useState(0);
  const active = safePhotos[activeIdx];

  function prev() { setActiveIdx((i) => (i === 0 ? safePhotos.length - 1 : i - 1)); }
  function next() { setActiveIdx((i) => (i === safePhotos.length - 1 ? 0 : i + 1)); }

  return (
    <div className="space-y-3">
      {/* Image principale */}
      <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={active}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-opacity duration-300"
          priority
        />

        {/* Flèches navigation (si plusieurs photos) */}
        {safePhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-white"
              aria-label="Photo précédente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-white"
              aria-label="Photo suivante"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Indicateur page */}
            <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {activeIdx + 1} / {safePhotos.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {safePhotos.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {safePhotos.map((photo, idx) => (
            <button
              key={photo}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`relative aspect-square overflow-hidden rounded-xl transition-all ${
                activeIdx === idx
                  ? "ring-2 ring-[#009688] ring-offset-1"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={photo} alt="" fill sizes="90px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
