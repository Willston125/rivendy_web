"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Hotel as HotelIcon, WifiOff } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useCountry, useCountryOrDefault } from "@/features/country/country-provider";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { getMarketDestinations, sortListings } from "@/lib/hotels/catalog";
import { addDaysSql, parseSqlDate } from "@/lib/hotels/dates";
import {
  EMPTY_SEARCH,
  activeFilterCount,
  clearedFilters,
  hotelHref,
  resultsHref,
  type HotelSearchQuery,
} from "@/lib/hotels/search-params";
import { HotelSearchForm, useTodaySql, type StayFormValue } from "./hotel-search-form";
import { HotelListingCard } from "./hotel-listing-card";
import { CardSkeletons, HotelImg, StateBlock } from "./hotel-ui";
import { useHotelFavorites } from "./use-hotel-favorites";
import { useHotelSearch } from "./use-hotel-search";

const HOME_LIMIT = 9;

/** Prochain samedi ; si l'on est samedi, celui de la semaine suivante (miroir app). */
function nextSaturday(today: string): string {
  const d = parseSqlDate(today)!;
  const days = (6 - d.getDay() + 7) % 7;
  return addDaysSql(today, days === 0 ? 7 : days);
}

/**
 * 🏨 ACCUEIL HÔTELS — miroir de `HotelHomeScreen`.
 *
 * ⚠️ AUCUNE DONNÉE FICTIVE : les destinations viennent des villes des hôtels
 * réellement publiés sur le marché. Un marché sans hôtel affiche un état
 * vide honnête plutôt que des villes en décor.
 */
