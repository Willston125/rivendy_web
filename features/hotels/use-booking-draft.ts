"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getHotelById, getPaymentOptions, getRooms, getServices } from "@/lib/hotels/catalog";
import { requestQuote } from "@/lib/hotels/booking";
import { parseBookingDraft, type BookingDraft } from "@/lib/hotels/search-params";
import type { Hotel, HotelPaymentOption, HotelQuote, HotelRoom, HotelServiceItem } from "@/lib/hotels/types";

export type DraftStatus = "loading" | "ready" | "missing" | "not_found" | "error";

/** Brouillon lu dans l'URL — il survit au rechargement et au détour par la connexion. */
export function useDraftFromUrl(): { draft: BookingDraft | null; currentUrl: string } {
  const params = useSearchParams();
  const pathname = usePathname();
  const qs = params.toString();
  const draft = useMemo(() => parseBookingDraft(new URLSearchParams(qs)), [qs]);
  const currentUrl = `${pathname}${qs ? `?${qs}` : ""}`;
  return { draft, currentUrl };
}

/**
 * Charge ce dont une étape a besoin : l'hôtel (vue publique), ses chambres
 * actives, et selon l'étape ses services ou ses moyens de paiement.
 */
export function useDraftContext(
  draft: BookingDraft | null,
  { withServices = false, withPayment = false }: { withServices?: boolean; withPayment?: boolean } = {},
) {
  const [status, setStatus] = useState<DraftStatus>(draft ? "loading" : "missing");
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [services, setServices] = useState<HotelServiceItem[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<HotelPaymentOption[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const hotelId = draft?.hotelId ?? null;

  useEffect(() => {
    if (!hotelId) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      getHotelById(supabase, hotelId),
      getRooms(supabase, hotelId),
      withServices ? getServices(supabase, hotelId) : Promise.resolve([] as HotelServiceItem[]),
      withPayment ? getPaymentOptions(supabase, hotelId) : Promise.resolve([] as HotelPaymentOption[]),
    ])
      .then(([h, r, s, p]) => {
        if (cancelled) return;
        if (!h) {
          setStatus("not_found");
          return;
        }
        setHotel(h);
        setRooms(r);
        setServices(s);
        setPaymentOptions(p);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [hotelId, withServices, withPayment, reloadToken]);

  const room = useMemo(() => rooms.find((r) => r.id === draft?.roomId) ?? null, [rooms, draft?.roomId]);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { status, hotel, rooms, room, services, paymentOptions, reload };
}

/**
 * Devis SERVEUR (`hotel_quote`) relancé à chaque changement de chambre, de
 * dates, de voyageurs ou de services. Un compteur de génération empêche
 * une réponse en retard d'afficher un ancien total (cocher puis décocher
 * vite un service).
 *
 * ⚠️ `quote.ok === true` ne veut PAS dire « disponible » : la RPC renvoie
 * `is_available: false` quand l'inventaire manque. L'appelant doit tester
 * les deux.
 */
export function useServerQuote(draft: BookingDraft | null, enabled: boolean) {
  const [quote, setQuote] = useState<HotelQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [token, setToken] = useState(0);
  const generation = useRef(0);

  const key = draft
    ? JSON.stringify([draft.roomId, draft.checkIn, draft.checkOut, draft.adults, draft.children, draft.rooms, [...draft.serviceIds].sort()])
    : null;

  useEffect(() => {
    if (!enabled || !draft || !draft.roomId || !key) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const gen = ++generation.current;
    setQuoting(true);
    requestQuote(supabase, {
      roomId: draft.roomId,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      adults: draft.adults,
      children: draft.children,
      roomsCount: draft.rooms,
      serviceIds: draft.serviceIds,
    }).then((q) => {
      if (gen !== generation.current) return;
      setQuote(q);
      setQuoting(false);
    });
    // `key` résume le brouillon utile au devis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, token]);

  const refresh = useCallback(() => setToken((t) => t + 1), []);
  return { quote, quoting, refresh };
}
