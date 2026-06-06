"use client";

import { useState } from "react";
import { Zap, CheckCircle2, Copy, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { firstPhoto, formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import type { BoostPurchaseInput, Product } from "@/types/rivendy";

/* ── Tiers ─────────────────────────────────────────────────── */

interface BoostTier {
  id: "bronze" | "argent" | "or";
  name: string;
  emoji: string;
  priceFDJ: number;
  priceKMF: number;
  durationDays: number;
  color: string;
  bgColor: string;
  isPopular?: boolean;
  benefits: string[];
}

// Parity Flutter boost_screen.dart — priceForMarket(marketId)
function priceForMarket(tier: BoostTier, countryId: string): number {
  return countryId === "KM" ? tier.priceKMF : tier.priceFDJ;
}

const TIERS: BoostTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    emoji: "🥉",
    priceFDJ: 500,
    priceKMF: 1250,
    durationDays: 3,
    color: "#CD7F32",
    bgColor: "#FFF8F0",
    benefits: [
      "Mis en avant pendant 3 jours",
      "Badge \"Boosté\" sur l'annonce",
      "Priorité dans les résultats",
    ],
  },
  {
    id: "argent",
    name: "Argent",
    emoji: "🥈",
    priceFDJ: 1500,
    priceKMF: 3750,
    durationDays: 7,
    color: "#9E9E9E",
    bgColor: "#F8F8F8",
    isPopular: true,
    benefits: [
      "Mis en avant pendant 7 jours",
      "Badge \"Boosté\" sur l'annonce",
      "Top du fil d'actualité",
      "Notifications push aux acheteurs",
    ],
  },
  {
    id: "or",
    name: "Or",
    emoji: "🥇",
    priceFDJ: 3000,
    priceKMF: 7500,
    durationDays: 15,
    color: "#FFB800",
    bgColor: "#FFFBEB",
    benefits: [
      "Mis en avant pendant 15 jours",
      "Badge \"Boosté Or\" sur l'annonce",
      "Position #1 dans sa catégorie",
      "Notifications push aux acheteurs",
      "Statistiques avancées de vues",
    ],
  },
];

const PAYMENT_METHODS = [
  { name: "D-Money", number: "+253 77 14 53 06", color: "#1976D2" },
  { name: "Waafi", number: "+253 77 14 53 06", color: "#388E3C" },
  { name: "CAC Pay", number: "+253 77 14 53 06", color: "#E64A19" },
];

/* ── Component ─────────────────────────────────────────────── */

