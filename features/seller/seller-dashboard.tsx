"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
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
import { ProductStatusBadge } from "@/features/products/product-status-badge";
import { supabase } from "@/lib/supabase/client";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import { orderReference, sellerOrderChip, sellerOrderGroup } from "@/lib/utils/orders";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry, useCountryOrDefault } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import { rejectReasonLabel } from "@/lib/utils/reject-reason";
import type { AppOrder, Country, Product } from "@/types/rivendy";

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

type WalletRow = { balance: number | string | null; currency: string | null; country_id: string | null };

/* ── Vue principale ─────────────────────────────────────────────── */
/**
 * Tableau de bord vendeur. Remis à plat le 2026-10-04 :
 *  - plus de raccourcis « en un clic » qui créaient une demande d'abonnement
 *    ou de boost SANS paiement : ils renvoient vers les vrais parcours ;
 *  - plus de second formulaire de retrait (montant libre, sans seuil ni
 *    verrou, bouton « via WhatsApp » qui n'ouvrait rien) : le retrait vit
 *    dans le portefeuille, comme dans l'app ;
 *  - solde dans la devise du PORTEFEUILLE, articles et commandes dans la
 *    devise de leur marché ;
 *  - statuts de commande groupés comme l'app (« À préparer », etc.).
 */
