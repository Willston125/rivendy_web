import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, MapPin, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { createAnonServerClient } from "@/lib/supabase/server";
import { getCountry } from "@/services/public-data";
import { getAmenityReferential, getHotelById, getHotelReviews, getRooms } from "@/lib/hotels/catalog";
import { fullDateLabel } from "@/lib/hotels/dates";
import { AMENITY_CATEGORY_LABELS, formatRating, ratingLabel, reviewerDisplayName } from "@/lib/hotels/labels";
import { formatHotelMoney } from "@/lib/hotels/money";
import { isUuid, parseSearchQuery } from "@/lib/hotels/search-params";
import { hotelCoverUrl, hotelLocationLabel, type HotelAmenity } from "@/lib/hotels/types";
import { HotelGallery } from "@/features/hotels/hotel-gallery";
import { HotelDetailActions, HotelStayBox } from "@/features/hotels/hotel-detail-client";
import { AmenityIcon, StarRow } from "@/features/hotels/hotel-ui";

/**
 * 🏨 FICHE HÔTEL — rendu serveur, miroir de `HotelDetailScreen`.
 *
 * Lit `visible_hotels` (publiés et non suspendus) avec le client ANONYME :
 * la fiche est publique et indexable. Le CTA conduit à la réservation ferme.
 */
const loadHotel = cache(async (hotelId: string) => {
  if (!isUuid(hotelId)) return null;
  return getHotelById(createAnonServerClient(), hotelId);
});

