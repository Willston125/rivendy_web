"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Hotel as HotelIcon, WifiOff } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { getMyBookings } from "@/lib/hotels/booking";
import { nightsLabel, rangeLabel } from "@/lib/hotels/dates";
import { isUpcomingStatus, type HotelBooking } from "@/lib/hotels/types";
import { HotelAuthGate } from "./hotel-auth-gate";
import { CardSkeletons, HotelImg, StateBlock, StatusPills, useHotelMoney } from "./hotel-ui";

type Tab = "upcoming" | "completed" | "cancelled";

const TABS: { id: Tab; label: string; empty: [string, string] }[] = [
  { id: "upcoming", label: "À venir", empty: ["Aucun séjour à venir", "Vos prochaines réservations apparaîtront ici."] },
  { id: "completed", label: "Terminées", empty: ["Aucun séjour terminé", "Vos séjours passés seront listés ici — vous pourrez y laisser un avis."] },
  { id: "cancelled", label: "Annulées", empty: ["Aucune annulation", "Les réservations annulées apparaîtront ici."] },
];

/** Répartition par onglet — miroir de `HotelBookingProvider` (le statut serveur fait foi, pas le calendrier). */
function inTab(b: HotelBooking, tab: Tab): boolean {
  if (tab === "upcoming") return isUpcomingStatus(b.bookingStatus);
  if (tab === "completed") return b.bookingStatus === "completed";
  return b.bookingStatus === "cancelled" || b.bookingStatus === "no_show";
}

export function MyBookingsView() {
  return (
    <HotelAuthGate>
      <MyBookingsInner />
    </HotelAuthGate>
  );
}

/**
 * 🗓️ MES RÉSERVATIONS — miroir de `MyHotelBookingsScreen`.
 * Aucun filtre `user_id` côté client : la policy `hotel_bookings_user_read` s'en charge.
 */
function MyBookingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "upcoming";
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [token, setToken] = useState(0);
  const money = useHotelMoney();

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getMyBookings(supabase)
      .then((list) => {
        if (cancelled) return;
        setBookings(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const visible = bookings.filter((b) => inTab(b, tab));
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <Breadcrumbs items={[{ label: "Hôtels", href: "/hotels" }, { label: "Mes réservations" }]} />
      <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Mes réservations</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Réservations">
        {TABS.map((t) => {
          const count = bookings.filter((b) => inTab(b, t.id)).length;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => router.replace(`/hotels/bookings${t.id === "upcoming" ? "" : `?tab=${t.id}`}`, { scroll: false })}
              className={cn(
                "-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm font-bold",
                tab === t.id ? "border-[#009688] text-[#007168]" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              {status === "ready" ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <section className="mt-5" role="tabpanel" aria-label={current.label}>
        {status === "loading" ? (
          <CardSkeletons count={2} className="sm:grid-cols-1 lg:grid-cols-1" />
        ) : status === "error" ? (
          <StateBlock icon={WifiOff} tone="error" title="Connexion interrompue" message="Vos réservations n'ont pas pu être chargées." action={{ label: "Réessayer", onClick: () => setToken((t) => t + 1) }} />
        ) : visible.length === 0 ? (
          <StateBlock
            icon={tab === "cancelled" ? CalendarX : tab === "completed" ? CalendarCheck : HotelIcon}
            title={current.empty[0]}
            message={current.empty[1]}
            action={tab === "upcoming" ? { label: "Trouver un hôtel", href: "/hotels" } : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/hotels/bookings/${b.id}`}
                  className="flex gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]"
                >
                  <HotelImg src={b.hotelCoverUrl} alt="" className="h-24 w-24 shrink-0 rounded-2xl sm:w-32" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="truncate text-base font-black text-slate-950">{b.hotelName || "Établissement"}</p>
                      <StatusPills booking={b.bookingStatus} payment={b.paymentStatus} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {rangeLabel(b.checkIn, b.checkOut)} · {nightsLabel(b.nights)}
                      {b.roomName ? ` · ${b.roomName}` : ""}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-700">{b.reference}</span>
                      <span className="font-black text-slate-950">{money(b.totalAmount, b.currency, b.countryId)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
