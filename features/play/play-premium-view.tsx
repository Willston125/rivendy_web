"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clapperboard, Copy, ImagePlus, Smartphone, UserRound, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { fetchHomeMarketId } from "@/features/products/publish-market-dialog";
import { supabase } from "@/lib/supabase/client";
import { uploadPaymentProof } from "@/lib/supabase/payment-proof";
import { formatMoney } from "@/lib/utils/format";
import { inMarket } from "@/lib/utils/market-phrase";
import { getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import type { Country } from "@/types/rivendy";
import {
  attachPlayPassProof,
  fetchMyPasses,
  fetchPassNotifications,
  fetchPassPrices,
  requestPlayPass,
} from "@/features/play/play-pass-api";
import {
  accessUntil,
  cheapestPerDayPlan,
  generatePassReference,
  isPassSaleOpen,
  passRequestMessage,
  passStatus,
  planInfo,
  plansOnSale,
  rejectReasons,
  type MyPass,
  type PassPlan,
  type PassPrice,
} from "@/features/play/play-pass-logic";

/* ─────────────────────────────────────────────────────────────────────────
 * 🎬 PASS PREMIUM RIVENDY PLAY — /play/premium (lot 6, 2026-10-12)
 *
 * Maquette « 4 · Pass Premium » validée le 2026-10-11, adaptée au bureau.
 * Décision du propriétaire : vente SEULEMENT sur le site, en MOBILE MONEY
 * (pas d'espèces), validation manuelle au dashboard. L'application, elle,
 * n'affiche ni prix ni lien vers cette page (règle Google Play, spec §3.1).
 *
 * Marché du pass = marché d'ORIGINE du compte (comme request_play_pass et le
 * jeton de lecture), pas le marché affiché par le site.
 * ───────────────────────────────────────────────────────────────────────── */

const C = {
  premium: "#FF6B35",
  teal: "#00BFA5",
};

function formatDateTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Référence gardée dans le navigateur jusqu'à l'envoi : recharger la page
 *  après avoir payé ne doit pas changer le motif déjà saisi. */
function storedReference(userId: string): string {
  const key = `rivendy_play_pass_ref:${userId}`;
  try {
    const kept = localStorage.getItem(key);
    if (kept && /^RVP-[A-Z0-9]{6}$/.test(kept)) return kept;
    const fresh = generatePassReference();
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return generatePassReference();
  }
}

function renewReference(userId: string): string {
  const fresh = generatePassReference();
  try {
    localStorage.setItem(`rivendy_play_pass_ref:${userId}`, fresh);
  } catch {
    /* navigation privée : la référence reste valable pour cette page */
  }
  return fresh;
}

export function PlayPremiumView() {
  const { user, profile, loading: authLoading } = useAuth();
  const { country: shownCountry, countries } = useCountry();

  const [homeMarket, setHomeMarket] = useState<string | null>(null);
  const [homeResolved, setHomeResolved] = useState(false);
  const [prices, setPrices] = useState<PassPrice[] | null>(null);
  const [pricesError, setPricesError] = useState(false);
  const [passes, setPasses] = useState<MyPass[]>([]);
  // Motif d'un refus, par demande : la notification (visible aussi dans
  // l'app) reste neutre, le motif ne se lit qu'ici (audit I2, 2026-10-13).
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<PassPlan | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  // Marché du compte (connecté) ; sinon celui affiché par le site.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHomeMarket(null);
      setHomeResolved(true);
      return;
    }
    let cancelled = false;
    setHomeResolved(false);
    void fetchHomeMarketId(supabase, user.id).then((id) => {
      if (cancelled) return;
      setHomeMarket(id);
      setHomeResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const marketId = user ? homeMarket : shownCountry?.id ?? null;
  const market = useMemo(
    () => countries.find((c) => c.id === marketId) ?? (shownCountry?.id === marketId ? shownCountry : null),
    [countries, marketId, shownCountry],
  );

  useEffect(() => {
    if (!marketId) return;
    let cancelled = false;
    setPrices(null);
    setPricesError(false);
    void fetchPassPrices(marketId).then((rows) => {
      if (cancelled) return;
      if (rows === null) setPricesError(true);
      else setPrices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  const reloadPasses = useCallback(async () => {
    if (!user) return;
    const [rows, notifications] = await Promise.all([fetchMyPasses(), fetchPassNotifications(user.id)]);
    if (rows) setPasses(rows);
    setReasons(rejectReasons(notifications));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPasses([]);
      setReasons({});
      setReference(null);
      return;
    }
    setReference(storedReference(user.id));
    void reloadPasses();
  }, [user, reloadPasses]);

  // Jamais de numéro en dur : miroir de mobile_money_data.dart. Espèces
  // exclues — vente en mobile money seulement (décision du 2026-10-11).
  const methods = useMemo(
    () => getMobileMoneyForCountry(marketId ?? "").filter((m) => m.enabled && m.id !== "cash" && !!m.number),
    [marketId],
  );
  const method = methods.find((m) => m.id === methodId) ?? methods[0] ?? null;

  const offers = useMemo(() => plansOnSale(prices ?? []), [prices]);
  const best = useMemo(() => cheapestPerDayPlan(prices ?? []), [prices]);
  const saleOpen = isPassSaleOpen(prices ?? [], methods.length > 0);
  const chosen = offers.find((o) => o.id === plan) ?? offers.find((o) => o.id === best) ?? offers[offers.length - 1] ?? null;
  const until = accessUntil(passes, now);
  const pendingCount = passes.filter((p) => p.status === "pending").length;

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function submit() {
    if (!user || !chosen || !method || !reference) return;
    setSubmitting(true);
    setResult(null);

    // Capture facultative, envoyée avant la demande ; si l'envoi échoue, la
    // demande part quand même et la capture s'ajoute ensuite (« Mes pass »).
    let proofPath: string | null = null;
    let proofFailed = false;
    if (proof) {
      proofPath = await uploadPaymentProof(user.id, proof);
      proofFailed = proofPath === null;
    }

    const res = await requestPlayPass({ plan: chosen.id, paymentMethod: method.id, reference, proofPath });
    setSubmitting(false);

    if (!res.ok) {
      if (res.error === "reference_taken") setReference(renewReference(user.id));
      setResult({ ok: false, text: passRequestMessage(res.error) });
      return;
    }

    setProof(null);
    setReference(renewReference(user.id));
    void reloadPasses();
    const proofNote = proofPath
      ? " Capture du paiement jointe ✓"
      : proofFailed
        ? " La capture n’a pas pu être envoyée : ajoutez-la dans « Mes pass »."
        : " Ajoutez la capture de votre paiement dans « Mes pass » pour accélérer la validation.";
    setResult({
      ok: true,
      text:
        `Demande envoyée — référence ${res.reference}, ${chosen.name.toLowerCase()} à ` +
        `${formatMoney(res.price || chosen.price, market)}. Rivendy vérifie le paiement puis active votre pass ; ` +
        `une notification vous prévient dans l’application.${proofNote}`,
    });
  }

  async function addProof(pass: MyPass, file: File) {
    if (!user) return;
    setAttachingId(pass.id);
    setResult(null);
    const path = await uploadPaymentProof(user.id, file);
    const err = path ? await attachPlayPassProof(pass.id, path) : "upload";
    setAttachingId(null);
    if (err) {
      setResult({
        ok: false,
        text:
          err === "request_not_pending"
            ? "Cette demande a déjà été traitée par l’équipe Rivendy."
            : "La capture n’a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
      });
      return;
    }
    setResult({ ok: true, text: "Capture envoyée ✓ — l’équipe Rivendy vérifie votre paiement." });
    void reloadPasses();
  }

  const loadingMarket = authLoading || (user && !homeResolved);

  return (
    <div className="min-h-screen bg-[#0B1418] text-[#F1F5F9]">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-16 pt-6 md:pt-10">
        <nav aria-label="Fil d’Ariane" className="text-xs font-medium text-[#94A3B8]">
          <Link href="/" className="hover:text-white">
            rivendy.com
          </Link>{" "}
          › Rivendy Play › Premium
        </nav>

        {/* En-tête */}
        <header className="flex flex-col gap-3">
          <span className="self-start rounded-md bg-[#FF6B35] px-2 py-1 text-[11px] font-black tracking-[0.1em] text-[#1A0B05]">
            PREMIUM
          </span>
          <h1 className="text-3xl font-black leading-tight text-white md:text-4xl">
            Tous les films et séries, sans limite
          </h1>
          {/* Spec §8 : « et sur le site » seulement quand la lecture web existera (lot 8). */}
          <p className="text-sm leading-relaxed text-[#CBD5E1] md:text-base">
            Le pass s’active sur votre compte Rivendy : vous regardez ensuite dans l’application Rivendy, avec le même
            compte.
          </p>
        </header>

        {result && (
          <div
            role="status"
            className={`rounded-2xl border p-4 text-sm leading-relaxed ${
              result.ok
                ? "border-[#00BFA5]/40 bg-[#00BFA5]/10 text-[#CCFBF1]"
                : "border-red-400/40 bg-red-500/10 text-red-100"
            }`}
          >
            {result.text}
          </div>
        )}

        {loadingMarket ? (
          <p className="text-sm text-[#94A3B8]">Chargement…</p>
        ) : !user ? (
          <SignInCard />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#131F24] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#22324F] text-[#CBD5E1]">
              <UserRound className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-[#94A3B8]">Connecté avec</span>
              <span className="block truncate text-sm font-bold text-white">
                {profile?.full_name || user.email}
                {market ? ` · ${market.name}` : ""}
              </span>
            </span>
          </div>
        )}

        {/* Mes pass */}
        {user && (until || passes.length > 0) && (
          <MyPasses
            passes={passes}
            reasons={reasons}
            until={until}
            now={now}
            countries={countries}
            attachingId={attachingId}
            onAddProof={addProof}
          />
        )}

        {/* Offre */}
        {loadingMarket ? null : !marketId ? (
          <Notice>
            Choisissez votre pays en haut de la page pour voir le Pass Premium.
          </Notice>
        ) : user && !homeMarket ? (
          <Notice>
            Votre compte n’a pas de pays enregistré. Complétez votre profil pour demander un pass.{" "}
            <Link href="/profile/info" className="font-bold text-[#5EEAD4] underline">
              Mon profil
            </Link>
          </Notice>
        ) : pricesError ? (
          <Notice>Les tarifs n’ont pas pu être chargés. Vérifiez votre connexion puis rechargez la page.</Notice>
        ) : prices === null || !market ? (
          // Pays pas encore résolu : jamais de prix sans sa devise (formatMoney
          // retomberait sur « FDJ »).
          <p className="text-sm text-[#94A3B8]">Chargement des tarifs…</p>
        ) : !saleOpen ? (
          <Notice>
            Le Pass Premium n’est pas encore disponible {market ? inMarket(market) : "dans votre pays"}. Les shorts, les
            bandes-annonces et les films gratuits restent à regarder dans l’application Rivendy.
          </Notice>
        ) : (
          <>
            <section aria-labelledby="choix-pass" className="flex flex-col gap-3">
              <h2 id="choix-pass" className="text-lg font-bold text-[#F8FAFC]">
                1. Choisissez votre pass
              </h2>
              <div role="radiogroup" aria-label="Choisir un pass" className="flex flex-col gap-2.5">
                {offers.map((o) => {
                  const selected = chosen?.id === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPlan(o.id)}
                      className={`flex min-h-[68px] items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                        selected
                          ? "border-[#FF6B35] bg-[#FF6B35]/[0.08]"
                          : "border-white/10 bg-[#131F24] hover:border-white/25"
                      }`}
                    >
                      <Radio on={selected} color={C.premium} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-base font-bold text-white">
                          {o.name}
                          {best === o.id && (
                            <span className="rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-bold text-[#1A0B05]">
                              Recommandé
                            </span>
                          )}
                        </span>
                        {/* « Meilleur prix par jour » : seulement si c'est VRAI pour les tarifs actuels. */}
                        <span className="text-xs font-medium text-[#94A3B8]">
                          {best === o.id ? "Le meilleur prix par jour" : o.hint}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[15px] font-black text-white">
                        {formatMoney(o.price, market)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {until && (
                <p className="text-xs leading-relaxed text-[#94A3B8]">
                  Un nouveau pass prolonge votre accès : il commence à la fin du pass en cours.
                </p>
              )}
            </section>

            <section aria-labelledby="paiement" className="flex flex-col gap-3">
              <h2 id="paiement" className="text-lg font-bold text-[#F8FAFC]">
                2. Payez par mobile money
              </h2>
              <div role="radiogroup" aria-label="Moyen de paiement" className="flex flex-col gap-2">
                {methods.map((m) => {
                  const selected = method?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMethodId(m.id)}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left transition ${
                        selected ? "border-[#00BFA5] bg-[#00BFA5]/[0.08]" : "border-white/10 bg-[#131F24]"
                      }`}
                    >
                      <Radio on={selected} color={C.teal} />
                      <span className="flex flex-1 flex-col">
                        <span className="text-[15px] font-bold text-white">{m.name}</span>
                        <span className="text-xs font-medium text-[#94A3B8]">
                          Moyen de paiement {market ? `du marché ${market.name}` : "de votre pays"}
                        </span>
                      </span>
                      <Smartphone className="h-5 w-5 text-[#94A3B8]" aria-hidden />
                    </button>
                  );
                })}
              </div>

              {user && chosen && method && reference ? (
                <>
                  <ol className="flex list-decimal flex-col gap-2.5 rounded-2xl bg-[#131F24] py-4 pl-9 pr-4 text-sm leading-relaxed text-[#CBD5E1]">
                    <li>
                      Envoyez <strong className="text-white">{formatMoney(chosen.price, market)}</strong> par{" "}
                      {method.name} au <strong className="text-white">{method.number}</strong>
                      <CopyButton
                        label="Copier le numéro"
                        done={copied === "number"}
                        onClick={() => copy((method.number ?? "").replace(/\s/g, ""), "number")}
                      />
                    </li>
                    <li>
                      Indiquez la référence{" "}
                      <strong className="font-mono tracking-wider text-white">{reference}</strong> dans le motif.
                      <CopyButton
                        label="Copier la référence"
                        done={copied === "reference"}
                        onClick={() => copy(reference, "reference")}
                      />
                    </li>
                    <li>Joignez la capture du paiement si vous l’avez.</li>
                  </ol>
                  <ProofPicker file={proof} onChange={setProof} disabled={submitting} />
                </>
              ) : (
                !user && (
                  <p className="rounded-2xl bg-[#131F24] p-4 text-sm leading-relaxed text-[#CBD5E1]">
                    Connectez-vous pour obtenir votre référence de paiement : le pass s’active sur votre compte
                    Rivendy.
                  </p>
                )
              )}
            </section>

            {user && (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !chosen || !method || !reference || pendingCount >= 3}
                  className="h-14 rounded-2xl bg-[#FF6B35] text-[17px] font-black text-[#1A0B05] transition hover:bg-[#E55A2B] disabled:opacity-50"
                >
                  {submitting ? "Envoi…" : "Envoyer ma demande"}
                </button>
                <p className="text-center text-xs leading-relaxed text-[#94A3B8]">
                  {pendingCount >= 3
                    ? "Vous avez déjà 3 demandes en attente : l’équipe Rivendy les vérifie avant d’en accepter une nouvelle."
                    : "Rivendy vérifie le paiement puis active votre pass. Une notification vous prévient dans l’application."}
                </p>
              </div>
            )}
          </>
        )}

        <p className="text-xs leading-relaxed text-[#64748B]">
          Pass sans reconduction automatique : il s’arrête seul à son échéance. Une question sur votre pass ? Passez par{" "}
          <Link href="/help" className="underline hover:text-[#94A3B8]">
            Aide &amp; Support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/* ── Sous-composants ─────────────────────────────────────────────────── */

function Radio({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      aria-hidden
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: on ? color : "#64748B" }}
    >
      {on && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
    </span>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#131F24] p-4 text-sm leading-relaxed text-[#CBD5E1]">
      {children}
    </div>
  );
}

function CopyButton({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="ml-2 inline-flex h-7 items-center gap-1 rounded-lg bg-white/10 px-2 align-middle text-[11px] font-bold text-[#CBD5E1] transition hover:bg-white/20"
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5 text-[#5EEAD4]" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copié" : "Copier"}
    </button>
  );
}

function SignInCard() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#131F24] p-4">
      <p className="text-sm leading-relaxed text-[#CBD5E1]">
        Connectez-vous avec votre compte Rivendy — le même que dans l’application. Le pass s’active sur ce compte.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/auth/login?next=${encodeURIComponent("/play/premium")}`}
          className="inline-flex h-11 items-center rounded-xl bg-[#FF6B35] px-5 text-sm font-black text-[#1A0B05] transition hover:bg-[#E55A2B]"
        >
          Se connecter
        </Link>
        <Link
          href="/auth/signup"
          className="inline-flex h-11 items-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Créer un compte
        </Link>
      </div>
    </div>
  );
}

/** Capture facultative (maquette : bouton en pointillés). */
function ProofPicker({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (picked) onChange(picked);
        }}
      />
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#00BFA5]/40 bg-[#00BFA5]/[0.08] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
          <img src={preview} alt="Capture du paiement" className="h-12 w-12 rounded-lg object-cover" />
          <span className="flex-1 text-sm font-bold text-white">Capture ajoutée ✓</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg px-2 py-1 text-xs font-bold text-[#CBD5E1] hover:bg-white/10 disabled:opacity-40"
          >
            Changer
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label="Retirer la capture"
            className="rounded-lg p-1 text-[#CBD5E1] hover:bg-white/10 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/30 text-sm font-semibold text-[#F1F5F9] transition hover:bg-white/5 disabled:opacity-40"
        >
          <ImagePlus className="h-[18px] w-[18px]" />
          Joindre la capture (facultatif)
        </button>
      )}
    </div>
  );
}

function MyPasses({
  passes,
  reasons,
  until,
  now,
  countries,
  attachingId,
  onAddProof,
}: {
  passes: MyPass[];
  reasons: Record<string, string>;
  until: Date | null;
  now: Date;
  countries: Country[];
  attachingId: string | null;
  onAddProof: (pass: MyPass, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<MyPass | null>(null);

  return (
    <section id="mes-pass" aria-labelledby="mes-pass-titre" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="mes-pass-titre" className="text-lg font-bold text-[#F8FAFC]">
        Mes pass
      </h2>
      {until && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#00BFA5]/40 bg-[#00BFA5]/10 p-4">
          <Clapperboard className="h-6 w-6 shrink-0 text-[#5EEAD4]" />
          <p className="text-sm leading-relaxed text-[#CCFBF1]">
            Pass Premium actif jusqu’au <strong className="text-white">{formatDateTime(until)}</strong>. Films et
            séries Premium débloqués dans l’application.
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked && target) onAddProof(target, picked);
        }}
      />
      <ul className="flex flex-col gap-2">
        {passes.map((p) => {
          const st = passStatus(p, now);
          const info = planInfo(p.plan);
          // Montant dans la devise du marché DU PASS ; pays inconnu : nombre
          // seul plutôt qu'une devise fausse.
          const ccy = countries.find((c) => c.id === p.country_id);
          const amount = ccy ? formatMoney(p.price_paid, ccy) : String(p.price_paid);
          const tone =
            st.tone === "active"
              ? "text-[#5EEAD4]"
              : st.tone === "pending"
                ? "text-[#FDBA74]"
                : st.tone === "refused"
                  ? "text-red-300"
                  : "text-[#94A3B8]";
          return (
            <li key={p.id} className="rounded-2xl border border-white/10 bg-[#131F24] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-white">
                  {info?.name ?? "Pass"} · {amount}
                </span>
                <span className={`text-xs font-bold ${tone}`}>{st.label}</span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Réf. <span className="font-mono tracking-wider">{p.payment_reference}</span> · demandé le{" "}
                {formatDateTime(p.created_at)}
                {p.status === "active" && p.expires_at ? ` · jusqu’au ${formatDateTime(p.expires_at)}` : ""}
              </p>
              {p.status === "rejected" && (
                <p className="mt-2 text-xs leading-relaxed text-[#CBD5E1]">
                  {reasons[p.id] ? (
                    <>
                      Motif : <span className="text-white">{reasons[p.id]}</span>
                      <br />
                    </>
                  ) : null}
                  Une question ?{" "}
                  <Link href="/help" className="font-bold text-[#5EEAD4] underline">
                    Aide &amp; Support
                  </Link>
                </p>
              )}
              {p.status === "pending" &&
                (p.payment_proof_path ? (
                  <p className="mt-2 text-xs text-[#CBD5E1]">Capture reçue ✓ — l’équipe vérifie votre paiement.</p>
                ) : (
                  <button
                    type="button"
                    disabled={attachingId === p.id}
                    onClick={() => {
                      setTarget(p);
                      inputRef.current?.click();
                    }}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/30 text-sm font-semibold text-[#F1F5F9] transition hover:bg-white/5 disabled:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {attachingId === p.id ? "Envoi…" : "Ajouter la capture du paiement"}
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
