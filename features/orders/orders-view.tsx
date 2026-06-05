"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import type { AppOrder, OrderStatus } from "@/types/rivendy";
import { cn } from "@/lib/utils/cn";

/* ── Mapping statut → label + style ────────────────────────────── */
type StatusConfig = { label: string; bg: string; text: string; icon: React.ReactNode };

const DELIVERY_STATUS: Record<OrderStatus, StatusConfig> = {
  pending_whatsapp:              { label: "En attente",      bg: "bg-amber-50",    text: "text-amber-700",   icon: <Clock className="h-3 w-3" /> },
  confirmed_by_customer_service: { label: "Confirmée",       bg: "bg-blue-50",     text: "text-blue-700",    icon: <CheckCircle2 className="h-3 w-3" /> },
  payment_received_cash:         { label: "Paiement reçu",   bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
  assigned_to_delivery:          { label: "Livreur assigné", bg: "bg-indigo-50",   text: "text-indigo-700",  icon: <Package className="h-3 w-3" /> },
  accepted_by_agent:             { label: "Pris en charge",  bg: "bg-indigo-50",   text: "text-indigo-700",  icon: <Package className="h-3 w-3" /> },
  picked_up:                     { label: "Récupérée",       bg: "bg-violet-50",   text: "text-violet-700",  icon: <Package className="h-3 w-3" /> },
  en_route:                      { label: "En route 🛵",     bg: "bg-cyan-50",     text: "text-cyan-700",    icon: <Truck className="h-3 w-3" /> },
  arrived:                       { label: "Livreur arrivé",  bg: "bg-amber-50",    text: "text-amber-800",   icon: <Clock className="h-3 w-3" /> },
  code_generated:                { label: "Code envoyé 🔑",  bg: "bg-amber-50",    text: "text-amber-800",   icon: <Clock className="h-3 w-3" /> },
  awaiting_customer_confirmation:{ label: "Livreur chez vous", bg: "bg-amber-50",   text: "text-amber-800",   icon: <Truck className="h-3 w-3" /> },
  delivered_by_rider:            { label: "Livrée ✓",        bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
  completed:                     { label: "Terminée ✓",      bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:                     { label: "Annulée",          bg: "bg-red-50",      text: "text-red-600",     icon: <XCircle className="h-3 w-3" /> },
  pending:                       { label: "En attente",       bg: "bg-amber-50",    text: "text-amber-700",   icon: <Clock className="h-3 w-3" /> },
  shipped:                       { label: "Expédiée",         bg: "bg-sky-50",      text: "text-sky-700",     icon: <Truck className="h-3 w-3" /> },
  delivered:                     { label: "Livrée ✓",         bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
};

/* ── Étapes livraison (stepper) ─────────────────────────────────── */
const STEPS: { statuses: OrderStatus[]; label: string }[] = [
  { statuses: ["pending_whatsapp", "pending"],                   label: "Reçue" },
  { statuses: ["confirmed_by_customer_service"],                  label: "Confirmée" },
  { statuses: ["payment_received_cash"],                         label: "Payée" },
  { statuses: ["assigned_to_delivery", "accepted_by_agent"],      label: "Préparation" },
  { statuses: [
      "picked_up",
      "en_route",
      "arrived",
      "code_generated",
      "awaiting_customer_confirmation",
      "delivered_by_rider",
      "completed",
      "shipped",
      "delivered"
    ],                                                           label: "Livraison" },
];

function stepIndex(status: OrderStatus): number {
  return STEPS.findIndex((s) => s.statuses.includes(status));
}

/* ── Filtres ────────────────────────────────────────────────────── */
type Filter = "all" | "active" | "delivered" | "cancelled";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",       label: "Toutes" },
  { key: "active",    label: "En cours" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

function filterOrders(orders: AppOrder[], f: Filter): AppOrder[] {
  if (f === "all") return orders;
  if (f === "delivered") return orders.filter((o) => ["delivered", "delivered_by_rider", "completed"].includes(o.status));
  if (f === "cancelled") return orders.filter((o) => o.status === "cancelled");
  return orders.filter((o) => !["delivered", "delivered_by_rider", "completed", "cancelled"].includes(o.status));
}

/* ── Skeleton ───────────────────────────────────────────────────── */
function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
            <div className="h-3 w-32 rounded-full bg-slate-100" />
            <div className="h-6 w-20 rounded-lg bg-slate-100" />
          </div>
          <div className="px-4 py-4 space-y-2">
            <div className="h-3 w-3/4 rounded-full bg-slate-100" />
            <div className="h-5 w-24 rounded-full bg-slate-100" />
          </div>
          <div className="bg-slate-50 px-4 py-2.5">
            <div className="h-3 w-40 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Carte commande ─────────────────────────────────────────────── */
function OrderCard({ order, country }: { order: AppOrder; country: ReturnType<typeof useCountry>["country"] }) {
  const cfg      = DELIVERY_STATUS[order.status] ?? { label: order.status, bg: "bg-slate-50", text: "text-slate-600", icon: null };
  const shortRef = order.id.split("-")[0].toUpperCase();
  const fmtDate  = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(order.created_at));
  const items    = order.items ?? [];
  const isCancelled = order.status === "cancelled";
  const isActive    = !["delivered", "delivered_by_rider", "completed", "cancelled"].includes(order.status);
  const curStep     = stepIndex(order.status);

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">

      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-slate-500">#{shortRef}</span>
          {order.seller_name && (
            <span className="text-xs text-slate-400">· {order.seller_name}</span>
          )}
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black", cfg.bg, cfg.text)}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {/* Corps */}
      <div className="px-4 py-3">
        {/* Résumé articles */}
        {items.length > 0 && (
          <p className="line-clamp-1 text-sm font-semibold text-slate-700">
            {items.map((i) => i.product_title).join(" · ")}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-[#009688]">
              {formatMoney(order.total_price, country)}
            </p>
            <p className="text-[11px] text-slate-400">
              {items.length} article{items.length > 1 ? "s" : ""} · {fmtDate}
            </p>
          </div>
          {order.payment_method && (
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
              {order.payment_method}
            </span>
          )}
        </div>
      </div>

      {/* Stepper livraison (ordres actifs uniquement) */}
      {isActive && !isCancelled && curStep >= 0 && (
        <div className="border-t border-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-1 flex-col items-center">
                {/* Ligne + cercle */}
                <div className="relative flex w-full items-center">
                  {i > 0 && (
                    <div className={cn("h-0.5 flex-1", i <= curStep ? "bg-[#009688]" : "bg-slate-100")} />
                  )}
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
                      i < curStep  ? "bg-[#009688] text-white" :
                      i === curStep ? "bg-[#009688] text-white ring-2 ring-[#009688]/30" :
                                      "bg-slate-100 text-slate-400",
                    )}
                  >
                    {i < curStep ? "✓" : i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-0.5 flex-1", i < curStep ? "bg-[#009688]" : "bg-slate-100")} />
                  )}
                </div>
                <p className={cn("mt-1 text-center text-[9px] font-semibold leading-tight",
                  i <= curStep ? "text-[#009688]" : "text-slate-300"
                )}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/* ── Vue principale ─────────────────────────────────────────────── */
export function OrdersView() {
  const { user } = useAuth();
  const { country } = useCountry();
  const [orders, setOrders]   = useState<AppOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    setOrders(
      ((data ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({ ...row, items: row.order_items }) as AppOrder,
      ),
    );
    setLoading(false);
  }, [user]);

  /* Chargement initial */
  useEffect(() => { load(); }, [load]);

  /* Realtime — mises à jour statut en temps réel */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`orders:buyer:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.new.id
                ? { ...o, ...(payload.new as Partial<AppOrder>) }
                : o,
            ),
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = filterOrders(orders, filter);

  /* ── État vide global ─────────────────────────────────────────── */
  if (!loading && orders.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <span className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-slate-100">
          <ShoppingBag className="h-9 w-9 text-slate-300" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-slate-900">Aucune commande</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Commencez vos achats — vos commandes Rivendy apparaîtront ici.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#009688] px-8 text-sm font-black text-white shadow-sm transition hover:bg-[#00796B]"
        >
          <ShoppingBag className="h-4 w-4" />
          Découvrir les produits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-10">

      {/* En-tête */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Historique</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Mes commandes</h1>
          {!loading && (
            <p className="mt-1 text-sm text-slate-500">
              {orders.length} commande{orders.length > 1 ? "s" : ""} au total
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#E0F2F1] px-4 py-2 text-xs font-bold text-[#009688] transition hover:bg-[#B2DFDB]"
        >
          <Package className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(({ key, label }) => {
          const count = filterOrders(orders, key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold transition",
                filter === key
                  ? "bg-[#009688] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-[#009688]/30 hover:text-[#009688]",
              )}
            >
              {label}
              {key !== "all" && count > 0 && (
                <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                  filter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {loading ? (
        <OrdersSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <Package className="h-8 w-8 text-slate-200" />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Aucune commande dans cette catégorie
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} country={country} />
          ))}
        </div>
      )}
    </div>
  );
}