export async function generateMetadata({ params }: { params: Promise<{ hotelId: string }> }): Promise<Metadata> {
  const { hotelId } = await params;
  let hotel = null;
  try {
    hotel = await loadHotel(hotelId);
  } catch {
    return { title: "Hôtel — Rivendy" };
  }
  if (!hotel) return { title: "Hôtel introuvable — Rivendy" };
  const location = hotelLocationLabel(hotel);
  const description =
    hotel.description.trim().slice(0, 160) ||
    `Réservez une chambre à ${hotel.name}${location ? `, ${location}` : ""}, sur Rivendy.`;
  const cover = hotelCoverUrl(hotel);
  return {
    title: `${hotel.name} — Réserver sur Rivendy`,
    description,
    openGraph: {
      title: `${hotel.name} — Hôtel sur Rivendy`,
      description,
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

const SUB_RATINGS = [
  ["cleanliness", "Propreté"],
  ["location", "Emplacement"],
  ["service", "Service"],
  ["comfort", "Confort"],
  ["value", "Rapport qualité/prix"],
] as const;

export default async function HotelPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { hotelId } = await params;
  const sp = await searchParams;
  const hotel = await loadHotel(hotelId);
  if (!hotel) notFound();

  const client = createAnonServerClient();
  const [rooms, reviews, referential, country] = await Promise.all([
    getRooms(client, hotel.id),
    getHotelReviews(client, hotel.id, 10),
    getAmenityReferential(client),
    getCountry(hotel.countryId),
  ]);

  const byCode = new Map(referential.map((a) => [a.code, a]));
  const amenities: HotelAmenity[] = hotel.amenityCodes
    .map((code) => byCode.get(code) ?? { code, label: code, icon: "", category: "general", position: 999 })
    .sort((a, b) => a.position - b.position);
  const amenityGroups = new Map<string, HotelAmenity[]>();
  for (const a of amenities) {
    const list = amenityGroups.get(a.category) ?? [];
    list.push(a);
    amenityGroups.set(a.category, list);
  }

  // « À partir de » : le plus bas des chambres actives (tarif de référence, affichage seul).
  const cheapest = rooms.reduce<(typeof rooms)[number] | null>((m, r) => (m == null || r.basePrice < m.basePrice ? r : m), null);
  const fromPrice = cheapest
    ? formatHotelMoney(cheapest.basePrice, cheapest.currency, hotel.countryId, country ? [country] : [])
    : null;

  const query = parseSearchQuery(sp);
  const location = hotelLocationLabel(hotel);
  const { breakdown, recent } = reviews;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Hôtels", href: "/hotels" }, { label: hotel.name }]} />

      <HotelGallery images={hotel.images} hotelName={hotel.name} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {hotel.isVerified ? (
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] px-2.5 py-1 text-xs font-bold text-[#007168]">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Partenaire Rivendy
                  </span>
                ) : null}
                <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{hotel.name}</h1>
                {/* Étoiles UNIQUEMENT si l'hôtel est classé : un non-classé n'hérite pas d'étoiles vides. */}
                <StarRow count={hotel.starRating} className="mt-1.5" />
                {location ? (
                  <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {location}
                  </p>
                ) : null}
              </div>
              <HotelDetailActions hotelId={hotel.id} hotelName={hotel.name} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              {breakdown.count > 0 ? (
                <>
                  <span className="rounded-lg bg-[#009688] px-2.5 py-1.5 text-sm font-black text-white">
                    {formatRating(breakdown.average)}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{ratingLabel(breakdown.average, breakdown.count)}</span>
                  <span className="text-sm text-slate-500">· {breakdown.count} avis</span>
                </>
              ) : (
                <>
                  <span className="rounded-lg bg-[#E0F2F1] px-2.5 py-1 text-xs font-bold text-[#007168]">Nouveau</span>
                  <span className="text-sm text-slate-500">Aucun avis pour le moment</span>
                </>
              )}
            </div>
          </section>

          {amenities.length ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-amen">
              <h2 id="h-amen" className="text-lg font-black text-slate-950">Équipements</h2>
              <div className="mt-3 space-y-4">
                {Array.from(amenityGroups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    {amenityGroups.size > 1 ? (
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{AMENITY_CATEGORY_LABELS[cat] ?? cat}</p>
                    ) : null}
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {list.map((a) => (
                        <li key={a.code} className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E0F2F1] text-[#007168]">
                            <AmenityIcon icon={a.icon} />
                          </span>
                          {a.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {hotel.description.trim() ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-about">
              <h2 id="h-about" className="text-lg font-black text-slate-950">À propos de cet hôtel</h2>
              {hotel.description.trim().length > 400 ? (
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-sm leading-6 text-slate-600 [&::-webkit-details-marker]:hidden">
                    <span className="line-clamp-4 whitespace-pre-line group-open:line-clamp-none">{hotel.description.trim()}</span>
                    <span className="mt-1 inline-block font-bold text-[#009688] group-open:hidden">En savoir plus</span>
                  </summary>
                </details>
              ) : (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{hotel.description.trim()}</p>
              )}
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-info">
            <h2 id="h-info" className="text-lg font-black text-slate-950">Informations pratiques</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden /> Arrivée</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">à partir de {hotel.checkInTime}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden /> Départ</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">avant {hotel.checkOutTime}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" aria-hidden />
              Réservation confirmée par Rivendy. Votre référence et votre QR code sont disponibles dans « Mes réservations ».
            </p>
          </section>

          {hotel.address.trim() ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-loc">
              <h2 id="h-loc" className="text-lg font-black text-slate-950">Où se trouve l&apos;hôtel ?</h2>
              <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" aria-hidden /> {hotel.address.trim()}
              </p>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-rev">
            <h2 id="h-rev" className="text-lg font-black text-slate-950">Avis voyageurs</h2>
            {breakdown.count === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Cet établissement n&apos;a pas encore reçu d&apos;avis. Seuls les voyageurs ayant séjourné via Rivendy peuvent en laisser.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  Moyenne de {formatRating(breakdown.average)}/5 sur {breakdown.count} avis vérifié{breakdown.count > 1 ? "s" : ""}.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {SUB_RATINGS.map(([key, label]) => {
                    const v = breakdown[key];
                    if (v == null) return null;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 text-xs font-semibold text-slate-600">{label}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-[#009688]" style={{ width: `${(v / 5) * 100}%` }} />
                        </span>
                        <span className="w-8 text-right text-xs font-bold text-slate-800">{formatRating(v)}</span>
                      </div>
                    );
                  })}
                </div>
                <ul className="mt-5 space-y-4">
                  {recent.map((r) => (
                    <li key={r.id} className="border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {reviewerDisplayName(r.authorName)}
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-[#007168]">
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Séjour vérifié
                          </span>
                        </p>
                        <span className="rounded-lg bg-[#E0F2F1] px-2 py-0.5 text-xs font-black text-[#007168]">{r.rating}/5</span>
                      </div>
                      {r.createdAt ? <p className="text-xs text-slate-400">{fullDateLabel(r.createdAt.slice(0, 10))}</p> : null}
                      {r.comment.trim() ? <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{r.comment.trim()}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <HotelStayBox
            hotelId={hotel.id}
            fromPrice={fromPrice}
            hasRooms={rooms.length > 0}
            acceptingBookings={hotel.isAcceptingBookings}
            initial={{
              checkIn: query.checkIn,
              checkOut: query.checkOut,
              rooms: query.rooms,
              adults: query.adults,
              children: query.children,
            }}
          />
        </aside>
      </div>
    </main>
  );
}