export function HotelsHome() {
  const router = useRouter();
  const country = useCountryOrDefault();
  const { loading: countryLoading } = useCountry();
  const today = useTodaySql();
  const favorites = useHotelFavorites();

  const [form, setForm] = useState<StayFormValue>({
    destination: "",
    checkIn: null,
    checkOut: null,
    rooms: EMPTY_SEARCH.rooms,
    adults: EMPTY_SEARCH.adults,
    children: EMPTY_SEARCH.children,
  });
  // Critères APPLIQUÉS à la découverte (les raccourcis agissent dessus tout de suite).
  const [discovery, setDiscovery] = useState<HotelSearchQuery>(EMPTY_SEARCH);

  const search = useHotelSearch(discovery, country?.id ?? null);
  const listings = useMemo(() => sortListings(search.results, "recommended").slice(0, HOME_LIMIT), [search.results]);

  const [destinations, setDestinations] = useState<{ city: string; count: number; cover: string }[]>([]);
  useEffect(() => {
    if (!country?.id) return;
    let cancelled = false;
    getMarketDestinations(supabase, country.id)
      .then((d) => {
        if (!cancelled) setDestinations(d);
      })
      .catch(() => {
        if (!cancelled) setDestinations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [country?.id]);

  function applyDates(checkIn: string, checkOut: string) {
    setForm((f) => ({ ...f, checkIn, checkOut }));
    setDiscovery((q) => ({ ...q, checkIn, checkOut }));
  }

  function toggleAmenity(code: string) {
    setDiscovery((q) => ({
      ...q,
      amenities: q.amenities.includes(code) ? q.amenities.filter((c) => c !== code) : [...q.amenities, code],
    }));
  }

  function pickDestination(city: string) {
    setForm((f) => ({ ...f, destination: city }));
    setDiscovery((q) => ({ ...q, destination: city }));
  }

  const saturday = today ? nextSaturday(today) : null;
  const chips: { label: string; active: boolean; onClick: () => void }[] = today && saturday
    ? [
        { label: "Ce soir", active: discovery.checkIn === today, onClick: () => applyDates(today, addDaysSql(today, 1)) },
        { label: "Ce week-end", active: discovery.checkIn === saturday, onClick: () => applyDates(saturday, addDaysSql(saturday, 2)) },
        { label: "Vue mer", active: discovery.amenities.includes("vue_mer"), onClick: () => toggleAmenity("vue_mer") },
        { label: "Piscine", active: discovery.amenities.includes("piscine"), onClick: () => toggleAmenity("piscine") },
        { label: "Petit-déjeuner", active: discovery.amenities.includes("petit_dejeuner"), onClick: () => toggleAmenity("petit_dejeuner") },
      ]
    : [];

  const hasDates = !!(discovery.checkIn && discovery.checkOut);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Hôtels" }]} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Hôtels</h1>
          <p className="mt-1 text-sm text-slate-500">
            Trouvez votre prochain séjour{country ? ` — ${country.name}` : ""}. Réservation ferme, confirmée par Rivendy.
          </p>
        </div>
        <Link href="/hotels/bookings" className="inline-flex items-center gap-2 text-sm font-bold text-[#009688] hover:underline">
          <CalendarCheck className="h-4 w-4" aria-hidden /> Mes réservations
        </Link>
      </div>

      <HotelSearchForm
        value={form}
        onChange={setForm}
        onSubmit={(v) => router.push(resultsHref({ ...discovery, ...v }))}
      />

      {chips.length ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Raccourcis">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={c.active}
              onClick={c.onClick}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition",
                c.active ? "border-[#009688] bg-[#009688] text-white" : "border-slate-200 bg-white text-slate-800 hover:border-[#009688]",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      {destinations.length ? (
        <section className="mt-8" aria-labelledby="hotel-destinations">
          <h2 id="hotel-destinations" className="text-xl font-black text-slate-950">Destinations populaires</h2>
          <p className="text-sm text-slate-500">Là où se trouvent nos établissements</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {destinations.map((d) => (
              <button
                key={d.city}
                type="button"
                onClick={() => pickDestination(d.city)}
                aria-label={`${d.city}, ${d.count} hôtel${d.count > 1 ? "s" : ""}`}
                className={cn(
                  "relative h-32 w-40 shrink-0 overflow-hidden rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]",
                  discovery.destination === d.city && "ring-2 ring-[#009688]",
                )}
              >
                <HotelImg src={d.cover} alt="" className="absolute inset-0 h-full w-full" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
                <span className="absolute bottom-3 left-3 right-3">
                  <span className="block truncate text-sm font-black text-white">{d.city}</span>
                  <span className="block text-[11px] font-semibold text-white/80">
                    {d.count} hôtel{d.count > 1 ? "s" : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="hotel-reco" aria-live="polite">
        {countryLoading || !country || search.status === "loading" ? (
          <>
            <h2 id="hotel-reco" className="mb-3 text-xl font-black text-slate-950">Hôtels recommandés</h2>
            <CardSkeletons count={3} />
          </>
        ) : search.status === "error" ? (
          <StateBlock
            icon={WifiOff}
            tone="error"
            title="Connexion interrompue"
            message="La recherche n'a pas abouti. Vérifiez votre connexion et réessayez."
            action={{ label: "Réessayer", onClick: search.retry }}
          />
        ) : search.status === "empty" ? (
          <StateBlock
            icon={HotelIcon}
            title={hasDates ? "Aucun hôtel disponible pour ces dates" : "Aucun hôtel pour le moment"}
            message={
              hasDates
                ? "Essayez de modifier vos dates ou votre destination."
                : "De nouveaux établissements arrivent bientôt sur ce marché."
            }
            action={
              activeFilterCount(discovery) > 0 || discovery.destination
                ? { label: "Effacer les filtres", onClick: () => { setDiscovery(clearedFilters({ ...discovery, destination: "" })); setForm((f) => ({ ...f, destination: "" })); } }
                : undefined
            }
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="hotel-reco" className="text-xl font-black text-slate-950">Hôtels recommandés</h2>
                <p className="text-sm text-slate-500">
                  {search.results.length}
                  {search.hasMore ? "+" : ""} établissement{search.results.length > 1 ? "s" : ""}
                  {hasDates ? " disponible" + (search.results.length > 1 ? "s" : "") : ""}
                </p>
              </div>
              <Link href={resultsHref(discovery)} className="text-sm font-bold text-[#009688] hover:underline">
                Voir tous les résultats
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((h) => (
                <HotelListingCard
                  key={h.id}
                  hotel={h}
                  href={hotelHref(h.id, discovery)}
                  hasDates={hasDates}
                  isFavorite={favorites.isFavorite(h.id)}
                  favoritePending={favorites.isPending(h.id)}
                  onToggleFavorite={() => favorites.toggle(h.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