export function SellerDashboard() {
  const { user, profile } = useAuth();
  const country = useCountryOrDefault();
  const { countries } = useCountry();

  const [products, setProducts]           = useState<Product[]>([]);
  const [orders, setOrders]               = useState<AppOrder[]>([]);
  const [wallet, setWallet]               = useState<WalletRow | null>(null);
  const [loading, setLoading]             = useState(true);

  const marketOf = useCallback(
    (countryId?: string | null): Country | null =>
      (countryId && countries.find((c) => c.id === countryId)) || country,
    [countries, country],
  );

  /* ── Chargement ─────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [prodResp, orderResp, walletResp] = await Promise.all([
        supabase.from("products").select("*").eq("seller_id", user.id).eq("is_deleted", false).is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("orders").select("*, order_items(*)").eq("seller_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("wallets").select("balance, currency, country_id").eq("user_id", user.id).maybeSingle(),
      ]);
      setProducts(((prodResp.data ?? []) as Product[]).filter((p) => p.status !== "deleted"));
      setOrders(
        ((orderResp.data ?? []) as Array<Record<string, unknown>>).map(
          (row) => ({ ...row, items: row.order_items }) as AppOrder,
        ),
      );
      setWallet((walletResp?.data as WalletRow | null) ?? null);
    } catch {
      // ne pas bloquer l'UI si une requête échoue
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* Filet de sécurité : ne jamais rester bloqué sur le skeleton */
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(t);
  }, []);

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
  // Solde confirmé : wallets.balance (serveur), dans la devise DU PORTEFEUILLE.
  const walletCountry    = wallet?.country_id ? marketOf(wallet.country_id) : null;
  const walletMoneyFmt   = walletCountry ?? (wallet?.currency ? { currency_symbol: wallet.currency, currency_code: wallet.currency } : country);
  const earnings         = Number(wallet?.balance ?? 0);
  const pendingCount     = products.filter((p) => p.status === "pending").length;
  const rejectedCount    = products.filter((p) => p.status === "rejected").length;
  const activeCount      = products.filter((p) => p.status === "active").length;
  const boostedCount     = products.filter((p) => p.status === "boosted").length;
  const toPrepareCount   = useMemo(() => orders.filter((o) => sellerOrderGroup(o.status) === "toPrepare").length, [orders]);
  const pendingOrders    = useMemo(
    () => orders.filter((o) => !["done", "cancelled"].includes(sellerOrderGroup(o.status))),
    [orders],
  );

  const firstBoostable   = useMemo(() => products.find((p) => p.status === "active" || p.status === "boosted"), [products]);

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
        <Metric icon={Wallet}    label="Gains confirmés"    value={formatMoney(earnings, walletMoneyFmt)} accent />
        <Metric icon={Banknote}  label="Commandes reçues"   value={String(orders.length)} />
        <Metric icon={ShoppingBag} label={toPrepareCount > 0 ? `En cours · ${toPrepareCount} à préparer` : "En cours"} value={String(pendingOrders.length)} />
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
        {rejectedCount > 0 && (
          <Link
            href="/seller/sales"
            className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:underline"
          >
            {rejectedCount} refusé{rejectedCount > 1 ? "s" : ""} — voir le motif
          </Link>
        )}
      </div>

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
                  <div key={product.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <Image src={firstPhoto(product)} alt={product.title} fill sizes="48px" className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900">{product.title}</p>
                        <p className="text-xs text-slate-400">
                          {formatMoney(product.price, marketOf(product.country_id))} · Stock {product.stock_quantity ?? 0}
                        </p>
                      </div>
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
                    {/* Motif de refus — comme « Mes ventes » de l'app */}
                    {product.status === "rejected" && (
                      <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                        Motif : {rejectReasonLabel(product.reject_reason)} — modifiez l&apos;annonce pour la renvoyer en validation.
                      </p>
                    )}
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
                {toPrepareCount > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-800">
                    {toPrepareCount} à préparer
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
                  const chip = sellerOrderChip(order.status);
                  const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(order.created_at));
                  return (
                    <div key={order.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs font-black text-slate-500">#{orderReference(order.id)}</p>
                          <span className={cn("rounded-lg px-2 py-0.5 text-[10px] font-black", chip.className)}>
                            {chip.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {fmtDate}
                          {order.buyer_zone ? ` · ${order.buyer_zone}` : ""}
                        </p>
                      </div>
                      {/* Ce que le vendeur encaisse : jamais le prix acheteur
                          (qui inclut la commission) en repli. */}
                      <p className="shrink-0 font-black text-[#009688]">
                        {formatMoney(order.total_seller_amount, marketOf(order.country_id))}
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
              // « Booster un produit » menait à /seller/promo, la page publique
              // « Bons plans » : il ouvre désormais le vrai parcours de boost.
              {
                href: firstBoostable ? `/seller/boost/${firstBoostable.id}` : "/seller/sales",
                icon: Rocket,
                label: "Booster un produit",
              },
              { href: "/wallet",              icon: Wallet,     label: "Portefeuille" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={label}
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

          {/* Certification — vers le parcours de paiement complet */}
          {!profile?.is_certified && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-amber-500" />
                <p className="text-sm font-black text-amber-800">Devenir certifié</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                Le badge certifié augmente la confiance des acheteurs et inclut des boosts chaque mois.
              </p>
              <Link
                href="/seller/subscription"
                className="mt-3 flex h-9 w-full items-center justify-center rounded-xl bg-amber-500 text-xs font-black text-white transition hover:bg-amber-600"
              >
                Voir les formules
              </Link>
            </div>
          )}

          {/* Boost — vers le parcours complet (plans, paiement, crédits inclus) */}
          {firstBoostable && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#009688]" />
                <p className="text-sm font-black text-slate-900">Booster un produit</p>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{firstBoostable.title}</p>
              <Link
                href={`/seller/boost/${firstBoostable.id}`}
                className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#009688] text-xs font-black text-white transition hover:bg-[#00796B]"
              >
                <Zap className="h-3.5 w-3.5 fill-white" />
                Choisir un boost
              </Link>
            </div>
          )}

          {/* Retrait — il vit dans le portefeuille (seuil, verrou, devise) */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-[#009688]" />
              <p className="text-sm font-black text-slate-900">Mes gains</p>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-slate-500">Disponible</p>
              <p className="text-sm font-black text-[#009688]">{formatMoney(earnings, walletMoneyFmt)}</p>
            </div>
            <Link
              href="/wallet"
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#009688] text-xs font-black text-white transition hover:bg-[#00796B]"
            >
              <Wallet className="h-4 w-4" />
              Demander un retrait
            </Link>
            <p className="mt-2 text-[10px] text-slate-400">
              Le retrait est validé par l&apos;équipe Rivendy.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
