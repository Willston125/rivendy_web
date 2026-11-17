"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Copy, Loader2, Lock, Smartphone, Upload } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { fetchPlusCatalog } from "@/features/plus/plus-api";
import { declareErrorMessage, isValidOperatorReference, isValidPayerPhone, type PlusChannel } from "@/features/plus/plus-logic";
import { useDialogs } from "@/features/ui/dialogs";
import { supabase } from "@/lib/supabase/client";
import { uploadPaymentProof } from "@/lib/supabase/payment-proof";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PlaySheet } from "./create/play-sheet";
import {
  declareUnlockPayment, fetchMyUnlocks, fetchPassPrices, fetchUnlockOffer, requestUnlock,
  type PassPriceRow, type UnlockRequestResult,
} from "./pass-api";
import { accessLevel, passPriceFor, unlockErrorMessage, type MyUnlock, type UnlockOffer, type UnlockUnit } from "./pass-logic";
import { kindOf, type PlayTitle } from "./play-logic";
import { PremiumBadge } from "./play-ui";

/**
 * Rivendy Pass dans Play (formules simplifiées, lot 3, 2026-11-17, d'après
 * le canevas validé) : pastille des affiches, état d'un titre pour le compte,
 * fenêtre de déblocage (choisir, payer, déclarer, vérification). Mobile money
 * seulement : le guichet des agences ne lit pas encore les références RVD-
 * (décision du 16/11). Le vert de Play pour le Pass, l'or pour Rivendy+.
 */

// ── Prix du Pass (une seule lecture par visite) ────────────────────────────

let pricesCache: Promise<PassPriceRow[]> | null = null;

export function usePassPrices(): PassPriceRow[] | null {
  const [rows, setRows] = useState<PassPriceRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const pending = pricesCache ?? fetchPassPrices();
    pricesCache = pending;
    void pending.then((r) => {
      if (!r.length && pricesCache === pending) pricesCache = null; // panne : on relira plus tard
      if (alive) setRows(r);
    });
    return () => { alive = false; };
  }, []);
  return rows;
}

/** Montant dans la devise d'un marché (jamais une devise écrite en dur). */
export function useMarketMoney(market: string | null | undefined, currency?: string | null) {
  const { countries } = useCountry();
  return useCallback((amount: number) => {
    const c = countries.find((x) => x.id === market) ?? (currency ? { currency_code: currency, currency_symbol: "" } : null);
    return c ? formatMoney(amount, c) : new Intl.NumberFormat("fr-FR").format(amount);
  }, [countries, market, currency]);
}

/** Pastille d'accès d'une affiche : rien (libre), le prix du Pass (vert), Rivendy+ (or). */
export function AccessBadge({ title, solid }: { title: PlayTitle; solid?: boolean }) {
  if (kindOf(title.kind) === "clip" || kindOf(title.kind) === "short") return null;
  const level = accessLevel(title);
  if (level === "free") return null;
  if (level === "plus") return <PremiumBadge solid={solid} />;
  return <PassBadge title={title} solid={solid} />;
}

function PassBadge({ title, solid }: { title: PlayTitle; solid?: boolean }) {
  const market = useHomeMarket();
  const rows = usePassPrices();
  const money = useMarketMoney(market);
  const serie = kindOf(title.kind) === "serie";
  const price = rows ? passPriceFor(rows, market, serie ? "episode" : "title") : null;
  const label = price != null ? (serie ? `${money(price)} l’épisode` : money(price)) : "Rivendy Pass";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rvp-accent",
      solid ? "bg-black/75 ring-1 ring-rvp-accent/40" : "bg-rvp-accent/10 ring-1 ring-rvp-accent/30",
    )}>
      <Lock className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}

// ── État d'un titre pour le compte connecté ────────────────────────────────

export interface PassInfo {
  /** Faux tant que l'état d'un titre bloqué n'est pas connu. */
  ready: boolean;
  signedIn: boolean;
  /** null : titre libre, visiteur, ou serveur injoignable. */
  offer: UnlockOffer | null;
  unlocks: MyUnlock[];
  reload: () => void;
}