export function BoostView({ product }: { product: Product }) {
  const { user } = useAuth();
  const country = useCountryOrDefault();
  const [selectedTier, setSelectedTier] = useState<BoostTier | null>(null);
  const [selectedMethod, setSelectedMethod] = useState(0);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reference = `BOOST-${product.id.slice(0, 8).toUpperCase()}-${selectedTier?.id.toUpperCase() ?? ""}`;
  const whatsapp = normalizePhoneForWhatsApp(country.whatsapp_number || "25377145306");

  function copyReference() {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePaid(tier: BoostTier) {
    if (!user) return;
    setSubmitting(true);

    try {
      const payload: BoostPurchaseInput = {
        product_id: product.id,
        seller_id: user.id,
        plan: tier.id,
        price_paid: priceForMarket(tier, country.id),
        duration_days: tier.durationDays,
        status: "pending",
        payment_method: PAYMENT_METHODS[selectedMethod].name,
        country_id: country.id,
        payment_reference: reference,
      };
      await supabase.from("boost_purchases").insert(payload);
    } catch (_) {
      // non-blocking
    }

    const msg = encodeURIComponent(
      `Bonjour Rivendy ⚡\n\n` +
        `J'ai payé pour le boost *${tier.name}* (${tier.durationDays} jours) pour mon article :\n` +
        `📦 *ID:* ${product.id}\n` +
        `📝 *Titre:* ${product.title}\n\n` +
        `🔢 *Référence:* ${reference}\n\n` +
        `Merci de valider mon boost !`
    );
    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    setSelectedTier(null);
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Rivendy</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Booster mon annonce</h1>
      </div>

      {/* Product preview */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <Image
            src={firstPhoto(product)}
            alt={product.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-bold text-[#1A1A1A]">{product.title}</p>
          <p className="mt-1 text-base font-black text-[#009688]">
            {formatMoney(product.price, country)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#009688]/10 px-3 py-1 text-xs font-semibold text-[#009688]">
          En vente
        </span>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex gap-3 rounded-2xl border border-[#009688]/20 bg-[#E8F5E9] p-4">
        <Zap className="h-6 w-6 shrink-0 text-[#009688]" />
        <p className="text-sm leading-relaxed text-[#004D40]">
          Un boost augmente la visibilité de votre annonce et attire plus
          d&apos;acheteurs potentiels.
        </p>
      </div>

      {/* Tiers */}
      <h2 className="mb-3 text-lg font-black text-[#1A1A1A]">
        Choisissez votre boost
      </h2>

      <div className="space-y-3">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className="relative overflow-hidden rounded-2xl bg-white shadow-sm transition"
            style={{
              border: `1.5px solid ${tier.color}33`,
            }}
          >
            {tier.isPopular && (
              <div
                className="absolute right-0 top-0 rounded-bl-xl px-3 py-1.5 text-[10px] font-black text-white"
                style={{ backgroundColor: tier.color }}
              >
                POPULAIRE
              </div>
            )}

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start gap-3">
                <span className="text-3xl">{tier.emoji}</span>
                <div className="flex-1">
                  <p className="font-black" style={{ color: tier.color }}>
                    Boost {tier.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {tier.durationDays} jours
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black" style={{ color: tier.color }}>
                    {formatMoney(priceForMarket(tier, country.id), country)}
                  </p>
                  <p className="text-xs text-slate-400">
                    soit{" "}
                    {Math.round(priceForMarket(tier, country.id) / tier.durationDays).toLocaleString("fr-FR")}{" "}
                    {country.currency_symbol}/jour
                  </p>
                </div>
              </div>

              <hr className="my-3 border-slate-100" />

              {/* Benefits */}
              <ul className="mb-4 space-y-1.5">
                {tier.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      style={{ color: tier.color }}
                    />
                    {b}
                  </li>
                ))}
              </ul>

              {/* Button */}
              <button
                type="button"
                onClick={() => setSelectedTier(tier)}
                className="w-full rounded-xl py-3 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: tier.color }}
              >
                Choisir {tier.name}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        Paiement vérifié manuellement sous 24h
        <br />
        Support : WhatsApp +253 77 14 53 06
      </p>

      {/* Payment modal */}
      {selectedTier && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedTier(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle — mobile uniquement */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            {/* Title */}
            <div className="mb-5 flex items-start gap-3">
              <span className="text-2xl">{selectedTier.emoji}</span>
              <div>
                <p
                  className="text-lg font-black"
                  style={{ color: selectedTier.color }}
                >
                  Boost {selectedTier.name}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedTier.durationDays} jours ·{" "}
                  {formatMoney(priceForMarket(selectedTier, country.id), country)}
                </p>
              </div>
            </div>

            {/* Method selector */}
            <p className="mb-2 font-bold text-[#1A1A1A]">
              Méthode de paiement
            </p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m, i) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setSelectedMethod(i)}
                  className="rounded-xl border py-3 text-center text-xs font-bold transition"
                  style={{
                    borderColor:
                      selectedMethod === i ? m.color : "#E2E8F0",
                    backgroundColor:
                      selectedMethod === i ? `${m.color}15` : "#F8FAFC",
                    color: selectedMethod === i ? m.color : "#94A3B8",
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>

            {/* Instructions */}
            <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-bold text-slate-700">
                Instructions de paiement
              </p>

              {/* Step 1 */}
              <div className="mb-2 flex gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ backgroundColor: selectedTier.color }}
                >
                  1
                </div>
                <p className="text-sm text-slate-600">
                  Envoyez{" "}
                  <strong>{formatMoney(priceForMarket(selectedTier, country.id), country)}</strong>{" "}
                  au numéro :{" "}
                  <strong
                    style={{ color: selectedTier.color }}
                  >
                    {PAYMENT_METHODS[selectedMethod].number}
                  </strong>
                </p>
              </div>

              {/* Step 2 */}
              <div className="mb-2 flex gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ backgroundColor: selectedTier.color }}
                >
                  2
                </div>
                <div className="flex-1">
                  <p className="mb-2 text-sm text-slate-600">
                    Mentionnez la référence dans le motif :
                  </p>
                  <button
                    type="button"
                    onClick={copyReference}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2 transition hover:opacity-80"
                    style={{
                      borderColor: `${selectedTier.color}66`,
                      backgroundColor: "white",
                    }}
                  >
                    <span
                      className="text-sm font-bold tracking-wide"
                      style={{ color: selectedTier.color }}
                    >
                      {reference}
                    </span>
                    {copied ? (
                      <CheckCircle
                        className="h-4 w-4"
                        style={{ color: selectedTier.color }}
                      />
                    ) : (
                      <Copy
                        className="h-4 w-4"
                        style={{ color: selectedTier.color }}
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ backgroundColor: selectedTier.color }}
                >
                  3
                </div>
                <p className="text-sm text-slate-600">
                  Cliquez sur &quot;J&apos;ai payé&quot; ci-dessous. Notre
                  équipe activera votre boost sous 24h.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePaid(selectedTier)}
              className="w-full rounded-xl py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: selectedTier.color }}
            >
              J&apos;ai payé — Activer mon boost
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              En cliquant, vous confirmez avoir effectué le paiement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
