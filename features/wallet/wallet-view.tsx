"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle,
  Clock,
  Loader2,
  MessageCircle,
  Package,
  Receipt,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry, useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import { minWithdrawalFor } from "@/lib/utils/seller-offer-prices";
import { getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import type { AppOrder, Country } from "@/types/rivendy";

/** Libellés lisibles des types de mouvement (le code technique s'affichait tel quel). */
const TX_TYPE_LABELS: Record<string, string> = {
  credit: "Crédit",
  order_credit: "Vente",
  debit: "Débit",
  payout: "Retrait",
  withdrawal: "Retrait",
  refund: "Remboursement",
  adjustment: "Ajustement",
  commission: "Commission",
};

/** Demandes de retrait encore en cours (mêmes statuts que l'app). */
const PENDING_PAYOUT_STATUSES = ["pending_director", "approved_director", "pending_ceo", "approved_ceo"];

type WalletRow = { balance: number | string | null; currency: string | null; country_id: string | null };

const MONTHS = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface WalletTransaction {
  id: string;
  wallet_id: string;
  order_id: string | null;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export function WalletView() {
  const { user, profile } = useAuth();
  const country = useCountryOrDefault();
  const { countries } = useCountry();
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState<number>(0);
  const withdrawingRef = useRef(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Charger les commandes vendeur (pour stats et gains en attente)
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setOrders(
        ((ordersData ?? []) as Array<Record<string, unknown>>).map((row) => ({
          ...row,
          items: row.order_items,
        }) as AppOrder),
      );

      // 2. Portefeuille : solde, DEVISE et PAYS. Un portefeuille par vendeur,
      //    sa devise est figée au premier crédit — c'est elle qui fait foi pour
      //    un retrait, jamais le marché affiché à l'écran.
      const { data: walletData } = await supabase
        .from("wallets")
        .select("balance, currency, country_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setWallet((walletData as WalletRow | null) ?? null);

      // 2 bis. Retraits déjà demandés et pas encore versés (comme l'app,
      //    WalletService.getPendingPayoutRequests).
      const { data: payoutRows } = await supabase
        .from("payout_requests")
        .select("amount, status")
        .eq("seller_id", user.id)
        .in("status", PENDING_PAYOUT_STATUSES);
      setPendingPayouts(
        ((payoutRows ?? []) as Array<{ amount: number | string | null }>).reduce(
          (sum, p) => sum + Number(p.amount ?? 0),
          0,
        ),
      );

      // 3. Charger l'historique des transactions financières
      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setTransactions(txData ?? []);
    } catch (err) {
      console.error("Error loading wallet details:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Calculs ────────────────────────────────────────────────
  // L'état livré vit dans `status` (delivered / delivered_by_rider /
  // delivered_confirmed / completed) — même convention que seller-dashboard.
  // `payment_status` ne prend que pending_cash/paid au checkout : l'ancien
  // filtre `payment_status === "delivered"` comptait toujours 0.
  const DELIVERED_STATUSES = ["completed", "delivered", "delivered_by_rider", "delivered_confirmed"];
  // Commandes en cours (non livrées, non annulées) — compteur seulement :
  // payment_status n'est jamais remis à jour au versement, il ne dit pas
  // si l'argent est encore « en attente ».
  const pendingOrders = orders.filter(
    (o) => !DELIVERED_STATUSES.includes(o.status) && o.status !== "cancelled" && o.status !== "disputed",
  );
  const deliveredOrders = orders.filter((o) => DELIVERED_STATUSES.includes(o.status));

  // Pays et devise DU PORTEFEUILLE (repli : marché affiché, si aucun portefeuille).
  const walletCountry: Country | null =
    (wallet?.country_id && countries.find((c) => c.id === wallet.country_id)) || null;
  const money = walletCountry
    ?? (wallet?.currency ? { currency_symbol: wallet.currency, currency_code: wallet.currency } : country);
  const walletCountryId = wallet?.country_id ?? null;

  const confirmedEarnings = Number(wallet?.balance ?? 0);
  // « En attente » = retraits demandés et pas encore versés, comme l'app.
  const pendingEarnings = pendingPayouts;
  // Disponible = solde moins ce qui est déjà demandé : redemander le même
  // argent créait une seconde demande pour les mêmes fonds.
  const availableToWithdraw = Math.max(0, confirmedEarnings - pendingPayouts);

  // Seuil : 5 000 KMF aux Comores, 2 000 ailleurs (décision du 2026-08-11),
  // selon le pays DU PORTEFEUILLE.
  // ~10 € dans la devise du portefeuille (DV-1, 2026-10-08) — miroir app + serveur.
  // Sans portefeuille encore (aucune vente versée), le minimum se lit sur le
  // marché actif : il s'affichait « Retrait à partir de 0 FDJ ».
  const MIN_WITHDRAW = minWithdrawalFor(walletCountryId ?? country?.id);
  const canWithdraw = !!wallet && !!walletCountryId && availableToWithdraw >= MIN_WITHDRAW;
  const withdrawalMethods = walletCountryId
    ? getMobileMoneyForCountry(walletCountryId).filter((m) => m.id !== "cash")
    : [];

  // ── Demande de retrait — elle vit dans le DASHBOARD ────────
  // Deux défauts corrigés le 2026-09-11, tous deux silencieux :
  //
  // 1. l'erreur de l'INSERT était JETÉE (`.then(() => null, () => null)`),
  //    puis « Demande de retrait envoyée ✅ » s'affichait quoi qu'il arrive.
  //    Une demande pouvait disparaître sans que le vendeur le sache, et sans
  //    laisser la moindre trace dans le dashboard ;
  // 2. `phone_number` recevait le numéro de l'AGENCE. Or le dashboard
  //    l'affiche à l'opérateur comme la destination du virement (Finances →
  //    Retraits) : il y lisait le numéro de Rivendy au lieu de celui du
  //    vendeur.
  async function requestWithdrawal() {
    // Verrou posé AVANT tout await : deux clics = une seule demande.
    if (!user || !wallet || !walletCountryId || !canWithdraw || withdrawingRef.current) return;
    withdrawingRef.current = true;
    setWithdrawLoading(true);
    setMessage("");

    // P0 (audit 2026-10-04) : pays et devise du PORTEFEUILLE. Le site prenait
    // le marché affiché : un vendeur comorien qui naviguait sur Djibouti
    // demandait son solde en KMF libellé FDJ, adressé au directeur de Djibouti.
    const amount = availableToWithdraw;
    const { error } = await supabase.from("payout_requests").insert({
      seller_id: user.id,
      country_id: walletCountryId,
      amount,
      currency_code: wallet.currency ?? walletCountry?.currency_code ?? "",
      method: "mobile_money",
      // Le numéro du VENDEUR, jamais celui de l'agence. À défaut NULL :
      // mieux vaut que l'opérateur le réclame qu'un numéro faux.
      phone_number: profile?.whatsapp_number || null,
      notes: `Demande web — ${deliveredOrders.length} commande(s) livrée(s)`,
      status: "pending_director",
    });

    setWithdrawLoading(false);
    withdrawingRef.current = false;

    if (error) {
      setMessage(
        "Votre demande de retrait n'a pas pu être enregistrée. Réessayez, " +
          "ou contactez Rivendy depuis Aide & Support.",
      );
      return;
    }

    setPendingPayouts((p) => p + amount);
    setMessage(
      `Demande de retrait de ${formatMoney(amount, money)} enregistrée ✅ — ` +
        "l'équipe Rivendy la traite et vous contactera.",
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
      </div>
    );
  }

  if (!country) return null;

  return (
    <div className="w-full">

      {/* En-tête */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Vendeur</p>
          <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Mes Gains 💰</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-full bg-[#E0F2F1] px-4 py-2 text-xs font-bold text-[#009688] transition hover:bg-[#009688] hover:text-white"
        >
          <Receipt className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {/* Carte gains principale */}
      <div className="mb-5 rounded-3xl bg-gradient-to-br from-[#009688] to-[#00C4B4] p-6 text-white shadow-xl shadow-[#007168]/20">
        <p className="text-sm font-semibold text-white/70">Gains confirmés</p>
        <p className="mt-1 text-4xl font-black">{formatMoney(confirmedEarnings, money)}</p>

        {pendingEarnings > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/80">
            <Clock className="h-3.5 w-3.5" />
            {formatMoney(pendingEarnings, money)} de retrait en cours
          </div>
        )}

        {/* La commission s'AJOUTE au prix vendeur (grille par prix du
            2026-10-02) : le vendeur encaisse exactement son prix. */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
          <span>ℹ️</span>
          Vous encaissez exactement votre prix vendeur — la commission est payée par l&apos;acheteur
        </div>

        {/* Seuil retrait */}
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
          canWithdraw ? "bg-white/15 text-white/80" : "bg-orange-500/30 text-white/80"
        }`}>
          {canWithdraw ? "🔓" : "🔒"}
          {canWithdraw
            ? `Retrait disponible : ${formatMoney(availableToWithdraw, money)}`
            : `Retrait à partir de ${formatMoney(MIN_WITHDRAW, money)}`}
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!canWithdraw || withdrawLoading}
            onClick={requestWithdrawal}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-black text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {withdrawLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}
            Retirer
          </button>
          {/* Plus de WhatsApp (2026-10-09) : l'aide passe par la page Aide. */}
          <Link
            href="/help?sujet=payment"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-black text-white transition hover:bg-white/30"
          >
            <MessageCircle className="h-4 w-4" />
            Support
          </Link>
        </div>
      </div>

      {/* Message retrait */}
      {message && (
        <div className="mb-5 rounded-2xl bg-[#E0F2F1] px-4 py-3 text-sm font-semibold text-[#009688]">
          {message}
        </div>
      )}

      {/* Stats rapides */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <Receipt className="mx-auto h-5 w-5 text-[#6A5ACD]" />
          <p className="mt-2 text-xl font-black text-[#6A5ACD]">{orders.length}</p>
          <p className="text-xs font-semibold text-slate-400">Ventes totales</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <CheckCircle className="mx-auto h-5 w-5 text-green-500" />
          <p className="mt-2 text-xl font-black text-green-500">{deliveredOrders.length}</p>
          <p className="text-xs font-semibold text-slate-400">Livrées</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <Clock className="mx-auto h-5 w-5 text-orange-500" />
          <p className="mt-2 text-xl font-black text-orange-500">{pendingOrders.length}</p>
          <p className="text-xs font-semibold text-slate-400">En attente</p>
        </div>
      </div>

      {/* Méthodes de retrait */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-[#1A1A1A]">Méthodes de retrait</h2>
        {/* Opérateurs du pays DU PORTEFEUILLE (mobile-money.ts, miroir de
            l'app) — l'ancienne liste affichait ceux de Djibouti partout. */}
        <div className="flex flex-wrap gap-2">
          {withdrawalMethods.length > 0 ? (
            withdrawalMethods.map(({ id, name, color, enabled }) => (
              <span
                key={id}
                style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
                className={`rounded-xl border px-3 py-1.5 text-xs font-black ${enabled ? "" : "opacity-50"}`}
              >
                {name}{enabled ? "" : " · bientôt"}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500">Versement organisé par l&apos;agence Rivendy de votre pays.</span>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Le retrait est traité sous 24h après validation par l&apos;équipe Rivendy.
        </p>
      </div>

      {/* Historique des transactions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1A1A1A]">Historique des transactions</h2>
          <span className="text-sm text-slate-400">
            {transactions.length} transaction{transactions.length > 1 ? "s" : ""}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
              <Wallet className="h-7 w-7 text-[#009688]" />
            </div>
            <p className="mt-4 font-bold text-[#1A1A1A]">Aucune transaction pour le moment</p>
            <p className="mt-1 text-sm text-slate-400">
              Publiez un article et commencez à générer des gains dès aujourd&apos;hui.
            </p>
            <Link
              href="/sell"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-[#009688] px-6 text-sm font-black text-white transition hover:bg-[#00796B]"
            >
              <Package className="h-4 w-4" />
              Publier un article
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const isCredit = tx.type === "credit" || tx.type === "order_credit" || tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  {/* Icon status */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      isCredit
                        ? "bg-[#E0F2F1]"
                        : "bg-red-50"
                    }`}
                  >
                    {isCredit ? (
                      <CheckCircle className="h-5 w-5 text-[#009688]" />
                    ) : (
                      <Clock className="h-5 w-5 text-red-500" />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold text-[#1A1A1A]">
                      {tx.description || (isCredit ? "Crédit portefeuille" : "Débit portefeuille")}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-slate-400">{formatDate(tx.created_at)}</span>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                      </span>
                    </div>
                  </div>

                  {/* Montant */}
                  <div className="text-right">
                    <p
                      className={`text-sm font-black ${
                        isCredit ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {isCredit ? "+" : "-"} {formatMoney(Math.abs(tx.amount), money)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