/** Niveau, prix et demandes du compte pour un titre bloqué (play_unlock_offer, my_play_unlocks). */
export function usePassInfo(title: PlayTitle): PassInfo {
  const { user, loading: authLoading } = useAuth();
  const blocked = !!title.is_premium && kindOf(title.kind) !== "clip";
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; offer: UnlockOffer | null; unlocks: MyUnlock[] } | null>(null);
  const key = user && blocked ? `${user.id}:${title.id}:${round}` : null;
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void Promise.all([fetchUnlockOffer(title.id), fetchMyUnlocks(title.id)]).then(([offer, unlocks]) => {
      if (alive) setData({ key, offer: offer.success ? offer : null, unlocks });
    });
    return () => { alive = false; };
  }, [key, title.id]);
  const current = data && data.key === key ? data : null;
  const reload = useCallback(() => setRound((n) => n + 1), []);
  return {
    ready: !blocked || (!authLoading && (!user || !!current)),
    signedIn: !!user,
    offer: current?.offer ?? null,
    unlocks: current?.unlocks ?? [],
    reload,
  };
}

/** Aperçu prêt d'un film bloqué (les N premières minutes), sinon null. */
export function usePreviewSeconds(title: PlayTitle): number | null {
  const [seconds, setSeconds] = useState<{ id: string; s: number | null } | null>(null);
  const wanted = !!title.is_premium && kindOf(title.kind) === "film";
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    void supabase.from("play_title_previews").select("seconds, status").eq("title_id", title.id).maybeSingle()
      .then(({ data }) => {
        const row = data as { seconds?: number; status?: string } | null;
        if (alive) setSeconds({ id: title.id, s: row?.status === "ready" && row.seconds ? row.seconds : null });
      });
    return () => { alive = false; };
  }, [wanted, title.id]);
  return seconds && seconds.id === title.id ? seconds.s : null;
}

// ── Fenêtre de déblocage ───────────────────────────────────────────────────

export interface UnlockTarget {
  unit: UnlockUnit;
  episodeId?: string | null;
  episodeNumber?: number | null;
  season?: number | null;
  price: number;
}

type Step = "choose" | "pay" | "declare" | "verifying";

const field = "h-11 w-full rounded-xl border border-rvp-line bg-rvp-raised px-3 text-[15px] text-rvp-text placeholder:text-rvp-muted focus:border-rvp-edge-strong focus:outline-none";
const sheetPrimary = "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rvp-accent text-[15px] font-extrabold text-rvp-on-accent hover:bg-rvp-accent-hover disabled:opacity-60";
const sheetSecondary = "flex h-11 w-full items-center justify-center rounded-full border border-rvp-edge-strong text-sm font-bold text-rvp-text hover:bg-white/[0.06]";

function sheetHeading(title: PlayTitle, t: UnlockTarget): { heading: string; sub?: string } {
  if (t.unit === "season") return { heading: `Débloquer la saison ${t.season}`, sub: `« ${title.title} »` };
  if (t.unit === "episode") return { heading: `Débloquer l’épisode ${t.episodeNumber ?? ""}`.trim(), sub: `« ${title.title} »` };
  return { heading: `Débloquer « ${title.title} »` };
}

/**
 * Choisir le moyen, recevoir la référence RVD-…, payer, déclarer. Le prix et
 * la référence viennent du serveur ; la demande non payée reste dans « Mon
 * Rivendy+ » (7 jours).
 */
