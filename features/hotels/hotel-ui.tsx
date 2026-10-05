"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  Accessibility,
  ArrowUpDown,
  Bus,
  Check,
  CircleParking,
  Coffee,
  ConciergeBell,
  Dumbbell,
  Hotel as HotelIcon,
  Minus,
  PawPrint,
  Plus,
  Presentation,
  Snowflake,
  Sparkles,
  Star,
  Umbrella,
  UtensilsCrossed,
  WashingMachine,
  WavesHorizontal,
  WavesLadder,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import { formatHotelMoney } from "@/lib/hotels/money";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  bookingStatusTone,
  paymentStatusTone,
} from "@/lib/hotels/labels";
import type { BookingStatus, PaymentStatus } from "@/lib/hotels/types";

/**
 * Image d'hôtel. `next/image` n'accepte que l'hôte Supabase : une photo
 * hôtelière peut venir d'ailleurs (saisie au dashboard), d'où `<img>`.
 * Sans URL ou en cas d'échec : un dégradé de marque, jamais un carré gris.
 */
export function HotelImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-gradient-to-br from-[#009688] to-[#007168] text-white/80", className)}
      >
        <HotelIcon className="h-8 w-8" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />
  );
}

/** Étoiles de classement — affichées UNIQUEMENT si l'hôtel est classé. */
export function StarRow({ count, className }: { count: number | null; className?: string }) {
  if (count == null || count <= 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${count} étoile${count > 1 ? "s" : ""}`}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
      ))}
    </span>
  );
}

const AMENITY_ICONS: Record<string, LucideIcon> = {
  pool: WavesLadder,
  wifi: Wifi,
  ac_unit: Snowflake,
  local_parking: CircleParking,
  restaurant: UtensilsCrossed,
  fitness_center: Dumbbell,
  spa: Sparkles,
  waves: WavesHorizontal,
  beach_access: Umbrella,
  airport_shuttle: Bus,
  free_breakfast: Coffee,
  pets: PawPrint,
  elevator: ArrowUpDown,
  local_laundry_service: WashingMachine,
  room_service: ConciergeBell,
  meeting_room: Presentation,
  accessible: Accessibility,
};

/** Icône d'un équipement : un code inconnu donne une coche, jamais un plantage. */
export function AmenityIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = AMENITY_ICONS[icon] ?? Check;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}

/** Statut du séjour et statut du paiement, côte à côte, JAMAIS fusionnés. */
export function StatusPills({ booking, payment }: { booking: BookingStatus; payment: PaymentStatus }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", bookingStatusTone(booking))}>
        {BOOKING_STATUS_LABELS[booking]}
      </span>
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", paymentStatusTone(payment))}>
        {PAYMENT_STATUS_LABELS[payment]}
      </span>
    </span>
  );
}

/** Bloc d'état (vide, erreur, brouillon perdu) avec action facultative. */
export function StateBlock({
  icon: Icon,
  title,
  message,
  action,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  tone?: "neutral" | "error";
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          tone === "error" ? "bg-red-50 text-red-600" : "bg-[#E0F2F1] text-[#007168]",
        )}
      >
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-black text-slate-950">{title}</h2>
      {message ? <p className="mt-2 text-sm text-slate-500">{message}</p> : null}
      {action ? (
        action.href ? (
          <Link href={action.href} className={buttonVariants({ variant: "outline", className: "mt-5" })}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={buttonVariants({ variant: "outline", className: "mt-5" })}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}

/** Squelette de cartes — jamais un spinner seul au milieu de l'écran. */
export function CardSkeletons({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-44 animate-pulse bg-slate-100" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** Compteur +/− avec cibles de 44 px. */
export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Retirer : ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-6 text-center text-sm font-black text-slate-950" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Ajouter : ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Formateur de montants hôteliers, lié à la liste des pays chargée par le site. */
export function useHotelMoney() {
  const { countries } = useCountry();
  return useCallback(
    (amount: number, currency: string, countryId: string | null | undefined) =>
      formatHotelMoney(amount, currency, countryId, countries),
    [countries],
  );
}

/** Étapes du parcours de réservation. */
export function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Chambre", "Services", "Confirmation"];
  return (
    <ol className="mb-5 flex items-center gap-2 text-xs font-bold" aria-label="Étapes de la réservation">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                state === "todo" ? "bg-slate-100 text-slate-500" : "bg-[#009688] text-white",
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
            </span>
            <span className={state === "current" ? "text-slate-950" : "text-slate-500"}>{label}</span>
            {i < steps.length - 1 ? <span className="h-px w-5 bg-slate-200" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
