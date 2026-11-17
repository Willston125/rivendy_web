"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import {
  fetchBoostStatus, fetchMyEntitlements, fetchPlusCatalog, type BoostStatus, type MyEntitlements,
} from "@/features/plus/plus-api";
import { benefitGroups, type PlusOffer } from "@/features/plus/plus-logic";
import { formatMoney } from "@/lib/utils/format";
import {
  attachPaymentProof,
  fetchPendingPaymentRequest,
  uploadPaymentProof,
  type PendingPaymentRequest,
} from "@/lib/supabase/payment-proof";
import { PendingPaymentBanner } from "@/features/seller/payment-proof-field";

/*
 * « Rivendy+ pour vendre » (formules simplifiées, lot 3, 2026-11-17, d'après
 * le canevas validé) : remplace l'ancienne page d'abonnement vendeur. Les
 * formules Certifié et Pro ne se vendent plus (grille du 15/11) : le badge
 * certifié, les boosts et les autres avantages vendeur viennent avec
 * Rivendy+. Un Certifié ou Pro en cours garde tous les avantages vendeur de
 * Rivendy+ jusqu'à sa fin ; une demande envoyée avant reste affichée tant que
 * l'équipe ne l'a pas traitée.
 */

const TIER_NAMES: Record<string, string> = { certified: "Certifié", pro: "Pro" };
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function SubscriptionView() {
  const { user } = useAuth();
  const { countries } = useCountry();
  const [ent, setEnt] = useState<MyEntitlements | null>(null);
  const [boosts, setBoosts] = useState<BoostStatus | null>(null);
  const [offer, setOffer] = useState<PlusOffer | null>(null);
  const [market, setMarket] = useState<{ id?: string; currency?: string }>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingPaymentRequest | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([fetchMyEntitlements(), fetchBoostStatus(), fetchPlusCatalog(null),
      fetchPendingPaymentRequest("seller_subscriptions", user.id)]).then(([e, b, c, p]) => {
      if (!alive) return;
      setEnt(e);
      setBoosts(b);
      setOffer((c.offers ?? []).find((o) => o.kind === "subscription") ?? null);
      setMarket({ id: c.market, currency: c.currency });
      setPending(p);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);

  async function addProofToPending(file: File) {
    if (!user || !pending) return;
    setAttaching(true);
    setMessage(null);
    const path = await uploadPaymentProof(user.id, file);
    const err = path ? await attachPaymentProof("subscription", pending.id, path) : "upload";
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

  const marketCountry = countries.find((c) => c.id === market.id) ?? null;
  const money = (amount: number) =>
    formatMoney(amount, marketCountry ?? { currency_code: market.currency ?? "", currency_symbol: "" });
  const sell = offer ? benefitGroups(offer.entitlements ?? {}, money).sell : [];
  const plusActive = !!ent?.active_until;
  const legacy = !plusActive && ent?.legacy_seller ? ent.legacy_seller : null;
  const allowance = Number(boosts?.allowance ?? 0);
  const remaining = Number(boosts?.remaining ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 md:px-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-[#00796B]">Rivendy+</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Rivendy+ pour vendre</h1>
      </div>

      {pending && (
        <PendingPaymentBanner title="Demande d’abonnement en attente" request={pending} busy={attaching} onAddProof={addProofToPending} />
      )}
      {message && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-semibold ${message.ok ? "bg-[#E0F2F1] text-[#00695C]" : "bg-red-50 text-red-600"}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
      ) : plusActive ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="flex items-center gap-2 text-lg font-black text-slate-950">
            <BadgeCheck className="h-5 w-5 text-[#00796B]" aria-hidden /> Compte certifié jusqu’au {dateFr(ent!.active_until!)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {allowance > 0 ? `${remaining} boost${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""} sur ${allowance} ce mois-ci · ` : ""}
            <Link href="/plus/abonnement" className="font-extrabold text-[#00796B]">Mon Rivendy+</Link>
          </p>
        </div>
      ) : legacy ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-lg font-black text-slate-950">
            Votre abonnement {TIER_NAMES[legacy.tier ?? ""] ?? "vendeur"} court{legacy.until ? ` jusqu’au ${dateFr(legacy.until)}` : ""}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Il a déjà tous les avantages vendeur de Rivendy+. Ensuite, passez à Rivendy+ : Play et la Musique sans publicité en plus.
          </p>
          <Link href="/plus" className="mt-4 inline-flex h-11 items-center rounded-full bg-[#00796B] px-5 text-sm font-black text-white hover:bg-[#00695C]">
            Découvrir Rivendy+
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-lg font-black text-slate-950">Vendez plus avec Rivendy+</p>
          {sell.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {sell.map((b) => (
                <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00796B]" aria-hidden />{b}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Rivendy+ arrive bientôt dans votre pays.</p>
          )}
          {offer ? (
            <>
              <p className="mt-4 text-2xl font-black text-slate-950">{money(offer.price)} <span className="text-sm font-bold text-slate-500">/ mois</span></p>
              <Link href="/plus#payer" className="mt-3 inline-flex h-12 items-center rounded-full bg-[#00796B] px-6 text-sm font-black text-white hover:bg-[#00695C]">
                Choisir Rivendy+
              </Link>
            </>
          ) : null}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Les formules Certifié et Pro ne se vendent plus : Rivendy+ les remplace.
      </p>
    </div>
  );
}
