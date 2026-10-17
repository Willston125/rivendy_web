import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { BadgeCheck, Store } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { createAnonServerClient } from "@/lib/supabase/server";
import { clip, HOME_MARKET_ID, marketHomePath, marketPitch, storesPath } from "@/lib/seo";
import { inMarket } from "@/lib/utils/market-phrase";
import { usableImageUrl } from "@/lib/utils/image-url";
import { getCountry } from "@/services/public-data";
import { CATEGORIES } from "@/types/rivendy";

/**
 * Annuaire des boutiques d'un marché (référencement, 2026-10-13).
 * Vise « boutique Moroni » / « boutiques en ligne Comores » et donne à Google
 * un lien vers CHAQUE boutique. Source : la vue publique `visible_products`
 * (mêmes règles de visibilité que le catalogue) ; une boutique sans article
 * visible n'apparaît pas.
 */

type SearchParams = Promise<{ country?: string }>;

type StoreEntry = {
  sellerId: string;
  name: string;
  avatar: string | null;
  certified: boolean;
  count: number;
  category: string;
};

/** Page d'un établissement selon son métier — mêmes routes que les cartes. */
const ESTABLISHMENT_ROUTE: Record<string, string> = {
  restaurant: "/restaurant",
  hotel: "/hotel",
  pharmacie: "/pharmacy",
  materiauxConstruction: "/construction",
};

const supabaseImage = (url: string) => (/^https:\/\/[a-z0-9]+\.supabase\.co\//i.test(url) ? url : null);

const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Boutique";

/** Audit 17 (WEB-16) : relu au plus toutes les 5 minutes par marché (c'était
 *  à chaque visite, jusqu'à 5 000 lignes). */
const getMarketStores = unstable_cache(readMarketStores, ["market-stores"], { revalidate: 300 });

async function readMarketStores(countryId: string): Promise<StoreEntry[]> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("visible_products")
    .select("seller_id, seller_name, seller_avatar_url, seller_is_certified, category")
    .eq("country_id", countryId)
    .limit(5000);
  if (error || !data) return [];

  const bySeller = new Map<string, StoreEntry & { perCategory: Map<string, number> }>();
  for (const row of data) {
    const id = row.seller_id as string | null;
    if (!id) continue;
    const entry =
      bySeller.get(id) ??
      {
        sellerId: id,
        name: (row.seller_name as string | null)?.trim() || "Boutique Rivendy",
        // next/image n'accepte que l'hôte Supabase (next.config.ts) : un
        // avatar hébergé ailleurs ferait échouer la page entière.
        avatar: supabaseImage(usableImageUrl(row.seller_avatar_url as string | null)),
        certified: Boolean(row.seller_is_certified),
        count: 0,
        category: "",
        perCategory: new Map<string, number>(),
      };
    entry.count += 1;
    const cat = String(row.category ?? "");
    entry.perCategory.set(cat, (entry.perCategory.get(cat) ?? 0) + 1);
    bySeller.set(id, entry);
  }

  return [...bySeller.values()]
    .map(({ perCategory, ...e }) => ({
      ...e,
      category: [...perCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
    }))
    .sort((a, b) => Number(b.certified) - Number(a.certified) || b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

function storeHref(s: StoreEntry) {
  return `${ESTABLISHMENT_ROUTE[s.category] ?? "/store"}/${s.sellerId}`;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { country: requested } = await searchParams;
  const country = await getCountry(requested || HOME_MARKET_ID);
  const where = inMarket(country);
  const title =
    country.id === "KM"
      ? "Boutiques en ligne à Moroni et aux Comores — Rivendy"
      : `Boutiques en ligne ${where} — Rivendy`;
  return {
    title,
    description: clip(
      `Toutes les ${marketPitch(country).places} présentes sur Rivendy : mode, beauté, électronique, restaurants, pharmacies. Commandez en ligne, ${marketPitch(country).delivery}.`,
    ),
    alternates: { canonical: storesPath(country.id) },
  };
}

export default async function StoresDirectoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { country: requested } = await searchParams;
  const country = await getCountry(requested || HOME_MARKET_ID);
  const where = inMarket(country);
  const stores = await getMarketStores(country.id);
  const heading = country.id === "KM" ? "Boutiques en ligne à Moroni et aux Comores" : `Boutiques en ligne ${where}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
      <Breadcrumbs items={[{ label: "Accueil", href: marketHomePath(country.id) }, { label: "Boutiques" }]} />

      <header className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 md:text-3xl">{heading}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
          Découvrez les {marketPitch(country).places} qui vendent sur Rivendy. Chaque commande est
          centralisée et suivie par Rivendy, avec {marketPitch(country).delivery}.
        </p>
      </header>

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Store className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Aucune boutique n&apos;est encore en ligne {where}.
          </p>
          <Link
            href="/vendre-en-ligne"
            className="mt-4 inline-block rounded-full bg-[#009688] px-5 py-2 text-sm font-bold text-white hover:bg-[#007168]"
          >
            Ouvrir la première boutique
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <li key={s.sellerId}>
              <Link
                href={storeHref(s)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-[#009688]"
              >
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E0F2F1]">
                  {s.avatar ? (
                    <Image src={s.avatar} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <Store className="h-5 w-5 text-[#009688]" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-bold text-slate-900">
                    <span className="truncate">{s.name}</span>
                    {s.certified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#009688]" aria-label="Vendeur certifié" />}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {categoryLabel(s.category)} · {s.count} article{s.count > 1 ? "s" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 rounded-2xl bg-slate-50 p-5 md:p-6">
        <h2 className="text-lg font-black text-slate-900">Vous avez une boutique {where} ?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vendez en ligne sur Rivendy : vous fixez votre prix, Rivendy s&apos;occupe des commandes et du suivi.
        </p>
        <Link href="/vendre-en-ligne" className="mt-3 inline-block text-sm font-bold text-[#009688] hover:text-[#007168]">
          Vendre en ligne avec Rivendy →
        </Link>
      </section>
    </div>
  );
}
