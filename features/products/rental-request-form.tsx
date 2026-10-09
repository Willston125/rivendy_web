"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import type { Product } from "@/types/rivendy";

type Outcome = { kind: "recorded"; ref: string | null };

/**
 * Demande de location (parité RentalRequestSheet Flutter). La demande est
 * ENREGISTRÉE pour Rivendy (dashboard → Demandes location), et c'est tout :
 * depuis le 2026-10-09, plus aucune demande ne passe par WhatsApp. Rivendy
 * rappelle le client au numéro saisi.
 *
 * Corrigé le 2026-10-04 (audit de parité) :
 *  - l'enregistrement relisait la ligne (`insert().select()`) alors que
 *    `rental_requests` n'a AUCUNE policy SELECT : Postgres refusait tout
 *    l'INSERT (42501), l'erreur était avalée — aucune demande n'a jamais été
 *    enregistrée, sur le site comme dans l'app. Désormais : RPC
 *    `create_rental_request` (référence renvoyée par le serveur) et, tant
 *    qu'elle n'est pas déployée, INSERT sans relecture ;
 *  - « Demande envoyée ✓ » s'affichait même sans numéro d'agence et quand le
 *    navigateur bloquait WhatsApp (ouvert APRÈS un await) : l'onglet est
 *    désormais ouvert dans le clic, et le message dit ce qui s'est passé ;
 *  - la policy INSERT est réservée aux comptes connectés : on le demande.
 */
export function RentalRequestForm({ product }: { product: Product }) {
  const { user, profile } = useAuth();
  const { country } = useCountry();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState("");
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.whatsapp_number ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState("");

  const valid = name.trim() !== "" && phone.trim() !== "";

  async function record(): Promise<{ ok: boolean; ref: string | null }> {
    const params = {
      p_item_product_id: product.id,
      p_item_name: product.title,
      p_buyer_name: name.trim(),
      p_buyer_phone: phone.trim(),
      p_start_date: start || null,
      p_end_date: end || null,
      p_duration_text: duration.trim() || null,
      p_notes: message.trim() || null,
      p_country_id: product.country_id || country?.id || null,
    };
    const { data, error: rpcError } = await supabase.rpc("create_rental_request", params);
    if (!rpcError) {
      const res = data as { success?: boolean; request_number?: string } | null;
      return { ok: res?.success === true, ref: res?.request_number ?? null };
    }
    // RPC pas encore déployée (PGRST202) : INSERT SANS relecture — la seule
    // forme que la policy actuelle accepte. Pas de référence dans ce cas.
    if (rpcError.code === "PGRST202" || /could not find the function/i.test(rpcError.message)) {
      const { error: insertError } = await supabase.from("rental_requests").insert({
        owner_seller_id: product.seller_id,
        item_product_id: product.id,
        item_name: product.title,
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        start_date: start || null,
        end_date: end || null,
        duration_text: duration.trim() || null,
        notes: message.trim() || null,
        country_id: product.country_id || country?.id || null,
      });
      return { ok: !insertError, ref: null };
    }
    return { ok: false, ref: null };
  }

  async function send() {
    if (!valid || sending || !user) return;
    setSending(true);
    setError("");

    const { ok, ref } = await record();

    setSending(false);
    if (ok) {
      setOutcome({ kind: "recorded", ref });
    } else {
      setError("La demande n'a pas pu être envoyée. Réessayez dans un moment.");
    }
  }

  const loginHref = `/auth/login?next=${encodeURIComponent(`/products/${product.id}`)}`;

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

            {!user ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm text-slate-600">Connectez-vous pour envoyer une demande de location.</p>
                <Link href={loginHref} className="inline-flex rounded-xl bg-[#009688] px-4 py-2 text-sm font-bold text-white">
                  Se connecter
                </Link>
              </div>
            ) : outcome ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm font-bold text-[#007168]">
                  {outcome.ref ? `Demande ${outcome.ref} enregistrée ✓` : "Votre demande est enregistrée ✓"}
                </p>
                <p className="text-xs text-slate-500">
                  Rivendy vous contactera pour confirmer la disponibilité.
                </p>
                <button onClick={() => { setOpen(false); setOutcome(null); }} className="mt-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">Fermer</button>
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
                {error && <p className="rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">{error}</p>}
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
