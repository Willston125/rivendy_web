"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Ban, ConciergeBell, LoaderCircle, SearchX, Star, WifiOff, X } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { getServices } from "@/lib/hotels/catalog";
import {
  addServiceToBooking,
  cancelBooking,
  getBookingById,
  hasReviewForBooking,
  submitReview,
} from "@/lib/hotels/booking";
import { serviceQuantity } from "@/lib/hotels/availability";
import { fullDateLabel, guestsLabel, nightsLabel } from "@/lib/hotels/dates";
import {
  HOTEL_ERROR_MESSAGES,
  PAYMENT_STATUS_LABELS,
  SERVICE_UNIT_SUFFIX,
  collectionModelLabel,
  paymentOptionLabel,
  starPickLabel,
} from "@/lib/hotels/labels";
import { isUuid } from "@/lib/hotels/search-params";
import {
  acceptsExtraServices,
  allowsReview,
  isCancellableStatus,
  isUpcomingStatus,
  type HotelBooking,
  type HotelServiceItem,
} from "@/lib/hotels/types";
import { BookingReferenceCard } from "./booking-reference-card";
import { HotelAuthGate } from "./hotel-auth-gate";
import { BlockSkeleton, StateBlock, StatusPills, useHotelMoney } from "./hotel-ui";

export function BookingDetailView({ bookingId }: { bookingId: string }) {
  return (
    <HotelAuthGate>
      <DetailInner bookingId={bookingId} />
    </HotelAuthGate>
  );
}

type Notice = { tone: "ok" | "error"; text: string } | null;

/**
 * 🧾 DÉTAIL D'UNE RÉSERVATION — miroir de `HotelBookingDetailScreen`.
 *
 * Statut du SÉJOUR ≠ statut du PAIEMENT, affichés séparément. QR seulement
 * pour un séjour à venir. Annuler / ajouter un service passent par les RPC
 * (jamais d'UPDATE direct) puis la réservation est RELUE : l'écran reflète
 * ce que le serveur a fait, pas ce qu'il était censé faire.
 */
