"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarX, Info, LoaderCircle, SearchX, ShieldCheck, WifiOff } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { createBooking } from "@/lib/hotels/booking";
import { dayMonthLabel } from "@/lib/hotels/dates";
import {
  HOTEL_ERROR_MESSAGES,
  QUOTE_UNAVAILABLE_MESSAGE,
  paymentOptionHint,
  paymentOptionLabel,
} from "@/lib/hotels/labels";
import { draftHref, hotelHref, loginHref } from "@/lib/hotels/search-params";
import { PriceSummary, StaySummary } from "./booking-summary";
import { HotelAuthGate } from "./hotel-auth-gate";
import { BlockSkeleton, BookingSteps, StateBlock } from "./hotel-ui";
import { useDraftContext, useDraftFromUrl, useServerQuote } from "./use-booking-draft";

export function BookingCheckoutView() {
  return (
    <HotelAuthGate title="Connectez-vous pour réserver" message="Votre sélection est conservée : vous reviendrez exactement ici après la connexion.">
      <CheckoutInner />
    </HotelAuthGate>
  );
}

/**
 * 🧾 CHECKOUT HÔTEL — l'écran qui engage. Miroir de `HotelCheckoutScreen`.
 *
 * ⚠️ Le total affiché est celui du DERNIER devis serveur ; il part en
 *    `p_expected_total` pour détecter une dérive d'affichage, jamais pour
 *    facturer. La RPC recalcule tout sous verrou.
 * ⚠️ Anti double-clic : le verrou est posé AVANT le premier `await`. Un
 *    double clic sans lui créerait deux réservations et décompterait
 *    l'inventaire deux fois.
 */
