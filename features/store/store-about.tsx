import { Info, MapPin, CalendarDays, Tag, ShieldCheck } from "lucide-react";
import type { Country, Product, Profile } from "@/types/rivendy";
import { categoryLabel } from "@/lib/utils/format";
import { distinctCategories } from "@/features/store/store-helpers";

export function StoreAbout({
  seller,
  country,
  products,
  memberSince,
}: {
  seller: Profile;
  country: Country;
  products: Product[];
  memberSince: string | null;
}) {
  const cats = distinctCategories(products);
  const sellerName = seller.store_name || seller.full_name || "Cette boutique";

  return (
    <section id="a-propos" className="mt-12 scroll-mt-24 border-t border-slate-100 pt-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E0F2F1] text-[#009688]">
          <Info className="h-4 w-4" />
        </span>
        <h2 className="text-xl font-black text-slate-900">À propos de la boutique</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        {/* Description + fonctionnement */}
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          {seller.store_description ? (
            <p className="text-sm leading-relaxed text-slate-600">{seller.store_description}</p>
          ) : (
            <p className="text-sm text-slate-400">{sellerName} n&apos;a pas encore ajouté de description.</p>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-50 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" />
            <p className="text-xs leading-relaxed text-slate-500">
              Toutes les commandes et paiements passent par Rivendy. Vous ne payez jamais le vendeur
              directement : Rivendy sécurise la transaction et coordonne la livraison jusqu&apos;à la
              remise de votre commande.
            </p>
          </div>
        </div>

        {/* Infos clés */}
        <div className="space-y-2.5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 text-slate-400" />
            {country.name}
          </div>
          {memberSince && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              Ouverte depuis {memberSince}
            </div>
          )}
          {cats.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex flex-wrap gap-1.5">
                {cats.slice(0, 6).map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                  >
                    {categoryLabel(c)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