function DetailInner({ bookingId }: { bookingId: string }) {
  const { user } = useAuth();
  const money = useHotelMoney();
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading");
  const [booking, setBooking] = useState<HotelBooking | null>(null);
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<"cancel" | "service" | "review" | null>(null);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => setToken((t) => t + 1), []);

  useEffect(() => {
    if (!isUuid(bookingId)) {
      setStatus("not_found");
      return;
    }
    let cancelled = false;
    getBookingById(supabase, bookingId)
      .then(async (b) => {
        if (cancelled) return;
        if (!b) {
          setStatus("not_found");
          return;
        }
        setBooking(b);
        setStatus("ready");
        if (allowsReview(b.bookingStatus)) {
          try {
            const has = await hasReviewForBooking(supabase, b.id);
            if (!cancelled) setReviewed(has);
          } catch {
            if (!cancelled) setReviewed(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, token]);

  if (status === "loading") {
    return (
      <Shell>
        <BlockSkeleton lines={6} />
      </Shell>
    );
  }
  if (status === "error") {
    return (
      <Shell>
        <StateBlock icon={WifiOff} tone="error" title="Connexion interrompue" message="La réservation n'a pas pu être chargée." action={{ label: "Réessayer", onClick: reload }} />
      </Shell>
    );
  }
  if (status === "not_found" || !booking) {
    return (
      <Shell>
        <StateBlock icon={SearchX} title="Réservation introuvable" message="Elle n'existe pas ou n'est pas rattachée à votre compte." action={{ label: "Mes réservations", href: "/hotels/bookings" }} />
      </Shell>
    );
  }

  const b = booking;
  const m = (n: number) => money(n, b.currency, b.countryId);
  const primaryGuest = b.guests.find((g) => g.isPrimary) ?? b.guests[0];

  return (
    <Shell reference={b.reference}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{b.hotelName || "Établissement"}</h1>
          {b.hotelCity ? <p className="text-sm text-slate-500">{b.hotelCity}</p> : null}
        </div>
        <StatusPills booking={b.bookingStatus} payment={b.paymentStatus} />
      </div>

      {notice ? (
        <p role="status" className={cn("mt-4 rounded-2xl p-3 text-sm font-semibold", notice.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
          {notice.text}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title="Votre séjour">
            <Row label="Arrivée" value={fullDateLabel(b.checkIn)} />
            <Row label="Départ" value={fullDateLabel(b.checkOut)} />
            <Row label="Durée" value={nightsLabel(b.nights)} />
            <Row label="Chambre" value={b.roomName || "—"} />
            <Row label="Voyageurs" value={guestsLabel(b.adults, b.children, b.roomsCount)} />
            {primaryGuest ? <Row label="Voyageur principal" value={primaryGuest.fullName} /> : null}
          </Section>

          {b.services.length ? (
            <Section title="Services">
              {b.services.map((s) => (
                <div key={s.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-700">
                    {s.name} <span className="text-xs text-slate-400">({m(s.unitPrice)} × {s.quantity})</span>
                    {s.addedAfterBooking ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Ajouté après réservation</span> : null}
                  </span>
                  <span className="font-bold text-slate-900">{m(s.lineTotal)}</span>
                </div>
              ))}
            </Section>
          ) : null}

          <Section title="Paiement">
            <Row label="Chambre" value={m(b.roomSubtotal)} />
            {b.servicesTotal > 0 ? <Row label="Services" value={m(b.servicesTotal)} /> : null}
            {b.taxesTotal > 0 ? <Row label="Taxes et frais" value={m(b.taxesTotal)} /> : null}
            {b.discountTotal > 0 ? <Row label="Remise" value={`− ${m(b.discountTotal)}`} /> : null}
            <Row label="Total" value={m(b.totalAmount)} strong />
            <Row label="État du paiement" value={PAYMENT_STATUS_LABELS[b.paymentStatus]} />
            <Row label="Règlement" value={`${collectionModelLabel(b.collectionModel)}${b.paymentMethod ? ` · ${paymentOptionLabel(b.paymentMethod)}` : ""}`} />
          </Section>
        </div>

        <aside className="space-y-3">
          <BookingReferenceCard reference={b.reference} showQr={isUpcomingStatus(b.bookingStatus)} />
          {acceptsExtraServices(b.bookingStatus) ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setDialog("service")}>
              <ConciergeBell className="h-4 w-4" aria-hidden /> Ajouter un service
            </Button>
          ) : null}
          {isCancellableStatus(b.bookingStatus) ? (
            <Button type="button" variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDialog("cancel")}>
              <Ban className="h-4 w-4" aria-hidden /> Annuler la réservation
            </Button>
          ) : null}
          {allowsReview(b.bookingStatus) ? (
            reviewed ? (
              <p className="rounded-2xl bg-[#E0F2F1] p-3 text-center text-sm font-semibold text-[#007168]">Merci, vous avez noté ce séjour.</p>
            ) : (
              <Button type="button" className="w-full" onClick={() => setDialog("review")}>
                <Star className="h-4 w-4" aria-hidden /> Laisser un avis
              </Button>
            )
          ) : null}
          <Link href={`/hotels/${b.hotelId}`} className="block text-center text-sm font-bold text-[#009688] hover:underline">
            Voir la fiche de l&apos;hôtel
          </Link>
        </aside>
      </div>

      {dialog === "cancel" ? (
        <CancelDialog
          booking={b}
          onClose={() => setDialog(null)}
          onDone={(n) => {
            setDialog(null);
            setNotice(n);
            reload();
          }}
        />
      ) : null}
      {dialog === "service" ? (
        <AddServiceDialog
          booking={b}
          onClose={() => setDialog(null)}
          onDone={(n) => {
            setDialog(null);
            setNotice(n);
            reload();
          }}
        />
      ) : null}
      {dialog === "review" && user ? (
        <ReviewDialog
          booking={b}
          userId={user.id}
          onClose={() => setDialog(null)}
          onDone={(n, nowReviewed) => {
            setDialog(null);
            setNotice(n);
            if (nowReviewed) setReviewed(true);
          }}
        />
      ) : null}
    </Shell>
  );
}

// ══════════════════════════════════════════════════════════════════════
// FENÊTRES
// ══════════════════════════════════════════════════════════════════════

function CancelDialog({ booking, onClose, onDone }: { booking: HotelBooking; onClose: () => void; onDone: (n: Notice) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const r = await cancelBooking(supabase, booking.id, "Annulée par le voyageur");
    if (r.ok) {
      onDone({
        tone: "ok",
        text: r.refundPending
          ? "Réservation annulée, la chambre a été libérée. Le remboursement de votre paiement sera traité avec l'établissement."
          : "Réservation annulée. La chambre a été libérée.",
      });
      return;
    }
    lock.current = false;
    setBusy(false);
    setError(r.error === "network" ? "L'annulation n'a pas abouti. Réessayez dans un instant." : HOTEL_ERROR_MESSAGES[r.error]);
  }

  return (
    <DialogShell labelledBy="cancel-title" describedBy="cancel-desc" onClose={busy ? () => undefined : onClose}>
      <h2 id="cancel-title" className="text-lg font-black text-slate-950">Annuler cette réservation ?</h2>
      <p id="cancel-desc" className="mt-2 text-sm text-slate-600">
        Votre chambre sera remise à la disposition d&apos;autres voyageurs. Les modalités de remboursement sont convenues avec l&apos;établissement.
      </p>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Garder ma réservation
        </Button>
        <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Annuler la réservation
        </Button>
      </div>
    </DialogShell>
  );
}

function AddServiceDialog({ booking, onClose, onDone }: { booking: HotelBooking; onClose: () => void; onDone: (n: Notice) => void }) {
  const money = useHotelMoney();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [services, setServices] = useState<HotelServiceItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getServices(supabase, booking.hotelId)
      .then((all) => {
        if (cancelled) return;
        // On masque ce qui est DÉJÀ rattaché (miroir app) : proposer un petit-déjeuner déjà payé invite à l'erreur.
        const alreadyIds = new Set(booking.services.map((s) => s.serviceId).filter(Boolean));
        const alreadyNames = new Set(booking.services.map((s) => s.name));
        setServices(all.filter((s) => !alreadyIds.has(s.id) && !alreadyNames.has(s.name)));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [booking.hotelId, booking.services]);

  async function add(service: HotelServiceItem) {
    if (lock.current) return;
    lock.current = true;
    setBusyId(service.id);
    setError(null);
    const r = await addServiceToBooking(supabase, booking.id, service.id);
    if (r.ok) {
      onDone({ tone: "ok", text: "Service ajouté à votre réservation." });
      return;
    }
    lock.current = false;
    setBusyId(null);
    setError(r.error === "network" ? "Ce service n'a pas pu être ajouté. Réessayez." : HOTEL_ERROR_MESSAGES[r.error]);
  }

  return (
    <DialogShell labelledBy="svc-title" describedBy="svc-desc" onClose={busyId ? () => undefined : onClose}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="svc-title" className="text-lg font-black text-slate-950">Ajouter un service</h2>
          <p id="svc-desc" className="text-sm text-slate-500">Le montant, calculé par Rivendy, sera ajouté à votre réservation.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
        {status === "loading" ? (
          <BlockSkeleton lines={3} />
        ) : status === "error" ? (
          <p className="text-sm font-semibold text-red-600">Les services n&apos;ont pas pu être chargés.</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun service supplémentaire disponible pour ce séjour.</p>
        ) : (
          services.map((s) => {
            // Quantité selon l'unité : même règle que la RPC. Affichée à titre indicatif ;
            // le montant ajouté est calculé par le serveur.
            const qty = serviceQuantity({ unit: s.unit, nights: booking.nights, guests: booking.adults + booking.children });
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {money(s.price, booking.currency, booking.countryId)} {SERVICE_UNIT_SUFFIX[s.unit]}
                    {qty > 1 ? ` · × ${qty}` : ""}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => add(s)} disabled={busyId !== null}>
                  {busyId === s.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Ajouter
                </Button>
              </div>
            );
          })
        )}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
    </DialogShell>
  );
}

const SUB_RATINGS = [
  ["cleanliness", "Propreté"],
  ["location", "Emplacement"],
  ["service", "Service"],
  ["comfort", "Confort"],
  ["value", "Rapport qualité/prix"],
] as const;
type SubKey = (typeof SUB_RATINGS)[number][0];

function StarPicker({ value, onChange, label, size = "md" }: { value: number; onChange: (n: number) => void; label: string; size?: "md" | "sm" }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${label} : ${n} sur 5`}
          onClick={() => onChange(value === n && size === "sm" ? 0 : n)}
          className={cn("flex items-center justify-center rounded-full", size === "md" ? "h-11 w-11" : "h-9 w-9")}
        >
          <Star className={cn(size === "md" ? "h-7 w-7" : "h-5 w-5", n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
        </button>
      ))}
    </div>
  );
}

function ReviewDialog({
  booking,
  userId,
  onClose,
  onDone,
}: {
  booking: HotelBooking;
  userId: string;
  onClose: () => void;
  onDone: (n: Notice, nowReviewed: boolean) => void;
}) {
  const [rating, setRating] = useState(0);
  const [subs, setSubs] = useState<Record<SubKey, number>>({ cleanliness: 0, location: 0, service: 0, comfort: 0, value: 0 });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const commentId = useId();

  async function publish() {
    if (rating < 1) {
      setError("Choisissez une note globale.");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const sub = (k: SubKey) => (subs[k] > 0 ? subs[k] : null);
    const r = await submitReview(supabase, {
      userId,
      bookingId: booking.id,
      hotelId: booking.hotelId,
      rating,
      comment,
      cleanliness: sub("cleanliness"),
      location: sub("location"),
      service: sub("service"),
      comfort: sub("comfort"),
      value: sub("value"),
    });
    if (r.ok) {
      onDone({ tone: "ok", text: "Merci ! Votre avis aidera les prochains voyageurs." }, true);
      return;
    }
    if (r.reason === "duplicate") {
      onDone({ tone: "error", text: "Vous avez déjà laissé un avis pour ce séjour." }, true);
      return;
    }
    lock.current = false;
    setBusy(false);
    setError(
      r.reason === "refused"
        ? "Seul un séjour terminé, réservé avec votre compte, peut être noté."
        : "Votre avis n'a pas pu être publié. Réessayez dans un instant.",
    );
  }

  return (
    <DialogShell labelledBy="rev-title" describedBy="rev-desc" onClose={busy ? () => undefined : onClose}>
      <div className="max-h-[80vh] overflow-y-auto">
        <h2 id="rev-title" className="text-lg font-black text-slate-950">Votre séjour</h2>
        <p id="rev-desc" className="text-sm text-slate-500">{booking.hotelName || "Établissement"} — avis vérifié, adossé à votre réservation.</p>
        <div className="mt-4 flex flex-col items-center">
          <StarPicker value={rating} onChange={setRating} label="Note globale" />
          <p className="mt-1 text-sm font-bold text-slate-700">{starPickLabel(rating)}</p>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-800">Détaillez si vous le souhaitez</p>
        <p className="text-xs text-slate-500">Facultatif — laissez vide ce que vous ne voulez pas noter.</p>
        <div className="mt-2 space-y-1">
          {SUB_RATINGS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-700">{label}</span>
              <StarPicker size="sm" value={subs[k]} onChange={(n) => setSubs((s) => ({ ...s, [k]: n }))} label={label} />
            </div>
          ))}
        </div>
        <label htmlFor={commentId} className="mt-4 block text-sm font-bold text-slate-800">Commentaire (facultatif)</label>
        <Textarea
          id={commentId}
          className="mt-1.5"
          maxLength={800}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Racontez votre séjour aux prochains voyageurs"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{comment.length}/800</p>
        {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Plus tard
          </Button>
          <Button type="button" onClick={publish} disabled={busy}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Publier mon avis
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

// ══════════════════════════════════════════════════════════════════════

function Shell({ children, reference }: { children: React.ReactNode; reference?: string }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <Breadcrumbs items={[{ label: "Hôtels", href: "/hotels" }, { label: "Mes réservations", href: "/hotels/bookings" }, { label: reference ?? "Réservation" }]} />
      {children}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-black text-slate-950">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-black text-slate-950" : "text-right font-semibold text-slate-800"}>{value}</span>
    </div>
  );
}
