"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX, Check, ConciergeBell, LoaderCircle, SearchX, WifiOff } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { HOTEL_ERROR_MESSAGES, QUOTE_UNAVAILABLE_MESSAGE, SERVICE_UNIT_SUFFIX } from "@/lib/hotels/labels";
import { draftHref, hotelHref } from "@/lib/hotels/search-params";
import { PriceSummary, StaySummary } from "./booking-summary";
import { BlockSkeleton, BookingSteps, HotelImg, StateBlock, useHotelMoney } from "./hotel-ui";
import { useDraftContext, useDraftFromUrl, useServerQuote } from "./use-booking-draft";

/**
 * ✨ « AMÉLIOREZ VOTRE SÉJOUR » — miroir de `HotelServicesScreen`.
 *
 * Chaque case cochée met l'URL à jour (le choix survit au rechargement) et
 * relance un devis SERVEUR : le total affiché n'est jamais une addition
 * faite par le navigateur.
 */
export function BookingServicesView() {
  const router = useRouter();
  const { draft } = useDraftFromUrl();
  const ctx = useDraftContext(draft, { withServices: true });
  const ready = ctx.status === "ready" && !!ctx.room;
  const { quote, quoting, refresh } = useServerQuote(draft, ready);
  const money = useHotelMoney();

  if (!draft || ctx.status === "missing" || !draft.roomId) {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Réservation incomplète" message="Reprenez depuis la recherche pour choisir vos dates et votre chambre." action={{ label: "Retour à la recherche", href: "/hotels" }} />
      </Shell>
    );
  }
  if (ctx.status === "not_found") {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Cet hôtel n'est plus disponible" action={{ label: "Voir les hôtels", href: "/hotels" }} />
      </Shell>
    );
  }
  if (ctx.status === "error") {
    return (
      <Shell>
        <StateBlock icon={WifiOff} tone="error" title="Connexion interrompue" message="Les services n'ont pas pu être chargés." action={{ label: "Réessayer", onClick: ctx.reload }} />
      </Shell>
    );
  }
  if (ctx.status === "loading" || !ctx.hotel) {
    return (
      <Shell>
        <BlockSkeleton lines={4} />
      </Shell>
    );
  }
  if (!ctx.room) {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Cette chambre n'est plus proposée" message="Choisissez une autre chambre pour votre séjour." action={{ label: "Voir les chambres", href: draftHref("rooms", draft) }} />
      </Shell>
    );
  }

  const hotel = ctx.hotel;
  const d = draft;
  const selected = new Set(d.serviceIds);
  // Services de l'URL qui n'appartiennent plus à l'hôtel : ignorés à l'affichage
  // (la RPC les ignore aussi : `s.hotel_id = v_room.h_id AND s.is_active`).
  const known = new Set(ctx.services.map((s) => s.id));

  function toggle(serviceId: string) {
    const next = selected.has(serviceId)
      ? d.serviceIds.filter((id) => id !== serviceId)
      : [...d.serviceIds.filter((id) => known.has(id)), serviceId];
    router.replace(draftHref("services", d, { serviceIds: next }), { scroll: false });
  }

  const lineFor = (serviceId: string) => (quote && quote.ok ? quote.services.find((s) => s.serviceId === serviceId) : undefined);
  const blocked = quote && quote.ok && !quote.isAvailable;
  const canContinue = !!quote && quote.ok && quote.isAvailable && !quoting;

  return (
    <Shell hotelName={hotel.name} hotelId={hotel.id} roomsHref={draftHref("rooms", d)}>
      <BookingSteps current={2} />
      <h1 className="text-2xl font-black text-slate-950">Améliorez votre séjour</h1>
      <p className="mb-4 text-sm text-slate-500">Facultatif — vous pourrez aussi ajouter des services après votre réservation.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {ctx.services.length === 0 ? (
            <StateBlock icon={ConciergeBell} title="Aucun service proposé" message="Cet établissement ne propose pas encore de service additionnel. Vous pouvez continuer votre réservation." />
          ) : (
            ctx.services.map((s) => {
              const on = selected.has(s.id);
              const line = on ? lineFor(s.id) : undefined;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-3xl border bg-white p-3 text-left shadow-sm transition",
                    on ? "border-[#009688] ring-1 ring-[#009688]" : "border-slate-200 hover:border-[#009688]",
                  )}
                >
                  {s.imageUrl ? (
                    <HotelImg src={s.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#E0F2F1] text-[#007168]">
                      <ConciergeBell className="h-6 w-6" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-950">{s.name}</span>
                    {s.description ? <span className="line-clamp-2 block text-xs text-slate-500">{s.description}</span> : null}
                    <span className="mt-1 block text-xs font-semibold text-slate-600">
                      {money(s.price, ctx.room!.currency, hotel.countryId)} {SERVICE_UNIT_SUFFIX[s.unit]}
                      {line ? ` · × ${line.quantity} = ${money(line.lineTotal, quote && quote.ok ? quote.currency : ctx.room!.currency, hotel.countryId)}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                      on ? "border-[#009688] bg-[#009688] text-white" : "border-slate-300",
                    )}
                    aria-hidden
                  >
                    {on ? <Check className="h-4 w-4" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <StaySummary hotel={hotel} draft={d} room={ctx.room} />
          {quoting && !quote ? <BlockSkeleton lines={3} /> : null}
          {quote && quote.ok ? (
            <div className={cn(quoting && "opacity-60 transition-opacity")} aria-busy={quoting}>
              <PriceSummary quote={quote} countryId={hotel.countryId} />
            </div>
          ) : null}
          {quote && !quote.ok ? (
            <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {HOTEL_ERROR_MESSAGES[quote.error]}
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={refresh} className="underline">Réessayer</button>
                <Link href={draftHref("rooms", d)} className="underline">Changer de chambre</Link>
              </div>
            </div>
          ) : null}
          {blocked ? (
            <div role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              <CalendarX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {QUOTE_UNAVAILABLE_MESSAGE}{" "}
                <Link href={draftHref("rooms", d)} className="underline">Voir les autres chambres</Link>
              </span>
            </div>
          ) : null}
          <Button type="button" size="lg" className="w-full" disabled={!canContinue} onClick={() => router.push(draftHref("checkout", d))}>
            {quoting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {quoting ? "Mise à jour…" : "Continuer"}
          </Button>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  hotelName,
  hotelId,
  roomsHref,
}: {
  children: React.ReactNode;
  hotelName?: string;
  hotelId?: string;
  roomsHref?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: "Hôtels", href: "/hotels" },
          ...(hotelName && hotelId ? [{ label: hotelName, href: hotelHref(hotelId) }] : []),
          ...(roomsHref ? [{ label: "Chambres", href: roomsHref }] : []),
          { label: "Services" },
        ]}
      />
      {children}
    </main>
  );
}
