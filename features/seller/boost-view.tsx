"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Zap } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { fetchBoostStatus, type BoostStatus } from "@/features/plus/plus-api";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import {
  attachPaymentProof,
  fetchPendingPaymentRequest,
  uploadPaymentProof,
  type PendingPaymentRequest,
} from "@/lib/supabase/payment-proof";
import { PendingPaymentBanner } from "@/features/seller/payment-proof-field";
import type { Product } from "@/types/rivendy";

/*
 * Booster une annonce (formules simplifiées, lot 3, 2026-11-17, d'après le
 * canevas validé). Grille du 15/11 : les boosts payants à l'unité sont
 * SUPPRIMÉS ; on ne booste plus qu'avec les boosts inclus — 5 de 3 jours par
 * mois avec Rivendy+ (ou un ancien Certifié / Pro en cours), aucun en gratuit.
 * Le décompte vit côté serveur : get_boost_credit_status / use_boost_credit
 * (fichier 20261115_1100_formules_2_vendeurs.sql). Une demande payante
 * envoyée avant reste affichée tant que l'équipe ne l'a pas traitée.
 */

// Codes RAISE EXCEPTION de use_boost_credit → messages affichables.
const CREDIT_ERRORS: Record<string, string> = {
  NO_ACTIVE_SUBSCRIPTION: "Les boosts sont inclus dans Rivendy+ : il faut un abonnement actif pour booster.",
  NOT_PRODUCT_OWNER: "Ce produit n'appartient pas à votre boutique.",
  PRODUCT_NOT_BOOSTABLE: "Seul un article en vente, et pas déjà boosté, peut recevoir un boost.",
  NO_CREDITS_LEFT: "Vos boosts du mois sont utilisés : ils reviennent au prochain cycle.",
};

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const dayMonthHour = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function BoostView({ product }: { product: Product }) {
  const { user } = useAuth();
  const country = useCountryOrDefault();
  const [status, setStatus] = useState<BoostStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [using, setUsing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [boostedUntil, setBoostedUntil] = useState<string | null>(
    product.status === "boosted" && product.boost_expires_at && new Date(product.boost_expires_at) > new Date()
      ? product.boost_expires_at
      : null,
  );
  // Ancienne demande de boost payant, en attente de vérification.
  const [pending, setPending] = useState<PendingPaymentRequest | null>(null);
  const [attaching, setAttaching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const s = await fetchBoostStatus();
    setStatus(s);
    setLoaded(true);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchPendingPaymentRequest("boost_purchases", user.id, product.id).then((p) => {
      if (!cancelled) setPending(p);
    });
    return () => { cancelled = true; };
  }, [user, product.id]);

  async function addProofToPending(file: File) {
    if (!user || !pending) return;
    setAttaching(true);
    setMessage(null);
    const path = await uploadPaymentProof(user.id, file);
    const err = path ? await attachPaymentProof("boost", pending.id, path) : "upload";
    setAttaching(false);
    if (err || !path) {
      setMessage({
        ok: false,
        text: err === "request_not_pending"
          ? "Cette demande a déjà été traitée par l'équipe Rivendy."
          : "La capture n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
      });
      return;
    }
    setPending({ ...pending, payment_proof_path: path });
    setMessage({ ok: true, text: "Capture envoyée ✓ — l'équipe Rivendy vérifie votre paiement." });
  }

  // Miroir de la condition serveur : seul un produit 'active' se booste (pas
  // de produit suspendu ou épuisé, pas d'empilement sur un boost en cours).
  const boostable = product.status === "active" && !boostedUntil;
  const allowance = Number(status?.allowance ?? 0);
  const remaining = Number(status?.remaining ?? 0);
  const days = Number(status?.boost_days ?? 3) || 3;
  const legacy = status?.source === "legacy_certified" || status?.source === "legacy_pro";

  async function boost() {
    if (!user || using) return;
    setUsing(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc("use_boost_credit", { p_product_id: product.id });
      if (error) throw error;
      const res = (data ?? {}) as { remaining?: number; boost_expires_at?: string };
      setConfirm(false);
      if (res.boost_expires_at) setBoostedUntil(res.boost_expires_at);
      setStatus((s) => (s ? { ...s, remaining: Number(res.remaining ?? 0), used: Number(s.used ?? 0) + 1 } : s));
      setMessage({ ok: true, text: `Boost de ${days} jours activé. ${Number(res.remaining ?? 0)} restant${Number(res.remaining ?? 0) > 1 ? "s" : ""} ce mois-ci.` });
    } catch (err) {
      const raw = (err as { message?: string })?.message ?? "";
      const known = Object.keys(CREDIT_ERRORS).find((k) => raw.includes(k));
      setConfirm(false);
      setMessage({ ok: false, text: known ? CREDIT_ERRORS[known] : "Le boost a échoué, réessayez." });
      void load();
    } finally {
      setUsing(false);
    }
  }

  if (!country) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#00796B]">Rivendy</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Booster mon annonce</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <Image src={firstPhoto(product)} alt={product.title} fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-[#1A1A1A]">{product.title}</p>
          <p className="mt-1 text-base font-black text-[#00796B]">{formatMoney(product.price, country)}</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li>Mis en avant {days} jours</li>
          <li>Badge « Boosté » sur l’annonce</li>
          <li>Priorité dans les résultats</li>
        </ul>
      </div>

      {pending && (
        <PendingPaymentBanner title="Demande de boost en attente" request={pending} busy={attaching} onAddProof={addProofToPending} />
      )}

      {message && (
        <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm font-semibold ${message.ok ? "bg-[#E0F2F1] text-[#00695C]" : "bg-red-50 text-red-600"}`}>
          {message.text}
        </p>
      )}

      {!loaded ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
      ) : allowance > 0 ? (
        <div className={`rounded-2xl border-2 bg-white p-5 ${boostable && remaining > 0 ? "border-[#00796B]" : "border-slate-200"}`}>
          {boostedUntil ? (
            <>
              <p className="text-lg font-black text-slate-950">Boosté jusqu’au {dayMonthHour(boostedUntil)}</p>
              <p className="mt-1 text-sm text-slate-600">Un boost à la fois par article. {remaining} boost{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""} ce mois-ci pour vos autres articles.</p>
            </>
          ) : remaining > 0 ? (
            <>
              <p className="text-3xl font-black text-slate-950">
                {remaining} <span className="text-base font-bold text-slate-500">boost{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""} sur {allowance}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {status?.cycle_end ? `Jusqu’au ${dayMonth(status.cycle_end)}. Ensuite, ${allowance} nouveaux boosts.` : "Chaque mois, de nouveaux boosts."}
                {legacy ? ` Avec votre abonnement ${status?.source === "legacy_pro" ? "Pro" : "Certifié"} en cours.` : ""}
              </p>
              {!boostable ? (
                <p className="mt-2 text-sm font-semibold text-orange-700">Seul un article en vente peut recevoir un boost.</p>
              ) : !confirm ? (
                <button type="button" onClick={() => setConfirm(true)} disabled={using}
                  className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-[#00796B] px-6 text-sm font-black text-white hover:bg-[#00695C] disabled:opacity-60">
                  <Zap className="h-[18px] w-[18px]" aria-hidden /> Booster {days} jours
                </button>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">
                    Votre article sera mis en avant pendant {days} jours. Il vous restera <strong>{remaining - 1}</strong> boost{remaining - 1 > 1 ? "s" : ""} ce mois-ci.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={boost} disabled={using}
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-[#00796B] px-5 text-sm font-black text-white hover:bg-[#00695C] disabled:opacity-60">
                      {using ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />} Confirmer
                    </button>
                    <button type="button" onClick={() => setConfirm(false)} disabled={using}
                      className="h-11 rounded-full border border-slate-300 px-5 text-sm font-bold text-slate-600 hover:bg-white">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">{legacy ? "Inclus dans votre abonnement" : "Inclus dans Rivendy+"} : rien à payer.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-black text-slate-950">Vos {allowance} boosts du mois sont utilisés</p>
              <p className="mt-1 text-sm text-slate-600">
                {status?.cycle_end ? `${allowance} nouveaux boosts le ${dayMonth(status.cycle_end)}.` : "De nouveaux boosts arrivent au prochain cycle."}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-lg font-black text-slate-950">Les boosts sont inclus dans Rivendy+</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Des boosts chaque mois, le badge certifié, les stories de 72 h et les livraisons offertes, avec un seul abonnement.
          </p>
          <Link href="/plus" className="mt-4 inline-flex h-12 items-center rounded-full bg-[#00796B] px-6 text-sm font-black text-white hover:bg-[#00695C]">
            Découvrir Rivendy+
          </Link>
          <p className="mt-3 text-xs text-slate-500">Il n’y a plus de boost à payer à l’unité.</p>
        </div>
      )}
    </div>
  );
}
