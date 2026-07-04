"use client";

import { useState } from "react";
import { KeyRound, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCountry } from "@/features/country/country-provider";
import { normalizePhoneForWhatsApp } from "@/lib/utils/format";
import type { Product } from "@/types/rivendy";

/**
 * Demande de location (parité RentalRequestSheet Flutter). Trace la demande
 * dans `rental_requests` (best-effort) puis ouvre WhatsApp vers l'AGENCE
 * Rivendy — jamais le propriétaire du bien. Charte de centralisation contact.
 */
export function RentalRequestForm({ product }: { product: Product }) {
  const { country } = useCountry();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const valid = name.trim() !== "" && phone.trim() !== "";
  const agency = country?.whatsapp_number ?? "";

  async function send() {
    if (!valid || sending) return;
    setSending(true);

    // Enregistrement en base — non bloquant (si RLS/échec, WhatsApp part quand même).
    let requestNumber: string | null = null;
    try {
      const { data } = await supabase
        .from("rental_requests")
        .insert({
          owner_seller_id: product.seller_id,
          item_product_id: product.id,
          item_name: product.title,
          buyer_name: name.trim(),
          buyer_phone: phone.trim(),
          start_date: start || null,
          end_date: end || null,
          duration_text: duration.trim() || null,
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
      "🔑 *Demande de location Rivendy*",
      ...(requestNumber ? [`📋 Réf : ${requestNumber}`] : []),
      `Bien : ${product.title}`,
      ...(start ? [`Début : ${fmt(start)}`] : []),
      ...(end ? [`Fin : ${fmt(end)}`] : []),
      ...(duration.trim() ? [`Durée : ${duration.trim()}`] : []),
      `Client : ${name.trim()}`,
      `Téléphone : ${phone.trim()}`,
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
      <button
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#009688] text-sm font-black text-white transition hover:bg-[#00897B]"
      >
        <KeyRound className="h-4 w-4" />
        Demander une location via Rivendy
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => !sending && setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <KeyRound className="h-4 w-4 text-[#007168]" />
                Demande de location
              </h3>
              <button onClick={() => !sending && setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs font-medium text-slate-500">{product.title}</p>

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
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Début (optionnel)</span>
                    <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">Fin (optionnel)</span>
                    <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
                  </label>
                </div>
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Durée souhaitée (ex : 3 mois)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#009688] focus:outline-none" />
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
