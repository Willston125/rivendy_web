"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { validateStayDates, nightCount } from "@/lib/hotels/availability";
import { addDaysSql, addMonthsSql, compareSql, guestsLabel, nightsLabel, todaySql } from "@/lib/hotels/dates";
import { MAX_ADULTS, MAX_CHILDREN, MAX_ROOMS, normalizeGuests, type Guests } from "@/lib/hotels/search-params";
import { Stepper } from "./hotel-ui";

export interface StayFormValue extends Guests {
  destination: string;
  checkIn: string | null;
  checkOut: string | null;
}

/** Aujourd'hui en date LOCALE, connu seulement après montage (pas d'écart serveur/navigateur). */
export function useTodaySql(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(todaySql());
  }, []);
  return today;
}

/**
 * Bornes du sélecteur de voyageurs de l'app : au moins 1 adulte et 1
 * chambre, jamais plus de chambres que d'adultes. Retirer une chambre
 * remonte les adultes plutôt que de bloquer (miroir `HotelGuestSelectorSheet._bump`).
 */
function bump(g: Guests, key: keyof Guests, next: number): Guests {
  if (key === "rooms") {
    const rooms = Math.min(MAX_ROOMS, Math.max(1, next));
    return normalizeGuests({ ...g, rooms, adults: Math.max(g.adults, rooms) });
  }
  if (key === "adults") {
    const adults = Math.min(MAX_ADULTS, Math.max(1, next));
    return normalizeGuests({ ...g, adults, rooms: Math.min(g.rooms, adults) });
  }
  return normalizeGuests({ ...g, children: next });
}

/** Sélecteur de voyageurs en panneau dépliant. */
export function GuestPicker({ value, onChange }: { value: Guests; onChange: (g: Guests) => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]"
      >
        <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate">{guestsLabel(value.adults, value.children, value.rooms)}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:left-auto sm:w-80"
        >
          <Stepper label="Chambres" value={value.rooms} min={1} max={MAX_ROOMS} onChange={(n) => onChange(bump(value, "rooms", n))} />
          <Stepper label="Adultes" hint="18 ans et plus" value={value.adults} min={1} max={MAX_ADULTS} onChange={(n) => onChange(bump(value, "adults", n))} />
          <Stepper label="Enfants" hint="0 à 17 ans" value={value.children} min={0} max={MAX_CHILDREN} onChange={(n) => onChange(bump(value, "children", n))} />
          <Button type="button" size="sm" className="mt-2 w-full" onClick={() => setOpen(false)}>
            Valider
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Deux champs de date natifs, bornés à aujourd'hui → +12 mois (comme le calendrier de l'app). */
export function StayDatesFields({
  checkIn,
  checkOut,
  onChange,
  today,
}: {
  checkIn: string | null;
  checkOut: string | null;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
  today: string | null;
}) {
  const inId = useId();
  const outId = useId();
  const max = today ? addMonthsSql(today, 12) : undefined;
  const nights = checkIn && checkOut ? nightCount(checkIn, checkOut) : 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <label htmlFor={inId} className="block">
        <span className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Arrivée
        </span>
        <input
          id={inId}
          type="date"
          value={checkIn ?? ""}
          min={today ?? undefined}
          max={max}
          onChange={(e) => {
            const next = e.target.value || null;
            // Départ incohérent avec la nouvelle arrivée : on le recale au lendemain.
            const out = next && (!checkOut || compareSql(checkOut, next) <= 0) ? addDaysSql(next, 1) : checkOut;
            onChange(next, out);
          }}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]"
        />
      </label>
      <label htmlFor={outId} className="block">
        <span className="mb-1 flex items-center justify-between gap-1 text-xs font-bold text-slate-600">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Départ
          </span>
          {nights > 0 ? <span className="font-semibold text-[#007168]">{nightsLabel(nights)}</span> : null}
        </span>
        <input
          id={outId}
          type="date"
          value={checkOut ?? ""}
          min={checkIn ? addDaysSql(checkIn, 1) : today ? addDaysSql(today, 1) : undefined}
          max={max}
          onChange={(e) => onChange(checkIn, e.target.value || null)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]"
        />
      </label>
    </div>
  );
}

/**
 * Carte de recherche : destination, dates, voyageurs. Les dates sont
 * OBLIGATOIRES pour lancer la recherche (comme l'app) : sans elles on ne
 * peut pas parler de disponibilité. On l'explique au lieu d'un bouton mort.
 */
export function HotelSearchForm({
  value,
  onChange,
  onSubmit,
  submitLabel = "Rechercher",
  className,
}: {
  value: StayFormValue;
  onChange: (next: StayFormValue) => void;
  onSubmit: (value: StayFormValue) => void;
  submitLabel?: string;
  className?: string;
}) {
  const today = useTodaySql();
  const [error, setError] = useState<string | null>(null);
  const destId = useId();
  const errorId = useId();

  return (
    <form
      noValidate
      className={cn("rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.checkIn || !value.checkOut) {
          setError("Choisissez vos dates pour voir les disponibilités.");
          return;
        }
        const problem = validateStayDates({ checkIn: value.checkIn, checkOut: value.checkOut, today: today ?? undefined });
        if (problem) {
          setError(problem);
          return;
        }
        setError(null);
        onSubmit(value);
      }}
    >
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1.6fr_1fr_auto] lg:items-end">
        <label htmlFor={destId} className="block">
          <span className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Destination
          </span>
          <input
            id={destId}
            type="search"
            value={value.destination}
            maxLength={80}
            placeholder="Ville, région ou hôtel"
            onChange={(e) => onChange({ ...value, destination: e.target.value })}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009688]"
          />
        </label>
        <StayDatesFields
          checkIn={value.checkIn}
          checkOut={value.checkOut}
          today={today}
          onChange={(checkIn, checkOut) => {
            setError(null);
            onChange({ ...value, checkIn, checkOut });
          }}
        />
        <div>
          <span className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600">
            <Users className="h-3.5 w-3.5" aria-hidden /> Voyageurs
          </span>
          <GuestPicker value={value} onChange={(g) => onChange({ ...value, ...g })} />
        </div>
        <Button type="submit" className="w-full lg:w-auto" aria-describedby={error ? errorId : undefined}>
          <Search className="h-4 w-4" aria-hidden />
          {submitLabel}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
