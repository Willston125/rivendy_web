"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IMAGE_CATEGORY_LABELS } from "@/lib/hotels/labels";
import type { HotelImage, HotelImageCategory } from "@/lib/hotels/types";
import { HotelImg } from "./hotel-ui";

/**
 * Galerie de la fiche — miroir de `HotelGallery` : photo principale,
 * onglets par catégorie (seulement celles qui ont des photos), vignettes.
 * Sans photo : un bandeau de marque, jamais un grand carré gris.
 */
export function HotelGallery({ images, hotelName }: { images: HotelImage[]; hotelName: string }) {
  const ordered = useMemo(() => {
    const cover = images.find((i) => i.isCover);
    return cover ? [cover, ...images.filter((i) => i.id !== cover.id)] : images;
  }, [images]);
  const categories = useMemo(() => {
    const seen = new Set<HotelImageCategory>();
    for (const img of ordered) seen.add(img.category);
    return Array.from(seen);
  }, [ordered]);

  const [category, setCategory] = useState<HotelImageCategory | "all">("all");
  const [index, setIndex] = useState(0);
  const visible = category === "all" ? ordered : ordered.filter((i) => i.category === category);
  const current = visible[Math.min(index, Math.max(0, visible.length - 1))];

  if (ordered.length === 0) {
    return <HotelImg src="" alt={hotelName} className="h-56 w-full rounded-3xl sm:h-80" />;
  }

  const step = (delta: number) => setIndex((i) => (i + delta + visible.length) % visible.length);

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-slate-100">
        <HotelImg src={current?.url ?? ""} alt={`${hotelName} — photo ${index + 1} sur ${visible.length}`} className="h-64 w-full sm:h-96" />
        {visible.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Photo précédente"
              onClick={() => step(-1)}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Photo suivante"
              onClick={() => step(1)}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
          <Images className="h-3.5 w-3.5" aria-hidden /> {Math.min(index, visible.length - 1) + 1}/{visible.length}
        </span>
      </div>

      {categories.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Catégories de photos">
          {(["all", ...categories] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => {
                setCategory(c);
                setIndex(0);
              }}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-xs font-bold",
                category === c ? "border-[#009688] bg-[#009688] text-white" : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {c === "all" ? `Tout (${ordered.length})` : IMAGE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {visible.map((img, i) => (
            <button
              key={img.id || img.url}
              type="button"
              aria-label={`Afficher la photo ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2",
                i === index ? "border-[#009688]" : "border-transparent opacity-80 hover:opacity-100",
              )}
            >
              <HotelImg src={img.url} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
