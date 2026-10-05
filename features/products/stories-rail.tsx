"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { isSeen, loadSeen, markSeen } from "./story-seen-store";
import { firstPhoto } from "@/lib/utils/format";
import type { Product } from "@/types/rivendy";
import { StoryViewer, type SellerStory } from "./story-viewer";

/** Regroupe les produits-stories par vendeur (ordre d'apparition conservé). */
function groupStories(products: Product[], excludeSellerId?: string | null): SellerStory[] {
  const map = new Map<string, SellerStory>();
  for (const p of products) {
    if (!p.seller_id) continue;
    if (excludeSellerId && p.seller_id === excludeSellerId) continue;
    const existing = map.get(p.seller_id);
    if (existing) {
      existing.products.push(p);
    } else {
      map.set(p.seller_id, {
        sellerId: p.seller_id,
        sellerName: p.seller_name ?? "Boutique",
        sellerAvatar: p.seller_avatar_url ?? firstPhoto(p),
        sellerCertified: p.seller_is_certified === true,
        products: [p],
      });
    }
  }
  return Array.from(map.values());
}

interface StoriesRailProps {
  products: Product[];
  excludeSellerId?: string | null;
  limit?: number;
  /** "sidebar" = anneaux compacts (58px), "strip" = anneaux moyens (66px). */
  variant?: "sidebar" | "strip";
  className?: string;
}

/**
 * Rail d'anneaux de stories cliquables → ouvre `StoryViewer` plein écran.
 * Remplace l'ancien `story-strip` (qui ne faisait que rediriger vers la boutique).
 */
export function StoriesRail({
  products,
  excludeSellerId,
  limit,
  variant = "strip",
  className,
}: StoriesRailProps) {
  const stories = useMemo(
    () => {
      const grouped = groupStories(products, excludeSellerId);
      return limit ? grouped.slice(0, limit) : grouped;
    },
    [products, excludeSellerId, limit],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Stories déjà vues (stockage local, comme l'app) : lues après le montage
  // pour que le rendu serveur et le premier rendu client coïncident.
  const [seen, setSeen] = useState<Record<string, string>>({});
  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  if (stories.length === 0) return null;

  const ring = variant === "sidebar" ? "h-[58px] w-[58px]" : "h-[66px] w-[66px]";
  const width = variant === "sidebar" ? "w-[62px]" : "w-[70px]";
  const label = variant === "sidebar" ? "text-[10px]" : "text-[11px]";

  return (
    <>
      <div className={className ?? "no-scrollbar flex gap-3 overflow-x-auto pb-1"}>
        {stories.map((story, i) => (
          <button
            key={story.sellerId}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={`flex ${width} shrink-0 flex-col items-center gap-1.5`}
          >
            {/* Anneau dégradé (identique à l'app Flutter) — gris une fois vu */}
            <span
              className={`relative flex ${ring} items-center justify-center rounded-full p-[2.5px] ${
                isSeen(seen, story.sellerId, story.products)
                  ? "bg-slate-300"
                  : "bg-gradient-to-br from-[#00C4B4] via-[#007168] to-[#6A5ACD]"
              }`}
            >
              <span className="relative block h-full w-full overflow-hidden rounded-full bg-white p-[2.5px]">
                <Image
                  src={story.sellerAvatar ?? firstPhoto(story.products[0])}
                  alt={story.sellerName}
                  fill
                  sizes="66px"
                  className="rounded-full object-cover"
                />
              </span>
              {story.sellerCertified && (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-white">
                  <BadgeCheck className="h-4 w-4 fill-amber-400 text-white" />
                </span>
              )}
            </span>
            <span
              className={`${label} w-full truncate text-center font-semibold leading-tight text-slate-600`}
            >
              {story.sellerName}
            </span>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <StoryViewer
          stories={stories}
          initialIndex={openIndex}
          onSellerViewed={(story) => setSeen(markSeen(story.sellerId, story.products))}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
