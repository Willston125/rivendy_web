"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Rocket,
  ShoppingBag,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductStatusBadge } from "@/features/products/product-status-badge";
import { supabase } from "@/lib/supabase/client";
import { firstPhoto, formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import type { AppOrder, OrderStatus, Product } from "@/types/rivendy";

/* ── Statuts commande vendeur ────────────────────────────────────── */
const ORDER_STATUS: Partial<Record<OrderStatus, { label: string; bg: string; text: string }>> = {
  pending_whatsapp:              { label: "En attente",     bg: "bg-amber-50",  text: "text-amber-700" },
  confirmed_by_customer_service: { label: "Confirmée",      bg: "bg-blue-50",   text: "text-blue-700" },
  payment_received_cash:         { label: "Paiement reçu",  bg: "bg-[#E0F2F1]", text: "text-[#009688]" },
  assigned_to_delivery:          { label: "Livreur assigné", bg: "bg-indigo-50", text: "text-indigo-700" },
  accepted_by_agent:             { label: "Pris en charge",  bg: "bg-indigo-50", text: "text-indigo-700" },
  picked_up:                     { label: "Récupérée",       bg: "bg-violet-50", text: "text-violet-700" },
  en_route:                      { label: "En route",       bg: "bg-cyan-50",   text: "text-cyan-700" },
  arrived:                       { label: "Livreur arrivé",  bg: "bg-amber-50",  text: "text-amber-800" },
  code_generated:                { label: "Code envoyé",     bg: "bg-amber-50",  text: "text-amber-800" },
  awaiting_customer_confirmation:{ label: "Livreur chez vous", bg: "bg-amber-50", text: "text-amber-800" },
  delivered_by_rider:            { label: "Livrée ✓",       bg: "bg-[#E0F2F1]", text: "text-[#009688]" },
  completed:                     { label: "Terminée ✓",     bg: "bg-[#E0F2F1]", text: "text-[#009688]" },
  cancelled:                     { label: "Annulée",         bg: "bg-red-50",    text: "text-red-600" },
  delivered:                     { label: "Livrée ✓",        bg: "bg-[#E0F2F1]", text: "text-[#009688]" },
};

/* ── Skeleton ────────────────────────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10 space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-2xl bg-slate-100" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <div className="h-5 w-5 rounded bg-slate-100" />
            <div className="h-7 w-24 rounded-full bg-slate-100" />
            <div className="h-3 w-20 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Métrique ────────────────────────────────────────────────────── */
function Metric({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-2 rounded-2xl border p-5 shadow-sm",
      accent ? "border-[#009688]/20 bg-[#E0F2F1]" : "border-slate-100 bg-white"
    )}>
      <Icon className={cn("h-5 w-5", accent ? "text-[#009688]" : "text-slate-400")} />
      <p className={cn("text-2xl font-black", accent ? "text-[#009688]" : "text-slate-900")}>{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

/* ── Vue principale ─────────────────────────────────────────────── */
export function SellerDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const { country } = useCountry();

  const [products, setProducts]           = useState<Product[]>([]);
  const [orders, setOrders]               = useState<AppOrder[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading]             = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [message, setMessage]             = useState<{ text: string; type: "ok" | "err" } | null>(null);

  /* ── Chargement ─────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!user) return;
    const [prodResp, orderResp, walletResp] = await Promise.all([
      supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("*, order_items(*)").eq("seller_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    ]);
    setProducts((prodResp.data ?? []) as Product[]);
    setOrders(
      ((orderResp.data ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({ ...row, items: row.order_items }) as AppOrder,
      ),
    );
    if (walletResp?.data && walletResp.data.balance != null) {
      setWalletBalance(Number(walletResp.data.balance));
    } else {
      setWalletBalance(0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* ── Realtime nouvelles commandes vendeur ───────────────────────── */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`seller_orders:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `seller_id=eq.${user.id}` },
        (payload) => setOrders((prev) => [{ ...payload.new, items: [] } as unknown as AppOrder, ...prev]),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `seller_id=eq.${user.id}` },
        (payload) => setOrders((prev) =>
          prev.map((o) => o.id === payload.new.id ? { ...o, ...(payload.new as Partial<AppOrder>) } : o)
        ),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  /* ── Calculs ────────────────────────────────────────────────────── */
  const delivered = useMemo(
    () => orders.filter((o) => ["completed", "delivered", "delivered_by_rider"].includes(o.status)),
    [orders],
  );
  const earnings         = walletBalance;
  const pendingCount     = products.filter((p) => p.status === "pending").length;
  const activeCount      = products.filter((p) => p.status === "active").length;
  const boostedCount     = products.filter((p) => p.status === "boosted").length;
  const pendingOrders    = orders.filter((o) => !["completed", "delivered", "delivered_by_rider", "cancelled"].includes(o.status));

  const firstBoostable   = useMemo(() => products.find((p) => p.status === "active" || p.status === "boosted"), [products]);

  /* ── Actions ────────────────────────────────────────────────────── */
  function notify(text: string, type: "ok" | "err" = "ok") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function requestBoost(product: Product) {
    if (!user) return;
    const { error } = await supabase.from("boost_purchases").insert({
      product_id: product.id, seller_id: user.id,
      plan: "bronze", price_paid: 1000, duration_days: 7,
      status: "pending", payment_method: "cash", country_id: country.id,
      notes: "Demande boost depuis Rivendy Web",
    });
    notify(error ? error.message : "Demande de boost envoyée ✓", error ? "err" : "ok");
  }

  async function requestCertification() {
    if (!user) return;
    const { error } = await supabase.from("seller_subscriptions").insert({
      seller_id: user.id, plan: "monthly", price_paid: 5000,
      duration_days: 30, status: "pending", payment_method: "cash",
      country_id: country.id, notes: "Demande certification depuis Rivendy Web",
    });
    if (!error) await refreshProfile();
    notify(error ? error.message : "Demande de certification envoyée ✓", error ? "err" : "ok");
  }

  async function requestPayout() {
    if (!user) return;
    const amount = Number(withdrawAmount || earnings);
    if (!amount) return notify("Indique un montant de retrait.", "err");

    const { error } = await supabase.from("payout_requests").insert({
      seller_id: user.id, country_id: country.id, amount,
      currency_code: country.currency_code, method: "whatsapp",
      phone_number: profile?.whatsapp_number || country.whatsapp_number,
      status: "pending_director",
      notes: `Demande web - ${delivered.length} commande(s) livrée(s)`,
    });

    notify(error ? error.message : "Demande de retrait envoyée ✓", error ? "err" : "ok");

    const whatsapp = normalizePhoneForWhatsApp(country.whatsapp_number);
    const text = `Demande de retrait Rivendy Web\nVendeur: ${profile?.full_name || user.email}\nMontant: ${formatMoney(amount, country)}\nCommandes livrées: ${delivered.length}`;
    if (whatsapp) window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  if (loading) return <DashboardSkeleton />;

  const storeName = profile?.store_name || profile?.full_name || "Ma boutique";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">

      {/* ══ En-tête ══════════════════════════════════════════════════ */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Espace vendeur</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900 md:text-4xl">{storeName}</h1>
          {profile?.is_certified && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-white">
              <BadgeCheck className="h-3.5 w-3.5 fill-white" />
              Vendeur certifié
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/store/${user?.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[#009688]/30 hover:text-[#009688]"
          >
            <ExternalLink className="h-4 w-4" />
            Ma boutique
          </Link>
          <Link
            href="/sell"
            className="flex items-center gap-1.5 rounded-xl bg-[#009688] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#00796B]"
          >
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </Link>
        </div>
      </div>

      {/* ══ Métriques ════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={Wallet}    label="Gains confirmés"    value={formatMoney(earnings, country)} accent />
        <Metric icon={Banknote}  label="Commandes reçues"   value={String(orders.length)} />
        <Metric icon={ShoppingBag} label="En cours"         value={String(pendingOrders.length)} />
        <Metric icon={Package}   label="Produits publiés"   value={String(products.length)} />
      </section>

      {/* Sous-stats produits */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-[#009688]/20 bg-[#E0F2F1] px-3 py-1 text-xs font-bold text-[#009688]">
          {activeCount} actif{activeCount > 1 ? "s" : ""}
        </span>
        {boostedCount > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
            <Zap className="h-3 w-3 fill-[#009688] text-[#009688]" />
            {boostedCount} boosté{boostedCount > 1 ? "s" : ""}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            <Clock className="h-3 w-3" />
            {pendingCount} en attente de validation
          </span>
        )}
      </div>

      {/* Message retour */}
      {message && (
        <div className={cn(
          "mt-4 rounded-2xl px-4 py-3 text-sm font-semibold",
          message.type === "ok" ? "bg-[#E0F2F1] text-[#009688]" : "bg-red-50 text-red-700"
        )}>
          {message.text}
        </div>
      )}

      {/* ══ Corps principal ══════════════════════════════════════════ */}
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

        {/* ── Produits ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                Mes produits
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-500">
                  {products.length}
                </span>
              </h2>
              <Link href="/sell" className="text-sm font-bold text-[#009688] hover:underline">
                + Ajouter
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <Package className="h-8 w-8 text-slate-200" />
                <p className="mt-3 text-sm font-semibold text-slate-500">Aucun produit publié</p>
                <Link href="/sell" className="mt-3 text-sm font-bold text-[#009688] hover:underline">
                  Publier mon premier produit →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                    {/* Miniature */}
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <Image
                        src={firstPhoto(product)}
                        alt={product.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>

                    {/* Infos */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{product.title}</p>
                      <p className="text-xs text-slate-400">
                        {formatMoney(product.price, country)} · Stock {product.stock_quantity ?? 0}
                      </p>
                    </div>

                    {/* Statut + actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <ProductStatusBadge status={product.status} />
                      <Link
                        href={`/seller/products/${product.id}/edit`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-[#009688]/30 hover:text-[#009688]"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      {(product.status === "active" || product.status === "boosted") && (
                        <Link
                          href={`/seller/boost/${product.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-[#009688]/30 hover:text-[#009688]"
                          title="Booster"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Commandes ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                Commandes récentes
                {pendingOrders.length > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-700">
                    {pendingOrders.length} en cours
                  </span>
                )}
              </h2>
              <Link href="/seller/sales" className="text-sm font-bold text-[#009688] hover:underline">
                Voir tout
              </Link>
            </div>

            {orders.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
                <Truck className="h-8 w-8 text-slate-200" />
                <p className="mt-3 text-sm font-semibold text-slate-500">Aucune commande pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 8).map((order) => {
                  const cfg = ORDER_STATUS[order.status] ?? { label: order.status, bg: "bg-slate-50", text: "text-slate-600" };
                  const shortRef = order.id.split("-")[0].toUpperCase();
                  const fmtDate  = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(order.created_at));
                  return (
                    <div key={order.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs font-black text-slate-500">#{shortRef}</p>
                          <span className={cn("rounded-lg px-2 py-0.5 text-[10px] font-black", cfg.bg, cfg.text)}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {fmtDate}
                          {order.buyer_zone ? ` · ${order.buyer_zone}` : ""}
                          {order.buyer_name ? ` · ${order.buyer_name}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 font-black text-[#009688]">
                        {formatMoney(order.total_seller_amount || order.total_price, country)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Sidebar actions ───────────────────────────────────────── */}
        <aside className="space-y-4">

          {/* Navigation rapide */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <p className="border-b border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Raccourcis
            </p>
            {[
              { href: "/seller/sales",        icon: Truck,      label: "Mes ventes" },
              { href: "/seller/subscription", icon: BadgeCheck, label: "Abonnement & certification" },
              { href: "/seller/promo",        icon: Rocket,     label: "Booster un produit" },
              { href: "/wallet",              icon: Wallet,     label: "Portefeuille" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#E0F2F1] hover:text-[#009688]"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-[#009688]" />
                  {label}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>

          {/* Certification */}
          {!profile?.is_certified && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-black text-amber-800">Devenir certifié</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                Le badge certifié augmente la confiance des acheteurs et booste tes ventes.
              </p>
              <button
                type="button"
                onClick={requestCertification}
                className="mt-3 flex h-9 w-full items-center justify-center rounded-xl bg-amber-500 text-xs font-black text-white transition hover:bg-amber-600"
              >
                Demander la certification (5 000 FDJ)
              </button>
            </div>
          )}

          {/* Boost rapide */}
          {firstBoostable && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#009688]" />
                <p className="text-sm font-black text-slate-900">Booster un produit</p>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{firstBoostable.title}</p>
              <button
                type="button"
                onClick={() => requestBoost(firstBoostable)}
                className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#009688] text-xs font-black text-white transition hover:bg-[#00796B]"
              >
                <Zap className="h-3.5 w-3.5 fill-white" />
                Boost Bronze — 1 000 FDJ / 7 jours
              </button>
            </div>
          )}

          {/* Retrait */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-[#009688]" />
              <p className="text-sm font-black text-slate-900">Demander un retrait</p>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-slate-500">Disponible</p>
              <p className="text-sm font-black text-[#009688]">{formatMoney(earnings, country)}</p>
            </div>
            <div className="mt-3 space-y-2">
              <Input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`Montant (max ${formatMoney(earnings, country)})`}
                inputMode="decimal"
              />
              <button
                type="button"
                onClick={requestPayout}
                disabled={earnings === 0}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-xs font-black text-white transition hover:bg-[#1da853] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Demander via WhatsApp
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Le retrait est validé manuellement par l&apos;équipe Rivendy.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
