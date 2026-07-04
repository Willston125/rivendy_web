import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Star, MapPin, Phone, BedDouble } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  getCountry,
  getSellerProfile,
  getSellerPublicProducts,
  getStoreTrustSummary,
} from "@/services/public-data";
import { hotelRoomPrice } from "@/features/products/hotel-listings";
import { HotelRoomCard } from "@/features/products/hotel-room-card";
import { HotelReservationForm } from "@/features/products/hotel-reservation-form";
import type { Product } from "@/types/rivendy";

const getSellerProfileCached = cache(getSellerProfile);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}): Promise<Metadata> {
  const { sellerId } = await params;
  const seller = await getSellerProfileCached(sellerId);
  if (!seller) return { title: "Hôtel introuvable — Rivendy" };
  const name = seller.store_name || seller.full_name || "Hôtel Rivendy";
  return {
    title: `${name} — Hôtel sur Rivendy`,
    description:
      seller.store_description ||
      `Réservez une chambre chez ${name} sur Rivendy.`,
  };
}

function attr(p: Product, key: string): string {
  const v = p.extra_attributes?.[key];
  return v == null ? "" : String(v).trim();
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const { sellerId } = await params;

  const seller = await getSellerProfileCached(sellerId);
  if (!seller) notFound();

  const [products, trust, country] = await Promise.all([
    getSellerPublicProducts(sellerId, false),
    getStoreTrustSummary(sellerId),
    getCountry(seller.country_id || "DJ"),
  ]);

  const rooms = products.filter(
    (p) => p.category === "hotel" && (p.status === "active" || p.status === "boosted"),
  );

  const name = seller.store_name || seller.full_name || "Hôtel Rivendy";
  const rating = Number(trust.score ?? 0);
  const bannerSrc = seller.store_banner_url_web || seller.store_banner_url;

  let locality = "";
  const amenities: string[] = [];
  for (const r of rooms) {
    if (!locality) locality = attr(r, "localisation") || attr(r, "zone") || attr(r, "ville");
    for (const a of attr(r, "equipements").split(/[,;/]/).map((s) => s.trim()).filter(Boolean)) {
      if (!amenities.some((e) => e.toLowerCase() === a.toLowerCase())) amenities.push(a);
      if (amenities.length >= 4) break;
    }
  }

  let minPrice = 0;
  for (const r of rooms) {
    const price = hotelRoomPrice(r);
    if (price > 0 && (minPrice === 0 || price < minPrice)) minPrice = price;
  }
  const priceText = minPrice > 0 ? `À partir de ${minPrice.toLocaleString("fr-FR")} ${country.currency_symbol}` : "";

  const checkIn = attr(rooms[0] ?? ({} as Product), "check_in") || "14h00";
  const checkOut = attr(rooms[0] ?? ({} as Product), "check_out") || "12h00";

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: "Hôtels", href: "/?category=hotel" },
          { label: name },
        ]}
      />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="relative h-40 bg-slate-900 md:h-56">
          {bannerSrc ? (
            <Image src={bannerSrc} alt="" fill sizes="100vw" priority className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#009688_0%,#004D40_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <div className="px-5 pb-6 md:px-8">
          <div className="-mt-12 flex items-end gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-[#E0F2F1] shadow-md">
              {seller.avatar_url ? (
                <Image src={seller.avatar_url} alt={name} fill sizes="96px" className="object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[#009688]">
                  <BedDouble className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl">{name}</h1>
                {seller.is_certified && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#009688] px-2.5 py-0.5 text-[11px] font-black text-white">
                    <BadgeCheck className="h-3 w-3 fill-white" />
                    Certifié
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] font-bold">
                {rating > 0 && (
                  <span className="flex items-center gap-1 text-[#FF6B35]">
                    <Star className="h-3.5 w-3.5 fill-[#FF6B35]" />
                    {rating.toFixed(1)}
                  </span>
                )}
                {locality && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {locality}
                  </span>
                )}
              </div>
              {amenities.length > 0 && (
                <p className="mt-1 text-[12.5px] font-medium text-slate-500">{amenities.join(" · ")}</p>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm font-medium text-slate-500">
            Réservez votre séjour directement via Rivendy
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <HotelReservationForm
              sellerId={sellerId}
              hotelName={name}
              triggerLabel={priceText ? `${priceText} — Demander une réservation` : "Demander une réservation"}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF6B35] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#F0602D]"
            />
            {country.whatsapp_number && (
              <a
                href={`tel:${country.whatsapp_number}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#009688] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#00897B]"
              >
                <Phone className="h-4 w-4" />
                Appeler Rivendy
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Chambres disponibles ──────────────────────────────── */}
      {rooms.length > 0 ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <h2 className="mb-4 text-xl font-black text-slate-900">
              Chambres disponibles
              <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-500">
                {rooms.length}
              </span>
            </h2>
            {rooms.map((r) => (
              <HotelRoomCard key={r.id} room={r} sellerId={sellerId} hotelName={name} country={country} />
            ))}
          </section>

          {/* ── À propos + Informations utiles ────────────────── */}
          <aside className="space-y-4">
            {seller.store_description && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-[15.5px] font-black text-slate-900">À propos</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{seller.store_description}</p>
              </div>
            )}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-[15.5px] font-black text-slate-900">Informations utiles</h3>
              <dl className="mt-3 space-y-2 text-[13.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Check-in</dt>
                  <dd className="font-bold text-slate-900">{checkIn}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Check-out</dt>
                  <dd className="font-bold text-slate-900">{checkOut}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Annulation</dt>
                  <dd className="font-bold text-slate-900">Selon conditions de l&apos;hôtel</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Paiement</dt>
                  <dd className="font-bold text-slate-900">via Rivendy / à confirmer</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <BedDouble className="h-10 w-10 text-slate-200" />
          <p className="mt-3 font-semibold text-slate-500">Aucune chambre disponible pour le moment</p>
          <Link href="/?category=hotel" className="mt-4 text-sm font-bold text-[#009688] hover:underline">
            Découvrir d&apos;autres hôtels →
          </Link>
        </div>
      )}
    </div>
  );
}
