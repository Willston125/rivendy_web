import Image from "next/image";
import Link from "next/link";
import { firstPhoto } from "@/lib/utils/format";
import type { Product } from "@/types/rivendy";

/** Un produit par vendeur (le plus récent) */
function groupBySeller(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (seen.has(p.seller_id)) return false;
    seen.add(p.seller_id);
    return true;
  });
}

export function StoryStrip({ products }: { products: Product[] }) {
  if (!products.length) return null;
  const grouped = groupBySeller(products);

  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
      {grouped.map((product) => (
        <Link
          key={product.seller_id}
          href={`/store/${product.seller_id}`}
          className="flex w-[70px] shrink-0 flex-col items-center gap-1.5"
        >
          {/* Anneau dégradé identique au Flutter app */}
          <span className="relative flex h-[66px] w-[66px] items-center justify-center rounded-full bg-gradient-to-br from-[#00C4B4] via-[#007168] to-[#6A5ACD] p-[2.5px]">
            <span className="relative block h-full w-full overflow-hidden rounded-full bg-white p-[2.5px]">
              <Image
                src={product.seller_avatar_url ?? firstPhoto(product)}
                alt={product.seller_name ?? "Boutique"}
                fill
                sizes="56px"
                className="rounded-full object-cover"
              />
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] font-semibold leading-tight text-slate-600">
            {product.seller_name ?? "Boutique"}
          </span>
        </Link>
      ))}
    </div>
  );
}
