"use client";

import { useState } from "react";
import { BedDouble, X, Loader2, Minus, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/features/country/country-provider";
import { normalizePhoneForWhatsApp } from "@/lib/utils/format";

const NEEDS_OPTIONS = ["Chambre vue mer", "Lit bébé", "Arrivée tardive", "Petit-déjeuner", "Navette aéroport"];

/**
 * Demande de réservation hôtel (parité HotelReservationRequestSheet Flutter).
 * Trace la demande dans `hotel_reservation_requests` (best-effort) puis ouvre
 * WhatsApp vers l'AGENCE Rivendy — jamais l'hôtel en direct.
 */
export function HotelReservationForm({
  sellerId,
  hotelName,
  room,
  triggerLabel,
  className,
}: {
  sellerId: string;
  hotelName: string;
  room?: { id: string; title: string } | null;
  triggerLabel: string;
  className?: string;
}) {
  const { country } = useCountry();
  const [open, setOpen] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [needs, setNeeds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const valid = Boolean(checkIn) && Boolean(checkOut) && name.trim() !== "" && phone.trim() !== "";
  const agency = country?.whatsapp_number ?? "";

  function toggleNeed(n: string) {
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function send() {
    if (!valid || sending) return;
    setSending(true);

    let requestNumber: string | null = null;
    try {
      const { data } = await supabase
        .from("hotel_reservation_requests")
        .insert({
          hotel_seller_id: sellerId,
          hotel_name: hotelName,
          room_product_id: room?.id ?? null,
          room_name: room?.title ?? null,
          buyer_name: name.trim(),
          buyer_phone: phone.trim(),
          check_in: checkIn,
          check_out: checkOut,
          adults,
          children,
          special_needs: needs,
          notes: message.trim() || null,
          country_id: country?.id ?? null,
        })
        .select("request_number")
        .single();
      requestNumber = (data?.request_number as string | undefined) ?? null;
    } catch {
      // ignoré — best-effort
    }

    const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "");
    const lines = [
      "🏨 *Demande de réservation Rivendy*",
      ...(requestNumber ? [`📋 Réf : ${requestNumber}`] : []),
      `Hôtel : ${hotelName}`,
      ...(room ? [`Chambre : ${room.title}`] : []),
      `Arrivée : ${fmt(checkIn)}`,
      `Départ : ${fmt(checkOut)}`,
      `Personnes : ${adults} adulte${adults > 1 ? "s" : ""}${children > 0 ? ` · ${children} enfant${children > 1 ? "s" : ""}` : ""}`,
      `Client : ${name.trim()}`,
      `Téléphone : ${phone.trim()}`,
      ...(needs.length > 0 ? [`Besoins : ${needs.join(", ")}`] : []),
      ...(message.trim() ? [`Message : ${message.trim()}`] : []),
    ];

    const wa = normalizePhoneForWhatsApp(agency);
    if (wa) {
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
    }
    setSending(false);
    setDone(requestNumber);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => !sending && setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <BedDouble className="h-4 w-4 text-[#007168]" />
                Demande de réservation
              </h3>
              <button onClick={() => !sending && setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs font-medium text-slate-500">
              {hotelName}
              {room ? ` — ${room.title}` : ""}
            </p>

            {done !== null ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm font-bold text-[#007168]">
                  {done ? `Demande ${done} envoyée ✓` : "Votre demande a été envoyée à Rivendy ✓"}
                </p>
                <p className="text-xs text-slate-500">Rivendy vous confirmera la disponibilité rapidement.</p>
                <button onClick={() => { setOpen(false); setDone(null); }} className="mt-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">Fermer</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Arrivée</span>
                    <input type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && checkOut < e.target.value) setCheckOut(""); }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Départ</span>
                    <input type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Adultes</span>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setAdults((n) => Math.max(1, n - 1))} className="rounded-lg p-1 hover:bg-slate-100"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="text-sm font-bold text-slate-800">{adults}</span>
                      <button type="button" onClick={() => setAdults((n) => n + 1)} className="rounded-lg p-1 hover:bg-slate-100"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Enfants</span>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setChildren((n) => Math.max(0, n - 1))} className="rounded-lg p-1 hover:bg-slate-100"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="text-sm font-bold text-slate-800">{children}</span>
                      <button type="button" onClick={() => setChildren((n) => n + 1)} className="rounded-lg p-1 hover:bg-slate-100"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Besoins particuliers (optionnel)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {NEEDS_OPTIONS.map((n) => (
                      <button key={n} type="button" onClick={() => toggleNeed(n)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${needs.includes(n) ? "border-[#009688] bg-[#009688]/10 text-[#009688]" : "border-slate-200 text-slate-600"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" inputMode="tel"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optionnel)" rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                <button onClick={send} disabled={!valid || sending}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00897B] disabled:bg-slate-300">
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : "Envoyer la demande via Rivendy"}
                </button>
                <p className="text-center text-[11px] text-slate-400">Votre demande est traitée par Rivendy.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
