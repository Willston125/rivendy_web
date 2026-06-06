"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import type { AppOrder } from "@/types/rivendy";

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
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
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

      // 2. Charger le solde réel du portefeuille vendeur
      const { data: walletData } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletData && walletData.balance != null) {
        setWalletBalance(Number(walletData.balance));
      } else {
        setWalletBalance(0);
      }

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
  const pendingOrders = orders.filter((o) => o.payment_status === "pending_cash");
  const deliveredOrders = orders.filter((o) => o.payment_status === "delivered");

  const confirmedEarnings = walletBalance;
  const pendingEarnings = pendingOrders.reduce(
    (sum, o) => sum + Number(o.total_seller_amount || 0),
    0,
  );

  const MIN_WITHDRAW = country.id === "KM" ? 5000 : 2000;
  const canWithdraw = confirmedEarnings >= MIN_WITHDRAW;

  // ── Demande de retrait via WhatsApp ────────────────────────
  async function requestWithdrawal() {
    if (!user || !canWithdraw) return;
    setWithdrawLoading(true);
    setMessage("");

    const amountStr = formatMoney(confirmedEarnings, country);
    const name = profile?.full_name || profile?.store_name || user.email || "Vendeur";
    const whatsapp = normalizePhoneForWhatsApp(country.whatsapp_number);

    // Enregistrer dans Supabase
    await supabase.from("payout_requests").insert({
      seller_id: user.id,
      country_id: country.id,
      amount: confirmedEarnings,
      currency_code: country.currency_code,
      method: "whatsapp",
      phone_number: country.whatsapp_number,
      notes: `Demande web — ${deliveredOrders.length} commande(s) livrée(s)`,
      status: "pending_director",
    }).then(() => null, () => null);

    // Ouvrir WhatsApp
    const text =
      `💰 DEMANDE DE RETRAIT — Rivendy\n\n` +
      `👤 Vendeur : ${name}\n` +
      `💵 Montant : ${amountStr}\n` +
      `📦 Commandes confirmées : ${deliveredOrders.length}\n\n` +
      `Merci de traiter ce retrait.`;

    if (whatsapp) {
      window.open(
        `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setMessage("Demande de retrait envoyée ✅ — L'équipe Rivendy vous contactera sous 24h.");
    setWithdrawLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
      </div>
    );
  }

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
        <p className="mt-1 text-4xl font-black">{formatMoney(confirmedEarnings, country)}</p>

        {pendingEarnings > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/80">
            <Clock className="h-3.5 w-3.5" />
            {formatMoney(pendingEarnings, country)} en attente
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
          <span>ℹ️</span>
          Commission Rivendy : 5% par vente
        </div>

        {/* Seuil retrait */}
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
          canWithdraw ? "bg-white/15 text-white/80" : "bg-orange-500/30 text-white/80"
        }`}>
          {canWithdraw ? "🔓" : "🔒"}
          {canWithdraw ? "Retrait disponible" : `Retrait à partir de ${formatMoney(MIN_WITHDRAW, country)}`}
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
          <a
            href={`https://wa.me/${normalizePhoneForWhatsApp(country.whatsapp_number)}?text=${encodeURIComponent("Bonjour Rivendy, j'ai besoin d'aide avec mon portefeuille.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-black text-white transition hover:bg-white/30"
          >
            <MessageCircle className="h-4 w-4" />
            Support
          </a>
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
        <div className="flex flex-wrap gap-2">
          {[
            { label: "D-Money",  color: "#1976D2" },
            { label: "Waafi",    color: "#388E3C" },
            { label: "Virement", color: "#6A5ACD" },
          ].map(({ label, color }) => (
            <span
              key={label}
              style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
              className="rounded-xl border px-3 py-1.5 text-xs font-black"
            >
              {label}
            </span>
          ))}
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
                        {tx.type}
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
                      {isCredit ? "+" : "-"} {formatMoney(Math.abs(tx.amount), country)}
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