export function UnlockSheet({ title, target, market, currency, onClose, onChanged }: {
  title: PlayTitle; target: UnlockTarget; market?: string | null; currency?: string | null;
  onClose: () => void; onChanged: () => void;
}) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const money = useMarketMoney(market, currency);
  const [channels, setChannels] = useState<PlusChannel[] | null>(null);
  // Vente fermée dans le pays (même interrupteur que Rivendy+, sale_open), sauf comptes d'essai.
  const [saleClosed, setSaleClosed] = useState(false);
  const [channel, setChannel] = useState("");
  const [step, setStep] = useState<Step>("choose");
  const [req, setReq] = useState<UnlockRequestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [opRef, setOpRef] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [copied, setCopied] = useState("");
  const proofInput = useRef<HTMLInputElement>(null);
  const { heading, sub } = sheetHeading(title, target);

  useEffect(() => {
    let alive = true;
    void fetchPlusCatalog(null).then((c) => {
      if (!alive) return;
      const mobile = (c.channels ?? []).filter((x) => x.kind === "mobile_money");
      setSaleClosed(c.success && c.sale_open === false && !c.test_mode);
      setChannels(mobile);
      setChannel((v) => v || mobile[0]?.code || "");
    });
    return () => { alive = false; };
  }, []);

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  async function ask() {
    if (!channel) return;
    setBusy(true);
    setError("");
    const res = await requestUnlock(target.unit, title.id, { episodeId: target.episodeId, season: target.season }, channel);
    setBusy(false);
    if (!res.success) { setError(unlockErrorMessage(res.error)); return; }
    setReq(res);
    setStep("pay");
    onChanged();
  }

  async function declare(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !req?.unlock_id) return;
    if (!isValidPayerPhone(phone)) { setError(declareErrorMessage("bad_phone")); return; }
    if (!isValidOperatorReference(opRef)) { setError(declareErrorMessage("bad_operator_reference")); return; }
    setBusy(true);
    setError("");
    const proofPath = proof ? await uploadPaymentProof(user.id, proof) : null;
    const err = await declareUnlockPayment(req.unlock_id, phone.trim(), opRef.trim(), proofPath);
    setBusy(false);
    if (err) { setError(declareErrorMessage(err)); return; }
    setStep("verifying");
    onChanged();
  }

  function later() {
    onClose();
    dialogs.notify("La demande reste dans « Mon Rivendy+ », 7 jours.", "success");
  }

  const amount = money(Number(req?.price ?? target.price));
  const stepLabel = step === "choose" ? "Étape 1 sur 3" : step === "pay" ? "Étape 2 sur 3" : step === "declare" ? "Étape 3 sur 3" : null;

  return (
    <PlaySheet title={step === "verifying" ? "Rivendy vérifie votre paiement" : heading} subtitle={step === "verifying" ? undefined : sub} onClose={onClose}>
      {stepLabel ? <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-rvp-accent">Rivendy Pass · {stepLabel}</p> : null}
      {req?.test_mode && step !== "verifying" ? (
        <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-[13px] text-amber-100">
          Mode essai : la vente n’est pas encore ouverte au public.
        </p>
      ) : null}

      {step === "choose" ? (
        <>
          <p className="font-rvp-display text-[28px] font-extrabold leading-none">{amount}</p>
          <ul className="space-y-1.5 text-[13.5px] text-rvp-soft">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-rvp-accent" aria-hidden />À vous pour toujours</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-rvp-accent" aria-hidden />Sur le site et dans l’application</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-rvp-accent" aria-hidden />À revoir autant que vous voulez</li>
          </ul>
          {channels === null ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-rvp-soft" aria-label="Chargement" />
          ) : saleClosed ? (
            <p className="text-sm text-rvp-soft">{unlockErrorMessage("sale_closed")}</p>
          ) : channels.length === 0 ? (
            <p className="text-sm text-rvp-soft">Aucun paiement mobile money n’est encore disponible dans votre pays.</p>
          ) : (
            <>
              <p className="text-sm font-bold">Payer avec</p>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Moyen de paiement">
                {channels.map((c) => (
                  <button key={c.code} type="button" role="radio" aria-checked={c.code === channel} onClick={() => setChannel(c.code)}
                    data-autofocus={c.code === channel ? true : undefined}
                    className={cn("flex items-center gap-2.5 rounded-2xl border-2 p-3 text-left text-sm font-bold",
                      c.code === channel ? "border-rvp-accent bg-rvp-raised" : "border-rvp-line hover:border-rvp-edge-strong")}>
                    <Smartphone className={cn("h-[18px] w-[18px]", c.code === channel ? "text-rvp-accent" : "text-rvp-soft")} aria-hidden />
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {error ? <p role="alert" className="text-sm font-semibold text-red-300">{error}</p> : null}
          <button type="button" onClick={ask} disabled={busy || !channel || saleClosed} className={sheetPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Obtenir ma référence
          </button>
        </>
      ) : null}

      {step === "pay" && req ? (
        <>
          <p className="text-xl font-extrabold">Envoyez {amount}</p>
          <div className="rounded-2xl bg-rvp-raised p-4">
            <p className="text-xs text-rvp-soft">Votre référence</p>
            <p className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[21px] font-extrabold tracking-wide">
              {req.reference}
              <button type="button" onClick={() => copy(req.reference ?? "", "ref")} aria-label="Copier la référence"
                className="grid h-10 w-10 place-items-center rounded-xl border border-rvp-edge-strong text-rvp-accent">
                {copied === "ref" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              </button>
            </p>
            {req.channel?.account_number ? (
              <>
                <p className="mt-3 text-xs text-rvp-soft">Numéro {req.channel.label} de Rivendy</p>
                <p className="mt-0.5 flex items-center justify-between gap-2 text-base font-extrabold">
                  <span className="font-mono">{req.channel.account_number}</span>
                  <button type="button" onClick={() => copy((req.channel?.account_number ?? "").replace(/\s/g, ""), "num")}
                    aria-label="Copier le numéro" className="grid h-10 w-10 place-items-center rounded-xl border border-rvp-edge-strong text-rvp-accent">
                    {copied === "num" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  </button>
                </p>
                {req.channel.account_name ? <p className="text-xs text-rvp-soft">{req.channel.account_name}</p> : null}
              </>
            ) : null}
            {req.channel?.instructions ? <p className="mt-2 text-xs text-rvp-soft">{req.channel.instructions}</p> : null}
          </div>
          <p className="text-[13px] leading-relaxed text-rvp-soft">
            Écrivez la référence avec le paiement.
            {req.valid_until ? ` Elle est valable jusqu’au ${new Date(req.valid_until).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.` : ""}
          </p>
          <button type="button" onClick={() => { setError(""); setStep("declare"); }} className={sheetPrimary}>J’ai payé, je déclare</button>
          <button type="button" onClick={later} className="h-10 text-[13px] font-bold text-rvp-soft hover:text-rvp-text">Je paierai plus tard</button>
        </>
      ) : null}

      {step === "declare" && req ? (
        <form onSubmit={declare} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-rvp-soft">Numéro qui a payé
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+269 …" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-rvp-soft">Référence du SMS reçu
            <input value={opRef} onChange={(e) => setOpRef(e.target.value)} maxLength={80} className={cn(field, "font-mono")} />
          </label>
          <input ref={proofInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; if (f) setProof(f); }} />
          <button type="button" onClick={() => proofInput.current?.click()} disabled={busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-rvp-edge-strong text-[13px] font-bold text-rvp-text">
            {proof ? <Check className="h-4 w-4 text-rvp-accent" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            {proof ? "Capture ajoutée (changer)" : "Capture d’écran (facultatif)"}
          </button>
          {error ? <p role="alert" className="text-sm font-semibold text-red-300">{error}</p> : null}
          <button type="submit" disabled={busy} className={sheetPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Envoyer
          </button>
          <button type="button" onClick={() => { setError(""); setStep("pay"); }} className="h-10 text-[13px] font-bold text-rvp-soft hover:text-rvp-text">Revoir la référence</button>
        </form>
      ) : null}

      {step === "verifying" ? (
        <>
          <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-rvp-premium/15">
            <Clock className="h-[26px] w-[26px] text-rvp-premium" aria-hidden />
          </span>
          <p className="text-[13.5px] leading-relaxed text-rvp-soft">
            Vous recevrez une notification. {target.unit === "season" ? "La saison s’ouvrira" : target.unit === "episode" ? "L’épisode s’ouvrira" : "Le film s’ouvrira"} tout seul, ici et dans l’application.
          </p>
          <button type="button" onClick={onClose} className={sheetSecondary}>Fermer</button>
          {req?.unlock_id ? (
            <Link href={`/plus/abonnement?deblocage=${encodeURIComponent(req.unlock_id)}`} className="text-center text-[13px] font-extrabold text-rvp-accent">
              Voir mes paiements
            </Link>
          ) : null}
        </>
      ) : null}
    </PlaySheet>
  );
}
