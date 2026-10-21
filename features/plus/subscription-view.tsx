"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Copy, Check, Loader2, Sparkles, Store, Smartphone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode } from "@/components/ui/qr-code";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { PaymentProofField } from "@/features/seller/payment-proof-field";
import { uploadPaymentProof } from "@/lib/supabase/payment-proof";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  cancelPlusRequest, declarePlusPayment, fetchAgencyNames, fetchMyEntitlements, fetchMyPeriods,
  fetchPassNotifications, fetchPlusCatalog, type MyEntitlements,
} from "./plus-api";
import {
  declareErrorMessage, isValidOperatorReference, isValidPayerPhone, periodStatus, rejectReasons,
  requestValidUntil, type MyPeriod, type PlusChannel,
} from "./plus-logic";

const OFFER_NAMES: Record<string, string> = { month: "Rivendy+", day: "Pass Découverte", week: "Pass Semaine" };
const dateFr = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFr = (iso: string | Date) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * « Mon abonnement » Rivendy+ (Omnicanal lot B, 2026-10-21) : statut (calcul
 * unique du serveur, rivendy_entitlements), demandes à payer avec leurs
 * instructions, déclaration du paiement mobile money, référence et QR pour
 * l'agence, historique des paiements.
 */
export function SubscriptionView() {
  const { user } = useAuth();
  const { countries } = useCountry();
  const dialogs = useDialogs();
  const params = useSearchParams();
  const highlighted = params.get("demande");
  const [ent, setEnt] = useState<MyEntitlements | null>(null);
  const [periods, setPeriods] = useState<MyPeriod[] | null>(null);
  const [channels, setChannels] = useState<PlusChannel[]>([]);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [e, p, catalog, notes] = await Promise.all([
      fetchMyEntitlements(), fetchMyPeriods(), fetchPlusCatalog(null), fetchPassNotifications(),
    ]);
    setEnt(e);
    setPeriods(p);
    setChannels(catalog.channels ?? []);
    setReasons(rejectReasons(notes));
    const ids = [...new Set((p ?? []).map((x) => x.agency_id).filter((x): x is string => !!x))];
    setAgencyNames(await fetchAgencyNames(ids));
    setLoading(false);
  }, []);

  useEffect(() => { if (user) void Promise.resolve().then(() => load()); }, [user, load]);

  const money = useCallback((amount: number, market: string) => {
    const c = countries.find((x) => x.id === market);
    return formatMoney(amount, c ?? { currency_code: market === "KM" ? "KMF" : "", currency_symbol: "" });
  }, [countries]);

  const now = useMemo(() => new Date(), [periods]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = (periods ?? []).filter((p) => p.status === "pending");
  const history = (periods ?? []).filter((p) => p.status !== "pending");

  async function cancel(p: MyPeriod) {
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

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><Card className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-black text-slate-950">
        <Sparkles className="h-7 w-7 text-[#009688]" /> Mon abonnement
      </h1>

      <Card className="p-6">
        {ent?.active_until ? (
          <>
            <p className="text-lg font-bold text-slate-950">{ent.label || "Rivendy+"} est actif</p>
            <p className="mt-1 text-sm text-slate-600">Jusqu’au {dateTimeFr(ent.active_until)} — sur le site et dans l’application.</p>
            {(ent.simultaneous_streams ?? 0) >= 2 ? (
              <p className="mt-1 text-sm text-slate-600">{ent.simultaneous_streams} écrans en même temps.</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-slate-950">Aucun abonnement actif</p>
            <Link href="/plus" className={buttonVariants({ className: "mt-4" })}>Découvrir Rivendy+</Link>
          </>
        )}
      </Card>

      {pending.map((p) => (
        <PendingRequest key={p.id} period={p} highlighted={p.id === highlighted}
          channel={channels.find((c) => c.code === p.payment_channel) ?? null}
          money={money} onDone={load} onCancel={() => cancel(p)} />
      ))}

      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-950">Historique des paiements</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun paiement pour l’instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {history.map((p) => {
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
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    st.tone === "active" ? "bg-[#E0F2F1] text-[#00796B]" : st.tone === "refused" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600")}>
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PendingRequest({
  period: p, channel, highlighted, money, onDone, onCancel,
}: {
  period: MyPeriod;
  channel: PlusChannel | null;
  highlighted: boolean;
  money: (amount: number, market: string) => string;
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
  const status = periodStatus(p, new Date());
  const isAgency = p.payment_channel === "agency";
  const validUntil = requestValidUntil(p.created_at);

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
    const err = await declarePlusPayment(p.id, phone.trim(), opRef.trim(), proofPath);
    setBusy(false);
    if (err) { setError(declareErrorMessage(err)); return; }
    dialogs.notify("Paiement déclaré : Rivendy le vérifie et vous prévient.", "success");
    await onDone();
  }

  return (
    <Card className={cn("p-6", highlighted ? "border-[#009688] ring-2 ring-[#009688]" : "")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-950">{OFFER_NAMES[p.plan] ?? p.plan} — {money(Number(p.price_paid), p.country_id)}</p>
          <p className="mt-0.5 text-sm text-slate-600">{status.label}</p>
        </div>
        {!p.declared_at ? (
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500 underline">Annuler la demande</button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Votre référence</p>
          <p className="font-mono text-2xl font-black text-slate-950">{p.payment_reference}</p>
          {!p.declared_at ? <p className="text-xs text-slate-500">Valable jusqu’au {dateFr(validUntil)}</p> : null}
        </div>
        <button type="button" onClick={() => copy(p.payment_reference, "ref")}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          {copied === "ref" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copier
        </button>
        {isAgency ? <QrCode value={p.payment_reference} size={110} title={`Référence ${p.payment_reference}`} className="ml-auto" /> : null}
      </div>

      {p.declared_at ? (
        <p className="mt-4 text-sm text-slate-600">
          Paiement déclaré le {dateTimeFr(p.declared_at)}. Rivendy le vérifie sur le relevé de l’opérateur et vous prévient.
        </p>
      ) : isAgency ? (
        <div className="mt-4 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold text-slate-900"><Store className="h-4 w-4" /> Payez en espèces dans une agence Rivendy</p>
          <p className="mt-1">Montrez votre référence (ou ce QR code) à l’agent. Vos avantages s’ouvrent dès l’encaissement et vous recevez un reçu.</p>
          {(channel?.agencies ?? []).length ? (
            <ul className="mt-2 space-y-1">
              {channel!.agencies!.map((a) => (
                <li key={a.id}><strong>{a.name}</strong>{a.address ? ` — ${a.address}` : ""}{a.opening_hours ? ` · ${a.opening_hours}` : ""}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <form onSubmit={declare} className="mt-4 space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            <li className="flex flex-wrap items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Envoyez <strong>{money(Number(p.price_paid), p.country_id)}</strong> par {channel?.label ?? p.payment_method}
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
            <li>Indiquez la référence <strong className="font-mono">{p.payment_reference}</strong> dans le motif.</li>
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
