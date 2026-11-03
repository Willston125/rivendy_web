"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle,
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  Package,
  Receipt,
  Unlock,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry, useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import { minWithdrawalFor } from "@/lib/utils/seller-offer-prices";
import { getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import type { AppOrder, Country } from "@/types/rivendy";
import {
  PENDING_PAYOUT_STATUSES,
  availableFor,
  isCreditType,
  pendingByMarket,
  splitWalletLines,
  toWalletLines,
  type WalletLine,
} from "./wallet-markets";
import { WithdrawDialog } from "./withdraw-dialog";

/** Libellés lisibles des types de mouvement (le code technique s'affichait tel quel). */
const TX_TYPE_LABELS: Record<string, string> = {
  credit: "Crédit",
  order_credit: "Vente",
  debit: "Débit",
  payout: "Retrait",
  withdrawal: "Retrait",
  refund: "Remboursement",
  refund_credit: "Remboursement",
  adjustment: "Ajustement",
  commission: "Commission",
  commission_debit: "Commission",
  bonus: "Bonus",
};

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

/**
 * Mes Gains — UN portefeuille, UN SOLDE PAR MARCHÉ (audit des paramètres,
 * D-05, maquette validée le 2026-11-03).
 *
 * Une vente crédite la ligne `wallets` du marché de la commande, dans sa
 * monnaie. La ligne du pays du compte garde la carte en dégradé ; les autres
 * marchés suivent, chacun avec son solde, son minimum et son « Retirer ».
 * Rivendy paie un retrait depuis son compte de ce marché, dans sa monnaie :
 * on n'additionne jamais deux lignes.
 */
export function WalletView() {
  const { user, profile } = useAuth();
  const country = useCountryOrDefault();
  const { countries } = useCountry();
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [lines, setLines] = useState<WalletLine[]>([]);
  const [pending, setPending] = useState<Map<string, number>>(new Map());
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawLine, setWithdrawLine] = useState<WalletLine | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Charger les commandes vendeur (pour stats et gains en attente)
      // Audit 21 (DBSEC-7) : seller_orders() au lieu d'une lecture directe
      // d'orders (plus de coordonnées acheteur côté vendeur).
      const { data: ordersData } = await supabase
        .rpc("seller_orders", { p_limit: 50, p_offset: 0 });

      setOrders(
        ((ordersData ?? []) as Array<Record<string, unknown>>).map((row) => ({
          ...row,
          items: row.order_items,
        }) as AppOrder),
      );

      // 2. Portefeuille : UNE LIGNE PAR MARCHÉ (D-05). Plus de maybeSingle() :
      //    avec deux lignes, il renvoyait une erreur ignorée et le solde
      //    s'affichait à 0.
      const { data: walletData } = await supabase
        .from("wallets")
        .select("id, balance, currency, country_id")
        .eq("user_id", user.id);
      setLines(toWalletLines(walletData as Array<Record<string, unknown>> | null));

      // 2 bis. Retraits déjà demandés et pas encore versés, PAR MARCHÉ.
      const { data: payoutRows } = await supabase
        .from("payout_requests")
        .select("amount, country_id")
        .eq("seller_id", user.id)
        .in("status", PENDING_PAYOUT_STATUSES);
      setPending(pendingByMarket(payoutRows as Array<{ amount: unknown; country_id: unknown }> | null));

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
  const DELIVERED_STATUSES = ["completed", "delivered", "delivered_by_rider", "delivered_confirmed"];
  const pendingOrders = orders.filter(
    (o) => !DELIVERED_STATUSES.includes(o.status) && o.status !== "cancelled" && o.status !== "disputed",
  );
  const deliveredOrders = orders.filter((o) => DELIVERED_STATUSES.includes(o.status));

  const marketOf = (id: string | null): Country | null => (id && countries.find((c) => c.id === id)) || null;
  const nameOf = (id: string) => marketOf(id)?.name ?? id;
  const { main, others } = splitWalletLines(lines, profile?.country_id, nameOf);
  const lineById = new Map(lines.map((l) => [l.id, l]));
  // Monnaie d'une ligne : celle de son marché (repli : sa devise, puis le marché affiché).
  const moneyOf = (line: WalletLine | null | undefined) =>
    marketOf(line?.country_id ?? null)
      ?? (line?.currency ? { currency_symbol: line.currency, currency_code: line.currency } : country);

  // Sans aucune ligne (rien encore versé), la carte principale montre 0 dans
  // le marché affiché, avec son minimum.
  const mainMarket = main ? marketOf(main.country_id) : country;
  const mainMoney = main ? moneyOf(main) : country;
  const mainAvailable = main ? availableFor(main, pending) : 0;
  const mainPending = main ? (pending.get(main.country_id ?? "") ?? 0) : 0;
  // ~10 € dans la monnaie DE LA LIGNE (DV-1) — miroir app + serveur.
  const mainMin = minWithdrawalFor(main?.country_id ?? country?.id);
  const mainCanWithdraw = !!main && !!mainMarket && mainAvailable >= mainMin;
  const singleMarketMethods = main && others.length === 0 && main.country_id
    ? getMobileMoneyForCountry(main.country_id).filter((m) => m.id !== "cash")
    : [];

  function onSent(line: WalletLine, amount: number) {
    setWithdrawLine(null);
    setPending((prev) => {
      const next = new Map(prev);
      next.set(line.country_id ?? "", (next.get(line.country_id ?? "") ?? 0) + amount);
      return next;
    });
    setMessage(
      `Demande de retrait de ${formatMoney(amount, moneyOf(line))} enregistrée ✅ — ` +
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

  const withdrawMarket = withdrawLine ? marketOf(withdrawLine.country_id) : null;

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

      {/* Message retrait */}
      {message && (
        <div className="mb-5 rounded-2xl bg-[#E0F2F1] px-4 py-3 text-sm font-semibold text-[#00796B]">
          {message}
        </div>
      )}

      {/* Carte gains principale : la ligne du pays du compte */}
      <div className="mb-5 rounded-3xl bg-gradient-to-br from-[#009688] to-[#00C4B4] p-6 text-white shadow-xl shadow-[#007168]/20">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white/80">Gains confirmés</p>
          {mainMarket && (
            <span className="rounded-xl bg-white/20 px-3 py-1 text-xs font-black">
              {mainMarket.id} · {mainMarket.name}
            </span>
          )}
        </div>
        <p className="mt-1 text-4xl font-black">{formatMoney(main?.balance ?? 0, mainMoney)}</p>

        {mainPending > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90">
            <Clock className="h-3.5 w-3.5" />
            {formatMoney(mainPending, mainMoney)} de retrait en cours
          </div>
        )}

        {/* La commission s'AJOUTE au prix vendeur (grille par prix du
            2026-10-02) : le vendeur encaisse exactement son prix. */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/80">
          <span>ℹ️</span>
          Vous encaissez exactement votre prix vendeur — la commission est payée par l&apos;acheteur
        </div>

        {/* Seuil retrait */}
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
          mainCanWithdraw ? "bg-white/15 text-white/90" : "bg-orange-500/30 text-white/90"
        }`}>
          {mainCanWithdraw ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {mainCanWithdraw
            ? `Retrait disponible : ${formatMoney(mainAvailable, mainMoney)}`
            : `Retrait à partir de ${formatMoney(mainMin, mainMoney)}`}
        </div>

        {/* Actions */}
        <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!mainCanWithdraw}
            onClick={() => main && setWithdrawLine(main)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-black text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowUpRight className="h-4 w-4" />
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

      {/* Les autres marchés : chacun son solde, sa monnaie, son retrait */}
      {others.length > 0 && (
        <section aria-labelledby="autres-marches" className="mb-5">
          <h2 id="autres-marches" className="text-lg font-black text-[#1A1A1A]">Vos gains dans d&apos;autres marchés</h2>
          <p className="mt-1 text-sm text-slate-600">
            Payés par Rivendy depuis son compte de ce marché, dans sa monnaie. Ils ne s&apos;additionnent jamais.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            {others.map((line) => {
              const market = marketOf(line.country_id);
              const money = moneyOf(line);
              const available = availableFor(line, pending);
              const inFlight = pending.get(line.country_id ?? "") ?? 0;
              const min = minWithdrawalFor(line.country_id);
              const canWithdraw = !!market && available >= min;
              const methods = line.country_id
                ? getMobileMoneyForCountry(line.country_id).filter((m) => m.id !== "cash" && m.enabled).map((m) => m.name)
                : [];
              return (
                <div key={line.id} className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm sm:max-w-[460px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E0F2F1] text-xs font-black text-[#00695C]">
                        {line.country_id}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-black text-[#1A1A1A]">{market?.name ?? line.country_id}</span>
                        <span className="text-xs text-slate-600">{market?.currency_code ?? line.currency}</span>
                      </span>
                    </div>
                    <span className="text-xl font-black text-[#1A1A1A]">{formatMoney(line.balance, money)}</span>
                  </div>
                  {inFlight > 0 && (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-800">
                      <Clock className="h-3.5 w-3.5" />
                      {formatMoney(inFlight, money)} de retrait en cours
                    </span>
                  )}
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                    canWithdraw ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                  }`}>
                    {canWithdraw ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {canWithdraw
                      ? `Retrait disponible : ${formatMoney(available, money)}`
                      : `Retrait à partir de ${formatMoney(min, money)}`}
                  </span>
                  <p className="text-sm text-slate-600">
                    Vente faite dans ce marché : l&apos;argent est sur le compte Rivendy de ce marché.
                    {methods.length > 0 ? ` Retrait par ${methods.join(", ")} ou à l'agence Rivendy.` : " Retrait à l'agence Rivendy."}
                  </p>
                  <button
                    type="button"
                    disabled={!canWithdraw}
                    onClick={() => setWithdrawLine(line)}
                    className="inline-flex w-fit items-center gap-2 rounded-full bg-[#00796B] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#00695C] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Retirer ({market?.name ?? line.country_id})
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Stats rapides */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <Receipt className="mx-auto h-5 w-5 text-[#6A5ACD]" />
          <p className="mt-2 text-xl font-black text-[#6A5ACD]">{orders.length}</p>
          <p className="text-xs font-semibold text-slate-500">Ventes totales</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <CheckCircle className="mx-auto h-5 w-5 text-green-600" />
          <p className="mt-2 text-xl font-black text-green-600">{deliveredOrders.length}</p>
          <p className="text-xs font-semibold text-slate-500">Livrées</p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
          <Clock className="mx-auto h-5 w-5 text-orange-600" />
          <p className="mt-2 text-xl font-black text-orange-600">{pendingOrders.length}</p>
          <p className="text-xs font-semibold text-slate-500">En attente</p>
        </div>
      </div>

      {/* Méthodes de retrait : vendeur d'un seul marché (avec plusieurs
          marchés, chaque fiche de retrait montre les siennes). */}
      {others.length === 0 && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black text-[#1A1A1A]">Méthodes de retrait</h2>
          <div className="flex flex-wrap gap-2">
            {singleMarketMethods.length > 0 ? (
              singleMarketMethods.map(({ id, name, color, enabled }) => (
                <span
                  key={id}
                  style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-black ${enabled ? "" : "opacity-50"}`}
                >
                  {name}{enabled ? "" : " · bientôt"}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-600">Versement organisé par l&apos;agence Rivendy de votre pays.</span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Le retrait est traité sous 24h après validation par l&apos;équipe Rivendy.
          </p>
        </div>
      )}

      {/* Historique des transactions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1A1A1A]">Historique des transactions</h2>
          <span className="text-sm text-slate-500">
            {transactions.length} transaction{transactions.length > 1 ? "s" : ""}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F2F1]">
              <Wallet className="h-7 w-7 text-[#009688]" />
            </div>
            <p className="mt-4 font-bold text-[#1A1A1A]">Aucune transaction pour le moment</p>
            <p className="mt-1 text-sm text-slate-500">
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
              // Le TYPE donne le signe : en base tous les montants sont
              // positifs, un retrait s'affichait donc en vert avec « + ».
              const isCredit = isCreditType(tx.type);
              const txLine = lineById.get(tx.wallet_id);
              const txMarket = marketOf(txLine?.country_id ?? null);
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">{formatDate(tx.created_at)}</span>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                      </span>
                      {lines.length > 1 && txMarket && (
                        <span className="inline-block rounded-md bg-[#E0F2F1] px-2 py-0.5 text-[10px] font-black text-[#00695C]">
                          {txMarket.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Montant, dans la monnaie de SA ligne */}
                  <div className="text-right">
                    <p
                      className={`text-sm font-black ${
                        isCredit ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCredit ? "+" : "-"} {formatMoney(Math.abs(tx.amount), moneyOf(txLine))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {withdrawLine && withdrawMarket && user && (
        <WithdrawDialog
          line={withdrawLine}
          market={withdrawMarket}
          available={availableFor(withdrawLine, pending)}
          min={minWithdrawalFor(withdrawLine.country_id)}
          sellerId={user.id}
          defaultPhone={withdrawLine.country_id === profile?.country_id ? (profile?.whatsapp_number ?? null) : null}
          defaultName={profile?.full_name ?? ""}
          onClose={() => setWithdrawLine(null)}
          onSent={(amount) => onSent(withdrawLine, amount)}
        />
      )}
    </div>
  );
}
