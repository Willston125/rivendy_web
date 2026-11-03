"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, Smartphone, Store, X } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils/format";
import { getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import { phoneHint, validatePhone } from "@/lib/utils/phone-validator";
import type { Country } from "@/types/rivendy";
import { dialCode, marketPhone, payoutNotes, withdrawalProblem, type WalletLine } from "./wallet-markets";

type Agency = { id: string; name: string; address: string | null; opening_hours: string | null };

const PHONE_RULES = { phoneHint, validatePhone };

/**
 * Fiche de retrait d'UN marché (D-05, maquette validée le 2026-11-03).
 *
 * Rivendy paie depuis son compte de ce marché, dans sa monnaie, sans
 * conversion : la fiche ne propose donc que les moyens de CE marché — ses
 * Mobile Money actifs (mobile-money.ts, les autres grisés « bientôt ») sur un
 * numéro de ce pays, ou des espèces dans une agence Rivendy active de ce pays.
 * La demande porte `country_id` : le serveur (guard_payout_insert) lit solde,
 * minimum, devise et retraits en cours sur la ligne de ce marché.
 */
export function WithdrawDialog({
  line,
  market,
  available,
  min,
  sellerId,
  defaultPhone,
  defaultName,
  onClose,
  onSent,
}: {
  line: WalletLine;
  market: Country;
  available: number;
  min: number;
  sellerId: string;
  /** Numéro du profil, seulement pour le pays du compte. */
  defaultPhone: string | null;
  defaultName: string;
  onClose: () => void;
  onSent: (amount: number) => void;
}) {
  const titleId = useId();
  const phoneId = useId();
  const nameId = useId();
  const amountId = useId();
  const operators = getMobileMoneyForCountry(market.id).filter((m) => m.id !== "cash");
  const firstActive = operators.find((m) => m.enabled)?.id ?? null;
  const [method, setMethod] = useState<"mobile_money" | "cash">(firstActive ? "mobile_money" : "cash");
  const [operatorId, setOperatorId] = useState<string | null>(firstActive);
  const [agencies, setAgencies] = useState<Agency[] | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [name, setName] = useState(defaultName);
  const [amount, setAmount] = useState(String(available));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const money = { currency_code: market.currency_code, currency_symbol: market.currency_symbol };
  const dial = dialCode(market.id, PHONE_RULES);

  // Agences Rivendy actives du marché (lecture publique, RLS agencies_read_active).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agencies")
        .select("id, name, address, opening_hours")
        .eq("country_id", market.id)
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      const list = (data ?? []) as Agency[];
      setAgencies(list);
      setAgencyId(list[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [market.id]);

  const hasAgency = (agencies?.length ?? 0) > 0;

  async function submit() {
    if (busy) return;
    setError("");
    const value = Number(amount.replace(/\s/g, "").replace(",", "."));
    const problem = withdrawalProblem(value, available, min);
    if (problem === "amount_invalid") return setError("Indiquez un montant.");
    if (problem === "below_minimum") return setError(`Le minimum de retrait est de ${formatMoney(min, money)}.`);
    if (problem === "exceeds_available") return setError(`Vous pouvez retirer au plus ${formatMoney(available, money)}.`);
    if (!name.trim()) {
      return setError(method === "cash" ? "Indiquez qui retire l'argent à l'agence." : "Indiquez le nom du bénéficiaire.");
    }

    let phoneNumber: string | null = null;
    if (method === "mobile_money") {
      if (!operatorId) return setError("Choisissez un opérateur.");
      const checked = marketPhone(phone, market.id, market.name, PHONE_RULES);
      if ("error" in checked) return setError(checked.error);
      phoneNumber = checked.phone;
    } else if (!agencyId) {
      return setError(`Pas encore d'agence Rivendy (${market.name}) : choisissez Mobile Money.`);
    }

    setBusy(true);
    const { error: insertError } = await supabase.from("payout_requests").insert({
      seller_id: sellerId,
      country_id: market.id,
      amount: value,
      currency_code: line.currency ?? market.currency_code,
      method,
      phone_number: phoneNumber,
      notes: payoutNotes({
        method,
        operator: operators.find((m) => m.id === operatorId)?.name ?? null,
        agency: agencies?.find((a) => a.id === agencyId)?.name ?? null,
        beneficiary: name,
        channel: "Demande web",
      }),
      status: "pending_director",
    });
    setBusy(false);
    if (insertError) {
      setError("Votre demande de retrait n'a pas pu être enregistrée. Réessayez, ou contactez Rivendy depuis Aide & Support.");
      return;
    }
    onSent(value);
  }

  const choice = (on: boolean) =>
    on
      ? "border-[#00796B] bg-[#E0F2F1] font-black text-[#00594F]"
      : "border-slate-300 bg-white font-semibold text-[#1A1A1A]";

  return (
    <DialogShell labelledBy={titleId} onClose={onClose}>
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-black text-[#1A1A1A]">Retirer · {market.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Disponible : {formatMoney(available, money)} · Minimum : {formatMoney(min, money)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#1A1A1A] transition hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="rounded-2xl bg-[#E0F2F1] px-4 py-3 text-sm text-[#00594F]">
          Rivendy vous paie depuis son compte de ce marché ({market.name}), en {market.currency_code}. Aucune conversion.
        </p>

        <div role="group" aria-label="Moyen de retrait" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={method === "mobile_money"}
            disabled={!firstActive}
            onClick={() => setMethod("mobile_money")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${choice(method === "mobile_money")}`}
          >
            <Smartphone className="h-4 w-4" />
            Mobile Money
          </button>
          <button
            type="button"
            aria-pressed={method === "cash"}
            disabled={agencies !== null && !hasAgency}
            onClick={() => setMethod("cash")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${choice(method === "cash")}`}
          >
            <Store className="h-4 w-4" />
            Agence Rivendy
          </button>
        </div>
        {agencies !== null && !hasAgency && (
          <p className="-mt-2 text-xs text-slate-600">
            Pas encore d&apos;agence Rivendy ({market.name}) : retrait par Mobile Money uniquement.
          </p>
        )}

        {method === "mobile_money" ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-black text-slate-700">Opérateur ({market.name})</p>
              <div className="flex flex-wrap gap-2">
                {operators.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!m.enabled}
                    aria-pressed={operatorId === m.id}
                    onClick={() => setOperatorId(m.id)}
                    className={`min-h-10 rounded-xl border-[1.5px] px-4 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${choice(operatorId === m.id)}`}
                  >
                    {m.name}
                    {m.enabled ? "" : " · bientôt"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor={phoneId} className="mb-1.5 block text-sm font-black text-slate-700">
                Numéro Mobile Money
              </label>
              <div className="flex items-center overflow-hidden rounded-xl border-[1.5px] border-slate-300 focus-within:border-[#00796B]">
                {dial && (
                  <span className="flex min-h-12 items-center border-r border-slate-300 bg-slate-50 px-3 font-bold text-slate-700">
                    {dial}
                  </span>
                )}
                <input
                  id={phoneId}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={phoneHint(market.id).replace(/^\+\d+\s*/, "")}
                  className="min-h-12 min-w-0 flex-1 px-3 text-[#1A1A1A] outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-slate-600">Un numéro de ce pays : le vôtre ou celui d&apos;un proche.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(agencies ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={agencyId === a.id}
                onClick={() => setAgencyId(a.id)}
                className={`rounded-2xl border-[1.5px] px-4 py-3 text-left text-sm transition ${choice(agencyId === a.id)}`}
              >
                <span className="block font-black">{a.name}</span>
                {(a.address || a.opening_hours) && (
                  <span className="mt-0.5 block text-xs font-normal text-slate-600">
                    {[a.address, a.opening_hours].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="mt-0.5 block text-xs font-normal text-slate-600">En espèces, en {market.currency_code}.</span>
              </button>
            ))}
          </div>
        )}

        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-black text-slate-700">
            {method === "cash" ? "Personne qui retire" : "Nom du bénéficiaire"}
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vous ou un proche"
            className="min-h-12 w-full rounded-xl border-[1.5px] border-slate-300 px-3 text-[#1A1A1A] outline-none focus:border-[#00796B]"
          />
          {method === "cash" && (
            <p className="mt-1 text-xs text-slate-600">Elle présente une pièce d&apos;identité au guichet.</p>
          )}
        </div>

        <div>
          <label htmlFor={amountId} className="mb-1.5 block text-sm font-black text-slate-700">Montant</label>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center overflow-hidden rounded-xl border-[1.5px] border-slate-300 focus-within:border-[#00796B]">
              <input
                id={amountId}
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-h-12 min-w-0 flex-1 px-3 font-black text-[#1A1A1A] outline-none"
              />
              <span className="px-3 font-black text-slate-600">{market.currency_code}</span>
            </div>
            <button
              type="button"
              onClick={() => setAmount(String(available))}
              className="min-h-12 rounded-xl border-[1.5px] border-slate-300 bg-white px-3 text-sm font-black text-[#00796B] transition hover:bg-[#E0F2F1]"
            >
              Tout retirer
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-full border border-slate-200 bg-white px-5 font-bold text-[#1A1A1A] transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex min-h-12 items-center gap-2 rounded-full bg-[#00796B] px-6 font-black text-white transition hover:bg-[#00695C] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Envoyer la demande
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Le retrait est traité sous 24h après validation par l&apos;équipe Rivendy ({market.name}).
        </p>
      </div>
    </DialogShell>
  );
}
