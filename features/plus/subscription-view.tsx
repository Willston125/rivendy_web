"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Check, Copy, Loader2, Smartphone, Sparkles, Store, Truck, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode } from "@/components/ui/qr-code";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { PaymentProofField } from "@/features/seller/payment-proof-field";
import { cancelUnlockRequest, declareUnlockPayment, fetchUnlockHistory, type UnlockHistoryRow } from "@/features/play/pass-api";
import { unlockTargetLabel } from "@/features/play/pass-logic";
import { uploadPaymentProof } from "@/lib/supabase/payment-proof";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  cancelPlusRequest, declarePlusPayment, fetchAgencyNames, fetchBoostStatus, fetchMyEntitlements, fetchMyPeriods,
  fetchPassNotifications, fetchPlusCatalog, type BoostStatus, type MyEntitlements,
} from "./plus-api";
import {
  declareErrorMessage, isValidOperatorReference, isValidPayerPhone, periodStatus, rejectReasons,
  requestValidUntil, type MyPeriod, type PlusChannel,
} from "./plus-logic";

const OFFER_NAMES: Record<string, string> = { month: "Rivendy+", day: "Pass Découverte", week: "Pass Semaine" };
const TIER_NAMES: Record<string, string> = { certified: "Certifié", pro: "Pro" };
const dateFr = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dayMonth = (iso: string | Date) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const dateTimeFr = (iso: string | Date) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Ce qu'on débloque, en clair (« Saison 1 de « … » »). */
function unlockLabel(u: UnlockHistoryRow): string {
  return unlockTargetLabel({
    unit: u.unit, title: u.play_titles?.title ?? null, season: u.season ?? u.play_episodes?.season ?? null,
    episodeNumber: u.play_episodes?.episode_number ?? null,
  });
}

/** Où regarder un contenu débloqué. */
function unlockHref(u: UnlockHistoryRow): string {
  if (u.unit === "episode" && u.episode_id) return `/play/watch/episode/${u.episode_id}`;
  if (u.unit === "season") return `/play/series/${u.title_id}`;
  return `/play/movie/${u.title_id}`;
}

const UNLOCK_STATUS: Record<string, { label: string; tone: "active" | "ended" | "refused" }> = {
  active: { label: "Débloqué", tone: "active" },
  rejected: { label: "Non validé", tone: "refused" },
  cancelled: { label: "Annulé", tone: "ended" },
  refunded: { label: "Remboursé", tone: "ended" },
};

/**
 * « Mon Rivendy+ » (Omnicanal lot B, 2026-10-21 ; lot 3 des formules,
 * 2026-11-17) : statut (calcul unique du serveur, rivendy_entitlements, ancien
 * Certifié / Pro compris), boosts et livraisons offertes du mois, demandes à
 * payer — Rivendy+ (RVP-) et Rivendy Pass (RVD-) —, titres débloqués et
 * historique des paiements.
 */