function CheckoutInner() {
  const router = useRouter();
  const { profile } = useAuth();
  const { draft, currentUrl } = useDraftFromUrl();
  const ctx = useDraftContext(draft, { withPayment: true });
  const ready = ctx.status === "ready" && !!ctx.room;
  const { quote, quoting, refresh } = useServerQuote(draft, ready);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; payment?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [roomTaken, setRoomTaken] = useState<{ date: string | null } | null>(null);
  const lock = useRef(false);
  const prefilled = useRef(false);
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();

  // Préremplissage depuis le profil : ne pas faire ressaisir ce que Rivendy sait déjà.
  useEffect(() => {
    if (prefilled.current || !profile) return;
    prefilled.current = true;
    setName((v) => v || profile.full_name || "");
    setPhone((v) => v || profile.whatsapp_number || "");
    setEmail((v) => v || profile.real_email || "");
  }, [profile]);

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
        <StateBlock icon={WifiOff} tone="error" title="Connexion interrompue" message="Votre réservation n'a pas pu être préparée." action={{ label: "Réessayer", onClick: ctx.reload }} />
      </Shell>
    );
  }
  if (ctx.status === "loading" || !ctx.hotel) {
    return (
      <Shell>
        <BlockSkeleton lines={4} />
        <div className="mt-4"><BlockSkeleton lines={6} /></div>
      </Shell>
    );
  }
  if (!ctx.room) {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Cette chambre n'est plus proposée" action={{ label: "Voir les chambres", href: draftHref("rooms", draft) }} />
      </Shell>
    );
  }

  const hotel = ctx.hotel;
  const d = draft;
  const options = ctx.paymentOptions;
  // Un seul moyen : présélectionné (évite un clic inutile, comme l'app).
  const selectedPayment = payment ?? (options.length === 1 ? options[0].methodCode : null);
  const needsPayment = options.length > 0;
  const quoteOk = !!quote && quote.ok;
  const quoteAvailable = !!quote && quote.ok && quote.isAvailable;
  const canConfirm = quoteAvailable && !quoting && !submitting && (!needsPayment || !!selectedPayment);

  async function onConfirm() {
    if (lock.current) return;
    // Validation synchrone d'abord : aucun appel réseau tant que le formulaire est faux.
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Indiquez le nom du voyageur";
    if (phone.trim().length < 6) next.phone = "Un numéro joignable est nécessaire";
    if (email.trim() && !(email.includes("@") && email.includes("."))) next.email = "Cet email semble incomplet";
    if (needsPayment && !selectedPayment) next.payment = "Choisissez un moyen de paiement pour continuer";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!quote || !quote.ok || !quote.isAvailable) return;

    // ── VERROU — posé avant tout await ──
    lock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const result = await createBooking(
      supabase,
      {
        roomId: d.roomId!,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        adults: d.adults,
        children: d.children,
        roomsCount: d.rooms,
        serviceIds: d.serviceIds,
      },
      {
        guestName: name.trim(),
        guestPhone: phone.trim(),
        guestEmail: email.trim() || null,
        paymentMethod: selectedPayment,
        expectedTotal: quote.totalAmount,
      },
    );

    if (result.ok) {
      // replace : revenir en arrière ne doit pas ramener sur un checkout qui relancerait une réservation.
      // Le verrou reste posé : la page change.
      router.replace(`/hotels/booking/confirmation?ref=${encodeURIComponent(result.reference)}`);
      return;
    }

    lock.current = false;
    setSubmitting(false);

    if (result.error === "room_unavailable") {
      setRoomTaken({ date: result.unavailableDate });
      return;
    }
    if (result.error === "not_authenticated") {
      router.push(loginHref(currentUrl));
      return;
    }
    if (result.error === "network") {
      // Réponse perdue : la réservation a PU être créée. On le dit plutôt que d'inviter à recommencer à l'aveugle.
      setSubmitError("La connexion a été interrompue avant la réponse. Vérifiez « Mes réservations » avant de réessayer.");
      return;
    }
    setSubmitError(HOTEL_ERROR_MESSAGES[result.error]);
    refresh();
  }

  return (
    <Shell hotelName={hotel.name} hotelId={hotel.id}>
      <BookingSteps current={3} />
      <h1 className="mb-4 text-2xl font-black text-slate-950">Votre réservation</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <StaySummary hotel={hotel} draft={d} room={ctx.room} />

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-guest">
            <h2 id="h-guest" className="text-lg font-black text-slate-950">Voyageur principal</h2>
            <p className="text-xs text-slate-500">L&apos;hôtel utilisera ces informations à votre arrivée.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor={nameId}>Nom complet</Label>
                <Input id={nameId} className="mt-1.5" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${nameId}-e` : undefined} />
                {errors.name ? <p id={`${nameId}-e`} className="mt-1 text-xs font-semibold text-red-600">{errors.name}</p> : null}
              </div>
              <div>
                <Label htmlFor={phoneId}>Téléphone</Label>
                <Input id={phoneId} className="mt-1.5" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${phoneId}-e` : undefined} />
                {errors.phone ? <p id={`${phoneId}-e`} className="mt-1 text-xs font-semibold text-red-600">{errors.phone}</p> : null}
              </div>
              <div>
                <Label htmlFor={emailId}>Email (facultatif)</Label>
                <Input id={emailId} className="mt-1.5" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${emailId}-e` : undefined} />
                {errors.email ? <p id={`${emailId}-e`} className="mt-1 text-xs font-semibold text-red-600">{errors.email}</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-pay">
            <h2 id="h-pay" className="text-lg font-black text-slate-950">Paiement</h2>
            {options.length === 0 ? (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Aucun moyen de paiement en ligne pour cet établissement. Le règlement se fera directement auprès de l&apos;hôtel.
              </p>
            ) : (
              <div className="mt-3 space-y-2" role="radiogroup" aria-labelledby="h-pay">
                {options.map((o) => {
                  const on = selectedPayment === o.methodCode;
                  return (
                    <button
                      key={o.methodCode}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setPayment(o.methodCode);
                        setErrors((e) => ({ ...e, payment: undefined }));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left",
                        on ? "border-[#009688] bg-[#E0F2F1]" : "border-slate-200 bg-white hover:border-[#009688]",
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-[#009688]" : "border-slate-300")} aria-hidden>
                        {on ? <span className="h-2.5 w-2.5 rounded-full bg-[#009688]" /> : null}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-slate-950">{paymentOptionLabel(o.methodCode)}</span>
                        <span className="block text-xs text-slate-500">{paymentOptionHint(o)}</span>
                      </span>
                    </button>
                  );
                })}
                {errors.payment ? <p className="text-xs font-semibold text-red-600">{errors.payment}</p> : null}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="h-cond">
            <h2 id="h-cond" className="text-lg font-black text-slate-950">Conditions d&apos;annulation</h2>
            <p className="mt-2 text-sm text-slate-600">
              Votre réservation peut être annulée depuis « Mes réservations » tant que le séjour n&apos;a pas commencé. Les modalités de
              remboursement sont convenues avec l&apos;établissement.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Ces conditions sont figées au moment de la réservation : une évolution ultérieure de la politique de l&apos;hôtel ne s&apos;applique pas.
            </p>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {quoting && !quote ? <BlockSkeleton lines={4} /> : null}
          {quote && quote.ok ? (
            <div className={cn(quoting && "opacity-60")} aria-busy={quoting}>
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
          {quoteOk && !quoteAvailable ? (
            <div role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              <CalendarX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {QUOTE_UNAVAILABLE_MESSAGE} <Link href={draftHref("rooms", d)} className="underline">Voir les autres chambres</Link>
              </span>
            </div>
          ) : null}
          {submitError ? (
            <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {submitError}
            </p>
          ) : null}
          <Button type="button" size="lg" className="w-full" disabled={!canConfirm} onClick={onConfirm}>
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {submitting ? "Réservation en cours…" : "Confirmer la réservation"}
          </Button>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" aria-hidden />
            En confirmant, vous acceptez les conditions d&apos;annulation ci-dessus.
          </p>
        </aside>
      </div>

      {roomTaken ? (
        <DialogShell labelledBy="room-taken-title" describedBy="room-taken-desc" onClose={() => setRoomTaken(null)}>
          <h2 id="room-taken-title" className="text-lg font-black text-slate-950">Cette chambre vient d&apos;être réservée</h2>
          <p id="room-taken-desc" className="mt-2 text-sm text-slate-600">
            {roomTaken.date
              ? `Elle n'est plus libre le ${dayMonthLabel(roomTaken.date)}. D'autres options sont encore disponibles pour votre séjour.`
              : "D'autres options sont encore disponibles pour votre séjour."}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRoomTaken(null)}>
              Fermer
            </Button>
            <Button type="button" onClick={() => router.push(draftHref("rooms", d, { roomId: null }))}>
              Voir les autres chambres
            </Button>
          </div>
        </DialogShell>
      ) : null}
    </Shell>
  );
}

function Shell({ children, hotelName, hotelId }: { children: React.ReactNode; hotelName?: string; hotelId?: string }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: "Hôtels", href: "/hotels" },
          ...(hotelName && hotelId ? [{ label: hotelName, href: hotelHref(hotelId) }] : []),
          { label: "Paiement" },
        ]}
      />
      {children}
    </main>
  );
}