export function SubscriptionView() {
  const { user } = useAuth();
  const { countries } = useCountry();
  const dialogs = useDialogs();
  const params = useSearchParams();
  const highlighted = params.get("demande") ?? params.get("deblocage");
  const [ent, setEnt] = useState<MyEntitlements | null>(null);
  const [boosts, setBoosts] = useState<BoostStatus | null>(null);
  const [periods, setPeriods] = useState<MyPeriod[] | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockHistoryRow[] | null>(null);
  const [channels, setChannels] = useState<PlusChannel[]>([]);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [catalogMarket, setCatalogMarket] = useState<{ market?: string; currency?: string }>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [e, p, catalog, notes, b, u] = await Promise.all([
      fetchMyEntitlements(), fetchMyPeriods(), fetchPlusCatalog(null), fetchPassNotifications(), fetchBoostStatus(),
      fetchUnlockHistory(),
    ]);
    setEnt(e);
    setPeriods(p);
    setBoosts(b);
    setUnlocks(u);
    setChannels(catalog.channels ?? []);
    setCatalogMarket({ market: catalog.market, currency: catalog.currency });
    setReasons(rejectReasons(notes));
    const ids = [...new Set((p ?? []).map((x) => x.agency_id).filter((x): x is string => !!x))];
    setAgencyNames(await fetchAgencyNames(ids));
    setLoading(false);
  }, []);

  useEffect(() => { if (user) void Promise.resolve().then(() => load()); }, [user, load]);

  const money = useCallback((amount: number, market: string) => {
    // Devise du marché de la demande : liste des pays, sinon celle que le
    // serveur a rendue avec le catalogue. Jamais une devise écrite en dur
    // (audit des paramètres du 2026-11-03, m-15) : inconnue, le montant seul.
    const c = countries.find((x) => x.id === market)
      ?? (market === catalogMarket.market && catalogMarket.currency
        ? { currency_code: catalogMarket.currency, currency_symbol: "" }
        : null);
    return c ? formatMoney(amount, c) : new Intl.NumberFormat("fr-FR").format(amount);
  }, [countries, catalogMarket]);

  const now = useMemo(() => new Date(), [periods]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendingPlus = (periods ?? []).filter((p) => p.status === "pending");
  const pendingPass = (unlocks ?? []).filter((u) => u.status === "pending");
  const owned = (unlocks ?? []).filter((u) => u.status === "active");
  const history = useMemo(() => [
    ...(periods ?? []).filter((p) => p.status !== "pending").map((p) => ({ kind: "plus" as const, at: p.created_at, p })),
    ...(unlocks ?? []).filter((u) => u.status !== "pending").map((u) => ({ kind: "pass" as const, at: u.created_at, u })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [periods, unlocks]);

  const plusActive = !!ent?.active_until;
  const legacy = !plusActive && ent?.legacy_seller ? ent.legacy_seller : null;
  const credits = Number(ent?.delivery?.credits_per_cycle ?? 0);
  const allowance = Number(boosts?.allowance ?? 0);
  const extras = [
    Number(ent?.story_max_hours ?? 24) > 24 ? `Stories de 24 h ou ${ent?.story_max_hours} h` : null,
    ent?.videos_unlimited ? "Publications avec vidéo sans limite" : null,
    ent?.store_cover_video ? "Bannière vidéo de la boutique" : null,
  ].filter((x): x is string => !!x);

  async function cancelPlus(p: MyPeriod) {
    const ok = await dialogs.confirm({
      title: "Annuler cette demande ?",
      message: `Référence ${p.payment_reference}. Ne l’annulez pas si vous avez déjà payé.`,
      confirmLabel: "Annuler la demande",
      cancelLabel: "Garder",
      danger: true,
    });
    if (!ok) return;
    const err = await cancelPlusRequest(p.id);
    if (err) { dialogs.notify("Cette demande ne peut plus être annulée.", "error"); return; }
    dialogs.notify("Demande annulée", "success");
    await load();
  }

  async function cancelPass(u: UnlockHistoryRow) {
    const ok = await dialogs.confirm({
      title: "Annuler cette demande ?",
      message: `Référence ${u.payment_reference}. Ne l’annulez pas si vous avez déjà payé.`,
      confirmLabel: "Annuler la demande",
      cancelLabel: "Garder",
      danger: true,
    });
    if (!ok) return;
    const err = await cancelUnlockRequest(u.id);
    if (err) { dialogs.notify("Cette demande ne peut plus être annulée.", "error"); return; }
    dialogs.notify("Demande annulée", "success");
    await load();
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><Card className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-black text-slate-950">
        <Sparkles className="h-7 w-7 text-[#009688]" aria-hidden /> Mon Rivendy+
      </h1>

      <Card className="p-6">
        {plusActive ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-black text-slate-950">{ent?.label || "Rivendy+"} est actif</p>
              <p className="mt-1 text-sm text-slate-600">Jusqu’au {dateTimeFr(ent!.active_until!)} — sur le site et dans l’application.</p>
              {(ent?.simultaneous_streams ?? 0) >= 2 ? (
                <p className="mt-1 text-sm text-slate-600">{ent?.simultaneous_streams} écrans en même temps.</p>
              ) : null}
            </div>
            {ent?.certified_badge ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2F1] px-3 py-1.5 text-[13px] font-extrabold text-[#00695C]">
                <BadgeCheck className="h-4 w-4" aria-hidden /> Compte certifié
              </span>
            ) : null}
          </div>
        ) : legacy ? (
          <>
            <p className="text-xl font-black text-slate-950">Abonnement {TIER_NAMES[legacy.tier ?? ""] ?? "vendeur"} actif</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {legacy.until ? `Jusqu’au ${dateFr(legacy.until)}. ` : ""}
              Il a maintenant tous les avantages vendeur de Rivendy+ : badge, boosts, stories de 72 h, vidéos sans limite, bannière vidéo.
              Play et la Musique sans publicité viennent avec Rivendy+.
            </p>
            <Link href="/plus" className={buttonVariants({ className: "mt-4 rounded-full" })}>Prendre Rivendy+</Link>
          </>
        ) : (
          <>
            <p className="text-xl font-black text-slate-950">Compte Gratuit</p>
            <p className="mt-1 text-sm text-slate-600">
              Badge certifié, boosts, livraisons offertes, Play et Musique sans publicité : tout est dans Rivendy+.
            </p>
            <Link href="/plus" className={buttonVariants({ className: "mt-4 rounded-full" })}>Découvrir Rivendy+</Link>
          </>
        )}
      </Card>

      {(plusActive || legacy) && (allowance > 0 || credits > 0 || extras.length > 0) ? (
        <Card className="p-6">
          <h2 className="text-lg font-black text-slate-950">Ce mois-ci</h2>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            {allowance > 0 ? (
              <Counter icon={Zap} title={`Boosts de ${boosts?.boost_days ?? 3} jours`} left={Number(boosts?.remaining ?? 0)} total={allowance}
                unit={["restant", "restants"]} until={boosts?.cycle_end ?? null}>
                <Link href="/seller/sales" className="mt-3 inline-block text-[13px] font-extrabold text-[#00796B]">Booster un article</Link>
              </Counter>
            ) : null}
            {credits > 0 ? (
              <Counter icon={Truck} title="Livraisons offertes" left={Number(ent?.delivery?.credits_remaining ?? 0)} total={credits}
                unit={["restante", "restantes"]} until={ent?.delivery?.cycle_end ?? null}>
                <p className="mt-3 text-[13px] text-slate-500">Grande Comore. Utilisée seulement si elle fait plus que la réduction des grosses commandes.</p>
              </Counter>
            ) : null}
            {extras.length ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-extrabold text-slate-900">Aussi inclus</p>
                <ul className="mt-2.5 space-y-1.5 text-[13px] text-slate-700">
                  {extras.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {pendingPlus.map((p) => (
        <PendingRequest key={p.id} highlighted={p.id === highlighted} money={money}
          item={{
            kind: "plus", id: p.id, title: `${OFFER_NAMES[p.plan] ?? p.plan}`, amount: Number(p.price_paid), market: p.country_id,
            reference: p.payment_reference, channelCode: p.payment_channel, method: p.payment_method,
            declaredAt: p.declared_at, createdAt: p.created_at,
            note: p.starts_at && new Date(p.starts_at) > now ? "Payé d’avance : la période commencera à la fin de la période en cours." : null,
          }}
          channel={channels.find((c) => c.code === p.payment_channel) ?? null}
          onDeclare={(phone, opRef, proof) => declarePlusPayment(p.id, phone, opRef, proof)}
          onDone={load} onCancel={() => cancelPlus(p)} />
      ))}
      {pendingPass.map((u) => (
        <PendingRequest key={u.id} highlighted={u.id === highlighted} money={money}
          item={{
            kind: "pass", id: u.id, title: `Rivendy Pass · ${unlockLabel(u)}`, amount: Number(u.price), market: u.country_id,
            reference: u.payment_reference, channelCode: u.payment_channel, method: u.payment_method ?? "",
            declaredAt: u.declared_at, createdAt: u.created_at, note: null,
          }}
          channel={channels.find((c) => c.code === u.payment_channel) ?? null}
          onDeclare={(phone, opRef, proof) => declareUnlockPayment(u.id, phone, opRef, proof)}
          onDone={load} onCancel={() => cancelPass(u)} />
      ))}

      {owned.length ? (
        <Card className="p-6">
          <h2 className="text-lg font-black text-slate-950">Mes titres Rivendy Pass</h2>
          <p className="mt-1 text-[13px] text-slate-500">Acquis pour toujours, sur le site et dans l’application.</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {owned.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-[1_1_240px]">
                  <span className="block font-extrabold text-slate-900">{unlockLabel(u)}</span>
                  <span className="block text-[13px] text-slate-500">
                    {u.activated_at ? `Débloqué le ${dateFr(u.activated_at)}` : "Débloqué"}
                  </span>
                </span>
                <Link href={unlockHref(u)} className="text-sm font-extrabold text-[#00796B]">Regarder</Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="text-lg font-black text-slate-950">Historique des paiements</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun paiement pour l’instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {history.map((h) => {
              if (h.kind === "plus") {
                const p = h.p;
                const st = periodStatus(p, now);
                return (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <span>
                      <span className="font-semibold text-slate-900">{OFFER_NAMES[p.plan] ?? p.plan}</span>
                      {" · "}{money(Number(p.price_paid), p.country_id)}
                      {" · "}<span className="font-mono">{p.payment_reference}</span>
                      <span className="block text-xs text-slate-500">
                        {p.payment_method}{p.agency_id && agencyNames[p.agency_id] ? ` · agence ${agencyNames[p.agency_id]}` : ""}
                        {p.starts_at && p.expires_at ? ` · du ${dateFr(p.starts_at)} au ${dateFr(p.expires_at)}` : ` · demandé le ${dateFr(p.created_at)}`}
                      </span>
                      {reasons[p.id] ? <span className="block text-xs text-red-700">Motif : {reasons[p.id]}</span> : null}
                    </span>
                    <StatusChip tone={st.tone} label={st.label} />
                  </li>
                );
              }
              const u = h.u;
              const st = UNLOCK_STATUS[u.status] ?? UNLOCK_STATUS.cancelled;
              return (
                <li key={u.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <span>
                    <span className="font-semibold text-slate-900">Rivendy Pass</span>
                    {" · "}{money(Number(u.price), u.country_id)}
                    {" · "}<span className="font-mono">{u.payment_reference}</span>
                    <span className="block text-xs text-slate-500">
                      {[u.payment_method, unlockLabel(u)].filter(Boolean).join(" · ")}
                    </span>
                    {reasons[u.id] ? <span className="block text-xs text-red-700">Motif : {reasons[u.id]}</span> : null}
                  </span>
                  <StatusChip tone={st.tone} label={st.label} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusChip({ tone, label }: { tone: string; label: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
      tone === "active" ? "bg-[#E0F2F1] text-[#00796B]" : tone === "refused" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600")}>
      {label}
    </span>
  );
}

function Counter({ icon: Icon, title, left, total, unit, until, children }: {
  icon: typeof Zap; title: string; left: number; total: number; unit: [string, string]; until: string | null;
  children?: React.ReactNode;
}) {
  const used = Math.min(Math.max(total - left, 0), total);
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
        <Icon className="h-[18px] w-[18px] text-[#00796B]" aria-hidden /> {title}
      </p>
      <p className="mt-2.5 text-[26px] font-black text-slate-950">
        {left} <span className="text-sm font-bold text-slate-500">{left > 1 ? unit[1] : unit[0]} sur {total}</span>
      </p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0}
        aria-valuemax={total} aria-valuenow={used} aria-label={`${used} utilisés sur ${total}`}>
        <div className="h-2 bg-[#00796B]" style={{ width: `${total > 0 ? (used / total) * 100 : 0}%` }} />
      </div>
      {until ? <p className="mt-2 text-xs text-slate-500">Repart à zéro le {dayMonth(until)}</p> : null}
      {children}
    </div>
  );
}

interface PendingItem {
  kind: "plus" | "pass";
  id: string;
  title: string;
  amount: number;
  market: string;
  reference: string;
  channelCode: string | null;
  method: string;
  declaredAt: string | null;
  createdAt: string;
  note: string | null;
}

/** Une demande à payer : référence, consignes du moyen choisi, déclaration du paiement. */
function PendingRequest({
  item: p, channel, highlighted, money, onDeclare, onDone, onCancel,
}: {
  item: PendingItem;
  channel: PlusChannel | null;
  highlighted: boolean;
  money: (amount: number, market: string) => string;
  onDeclare: (phone: string, operatorReference: string, proofPath: string | null) => Promise<string | null>;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const [phone, setPhone] = useState("");
  const [opRef, setOpRef] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const isAgency = p.channelCode === "agency";
  const validUntil = requestValidUntil(p.createdAt);
  const status = p.declaredAt ? "Paiement déclaré — en vérification" : isAgency ? "À payer en agence" : "À payer";

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  async function declare(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!isValidPayerPhone(phone)) { setError(declareErrorMessage("bad_phone")); return; }
    if (!isValidOperatorReference(opRef)) { setError(declareErrorMessage("bad_operator_reference")); return; }
    setBusy(true);
    setError("");
    const proofPath = proof ? await uploadPaymentProof(user.id, proof) : null;
    const err = await onDeclare(phone.trim(), opRef.trim(), proofPath);
    setBusy(false);
    if (err) { setError(declareErrorMessage(err)); return; }
    dialogs.notify("Paiement déclaré : Rivendy le vérifie et vous prévient.", "success");
    await onDone();
  }

  return (
    <Card className={cn("p-6", highlighted ? "border-[#009688] ring-2 ring-[#009688]" : "")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#00796B]">{status}</p>
          <p className="mt-1 text-lg font-black text-slate-950">{p.title} — {money(p.amount, p.market)}</p>
          {p.note ? <p className="mt-0.5 text-sm text-slate-600">{p.note}</p> : null}
        </div>
        {!p.declaredAt ? (
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500 underline">Annuler la demande</button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Votre référence</p>
          <p className="font-mono text-2xl font-black text-slate-950">{p.reference}</p>
          {!p.declaredAt ? <p className="text-xs text-slate-500">Valable jusqu’au {dateFr(validUntil)}</p> : null}
        </div>
        <button type="button" onClick={() => copy(p.reference, "ref")}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          {copied === "ref" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copier
        </button>
        {isAgency && p.kind === "plus" ? <QrCode value={p.reference} size={110} title={`Référence ${p.reference}`} className="ml-auto" /> : null}
      </div>

      {p.declaredAt ? (
        <p className="mt-4 text-sm text-slate-600">
          Paiement déclaré le {dateTimeFr(p.declaredAt)}. Rivendy le vérifie sur le relevé de l’opérateur et vous prévient.
        </p>
      ) : isAgency && p.kind === "pass" ? (
        <p className="mt-4 text-sm text-slate-700">
          Le paiement en agence n’est pas encore possible pour le Rivendy Pass : annulez cette demande, puis débloquez le titre
          en payant par mobile money.
        </p>
      ) : isAgency ? (
        <div className="mt-4 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold text-slate-900"><Store className="h-4 w-4" aria-hidden /> Payez en espèces dans une agence Rivendy</p>
          <p className="mt-1">Montrez votre référence (ou ce QR code) à l’agent. Vos avantages s’ouvrent dès l’encaissement et vous recevez un reçu.</p>
          {(channel?.agencies ?? []).length ? (
            <ul className="mt-2 space-y-1">
              {channel!.agencies!.map((a) => (
                <li key={a.id}><strong>{a.name}</strong>{a.address ? ` — ${a.address}` : ""}{a.opening_hours ? ` · ${a.opening_hours}` : ""}{a.contact_phone ? ` · ☎ ${a.contact_phone}` : ""}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <form onSubmit={declare} className="mt-4 space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            <li className="flex flex-wrap items-center gap-2">
              <Smartphone className="h-4 w-4" aria-hidden />
              Envoyez <strong>{money(p.amount, p.market)}</strong> par {channel?.label ?? p.method}
              {channel?.account_number ? (
                <>
                  {" "}au <strong className="font-mono">{channel.account_number}</strong>
                  {channel.account_name ? ` (${channel.account_name})` : ""}
                  <button type="button" onClick={() => copy((channel.account_number ?? "").replace(/\s/g, ""), "num")}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs">
                    {copied === "num" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copier
                  </button>
                </>
              ) : null}
            </li>
            <li>Indiquez la référence <strong className="font-mono">{p.reference}</strong> dans le motif.</li>
            {channel?.instructions ? <li>{channel.instructions}</li> : null}
            <li>Déclarez votre paiement ci-dessous.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-semibold text-slate-800">Numéro qui a payé</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel"
                placeholder="+269 …" className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="block">
              <span className="font-semibold text-slate-800">Référence de la transaction (SMS)</span>
              <input value={opRef} onChange={(e) => setOpRef(e.target.value)} maxLength={80}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 font-mono" />
            </label>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Capture du paiement <span className="font-normal text-slate-500">(facultative)</span></p>
            <PaymentProofField file={proof} onChange={setProof} disabled={busy} />
          </div>
          {error ? <p role="alert" className="font-semibold text-red-700">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} J’ai payé — déclarer mon paiement
          </Button>
        </form>
      )}
    </Card>
  );
}
