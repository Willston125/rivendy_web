"use client";

/**
 * Mes commandes (acheteur).
 *
 * ⚠️ Cet écran est en LECTURE SEULE sur `orders`. Le bouton
 * « Annuler la commande » qui vivait ici faisait un
 * `update({ status: "cancelled" })` direct depuis le client : il n’a jamais
 * rien annulé. `trg_a_guard_order_writes` (BEFORE UPDATE, owner
 * `20260902_orders_write_guard.sql`) restaure `status` pour tout écrivain
 * client (`current_user` ∈ authenticated/anon) — la ligne repart avec son
 * ancien statut, et la policy `buyer_cancel_own_pending_order`, dont le
 * WITH CHECK exige `status = 'cancelled'`, refuse alors la ligne restaurée.
 * Le clic ne produisait donc aucun effet et aucun message.
 *
 * Même si l’UPDATE passait, il ne ferait RIEN de ce qu’une annulation
 * exige : restituer le stock réservé à la création, rouvrir l’article
 * passé `epuise`, relâcher le livreur, clore l’assignation, neutraliser le
 * code de livraison et passer `financial_status` à `refunded`. Seule
 * `admin_cancel_order()` le fait, et elle est réservée à `service_role`
 * depuis le 2026-09-04 : le dashboard l’appelle, aucun client ne le peut.
 *
 * Depuis le 2026-09-18, l’acheteur ne « annule » plus : il DEMANDE. La RPC
 * `request_order_cancellation()` (SECURITY DEFINER, owner
 * 20260918_request_order_cancellation.sql) dépose la demande dans
 * `order_cancellation_requests`, et Rivendy tranche depuis le dashboard
 * (Commandes → Demandes d’annulation), où « accepter » appelle
 * `admin_cancel_order`. Aucun WhatsApp dans la boucle.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
  KeyRound,
  Timer
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import type { AppOrder, Country, OrderStatus } from "@/types/rivendy";
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
  delivered_confirmed:           { label: "Livrée ✓",        bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
  completed:                     { label: "Terminée ✓",      bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:                     { label: "Annulée",          bg: "bg-red-50",      text: "text-red-600",     icon: <XCircle className="h-3 w-3" /> },
  pending:                       { label: "En attente",       bg: "bg-amber-50",    text: "text-amber-700",   icon: <Clock className="h-3 w-3" /> },
  confirmed:                     { label: "Confirmée",        bg: "bg-blue-50",     text: "text-blue-700",    icon: <CheckCircle2 className="h-3 w-3" /> },
  in_delivery:                   { label: "En livraison 🛵",  bg: "bg-cyan-50",     text: "text-cyan-700",    icon: <Truck className="h-3 w-3" /> },
  // Le suivi est suspendu tant que Rivendy n'a pas tranché : l'acheteur doit
  // voir que son dossier est ouvert, pas « En attente ».
  disputed:                      { label: "Litige en cours",  bg: "bg-orange-50",   text: "text-orange-700",  icon: <XCircle className="h-3 w-3" /> },
  shipped:                       { label: "Expédiée",         bg: "bg-sky-50",      text: "text-sky-700",     icon: <Truck className="h-3 w-3" /> },
  delivered:                     { label: "Livrée ✓",         bg: "bg-[#E0F2F1]",   text: "text-[#009688]",   icon: <CheckCircle2 className="h-3 w-3" /> },
};

/* ── Étapes livraison (stepper) ─────────────────────────────────── */
const STEPS: { statuses: OrderStatus[]; label: string }[] = [
  { statuses: ["pending_whatsapp", "pending"],                   label: "Reçue" },
  { statuses: ["confirmed_by_customer_service", "confirmed"],      label: "Confirmée" },
  { statuses: ["payment_received_cash"],                         label: "Payée" },
  { statuses: ["assigned_to_delivery", "accepted_by_agent"],      label: "Préparation" },
  { statuses: [
      "picked_up",
      "en_route",
      "in_delivery",
      "arrived",
      "code_generated",
      "awaiting_customer_confirmation",
      "delivered_by_rider",
      "delivered_confirmed",
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
  if (f === "delivered") return orders.filter((o) => ["delivered", "delivered_by_rider", "delivered_confirmed", "completed"].includes(o.status));
  if (f === "cancelled") return orders.filter((o) => o.status === "cancelled");
  return orders.filter((o) => !["delivered", "delivered_by_rider", "delivered_confirmed", "completed", "cancelled"].includes(o.status));
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

/* ── Bannière Code de Livraison ─────────────────────────────────── */
function DeliveryCodeBanner({ orderId, userId }: { orderId: string, userId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function loadCode() {
      const { data } = await supabase
        .from("app_notifications")
        .select("body, metadata")
        .eq("user_id", userId)
        .eq("type", "delivery_code")
        .contains("metadata", { order_id: orderId })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const body = data.body || "";
        const match = body.match(/\b(\d{6})\b/);
        if (match) setCode(match[1]);

        const expiresStr = (data.metadata as Record<string, unknown>)?.expires_at as string | undefined;
        if (expiresStr) {
          const expiresAt = new Date(expiresStr).getTime();
          
          const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.floor((expiresAt - now) / 1000);
            
            if (remaining <= 0) {
              setExpired(true);
              setTimeLeft("00:00");
              if (timer) clearInterval(timer);
            } else {
              setExpired(false);
              const m = Math.floor(remaining / 60).toString().padStart(2, "0");
              const s = (remaining % 60).toString().padStart(2, "0");
              setTimeLeft(`${m}:${s}`);
            }
          };

          updateTimer();
          timer = setInterval(updateTimer, 1000);
        }
      }
      setLoading(false);
    }

    loadCode();
    return () => { if (timer) clearInterval(timer); };
  }, [orderId, userId]);

  if (loading) return null;

  return (
    <div className={cn(
      "mb-3 rounded-xl p-4 text-white shadow-sm",
      expired ? "bg-gradient-to-r from-slate-500 to-slate-400" : "bg-gradient-to-r from-amber-600 to-amber-500"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-bold text-[13px]">
          {expired ? <Clock className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
          <span>{expired ? "Code expiré" : "Le livreur est là !"}</span>
        </div>
        {!expired && timeLeft && (
          <div className="flex items-center gap-1 text-[13px] font-black tabular-nums">
            <Timer className="h-3.5 w-3.5" />
            {timeLeft}
          </div>
        )}
      </div>
      
      {expired ? (
        <p className="text-[11px] text-white/80">Demandez au livreur de régénérer un nouveau code.</p>
      ) : code ? (
        <>
          <p className="text-[11px] text-white/80 mb-1">Communiquez ce code au livreur :</p>
          <p className="text-3xl font-black tracking-[0.3em]">{code}</p>
        </>
      ) : (
        <p className="text-[11px] text-white/80">Consultez votre notification pour le code.</p>
      )}
    </div>
  );
}

/* ── Demande d’annulation ──────────────────────────── */
// Miroir des refus de `request_order_cancellation()`, eux-mêmes alignés sur
// ceux d’`admin_cancel_order` : inutile de mettre en file une demande que la
// RPC d’annulation rejettera.
const CANCEL_ERRORS: Record<string, string> = {
  not_authenticated:       "Reconnectez-vous pour demander l’annulation.",
  order_not_found:         "Commande introuvable.",
  already_cancelled:       "Cette commande est déjà annulée.",
  order_completed:         "Cette commande est terminée : elle ne s’annule plus.",
  order_already_delivered: "Cette commande vous a été livrée. En cas de problème, ouvrez un litige auprès du support.",
  funds_already_released:  "Le paiement a déjà été versé au vendeur. Contactez le support.",
};

/* ── Carte commande ─────────────────────────────────────────────── */
function OrderCard({
  order,
  country,
  userId,
  hasPendingRequest,
  onRequested,
}: {
  order: AppOrder;
  country: Country | null;
  userId: string;
  hasPendingRequest: boolean;
  onRequested: (orderId: string) => void;
}) {
  const cfg      = DELIVERY_STATUS[order.status] ?? { label: order.status, bg: "bg-slate-50", text: "text-slate-600", icon: null };
  const shortRef = order.id.split("-")[0].toUpperCase();
  const fmtDate  = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(order.created_at));
  const items    = order.items ?? [];
  const isCancelled = order.status === "cancelled";
  const isActive    = !["delivered", "delivered_by_rider", "delivered_confirmed", "completed", "cancelled"].includes(order.status);
  const curStep     = stepIndex(order.status);
  const isAwaitingCode = ["arrived", "code_generated", "awaiting_customer_confirmation"].includes(order.status);
  // Commande encore en attente de l'appel de confirmation Rivendy.
  const isPendingReview = ["pending", "pending_whatsapp"].includes(order.status);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");

  /**
   * Demande d’annulation. L’écran n’écrit RIEN sur `orders` ni sur
   * `order_cancellation_requests` : les deux sont fermées en écriture au
   * client. La RPC est le seul chemin, et elle vérifie que l’appelant est
   * bien l’acheteur.
   */
  async function requestCancellation() {
    if (asking || hasPendingRequest) return;
    const reason = window.prompt(
      "Pourquoi souhaitez-vous annuler cette commande ? (facultatif)",
      "",
    );
    if (reason === null) return;   // Annuler la boîte = ne rien demander

    setAsking(true);
    setAskError("");
    try {
      const { data, error } = await supabase.rpc("request_order_cancellation", {
        p_order_id: order.id,
        p_reason: reason.trim() || null,
      });
      const res = (data ?? {}) as { success?: boolean; error?: string };
      if (error || !res.success) {
        const code = res.error ?? "";
        setAskError(CANCEL_ERRORS[code] || error?.message || "Demande impossible pour le moment.");
        return;
      }
      onRequested(order.id);
    } catch {
      setAskError("Réseau indisponible — réessayez.");
    } finally {
      setAsking(false);
    }
  }

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

        {isPendingReview && (
          hasPendingRequest ? (
            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              Demande d’annulation envoyée. Rivendy la traite et vous répond ;
              la commande reste active tant qu’elle n’est pas annulée.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={requestCancellation}
                disabled={asking}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
              >
                <XCircle className="h-3.5 w-3.5" />
                {asking ? "Envoi…" : "Demander l’annulation"}
              </button>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Rivendy vérifie puis annule la commande. Vous recevez une
                notification dès que c’est fait.
              </p>
            </>
          )
        )}
        {askError && (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
            {askError}
          </p>
        )}
      </div>

      {/* Code de confirmation */}
      {isAwaitingCode && (
        <div className="px-4">
          <DeliveryCodeBanner orderId={order.id} userId={userId} />
        </div>
      )}

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
  const country = useCountryOrDefault();
  const [orders, setOrders]   = useState<AppOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("all");
  // Commandes pour lesquelles une demande d’annulation est déjà en attente.
  // Chargé une fois pour toute la liste plutôt qu’une requête par carte.
  // `order_cancellation_requests` est en lecture seule pour l’acheteur (RLS
  // `ocr_select_own_or_staff`) : il ne voit que ses propres demandes.
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());


  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
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

      const { data: reqs } = await supabase
        .from("order_cancellation_requests")
        .select("order_id")
        .eq("buyer_id", user.id)
        .eq("status", "pending");
      setPendingRequests(
        new Set(((reqs ?? []) as Array<{ order_id: string }>).map((r) => r.order_id)),
      );
    } catch {
      // ne pas bloquer l'UI
    } finally {
      setLoading(false);
    }
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
      {loading || !country ? (
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
            <OrderCard
              key={order.id}
              order={order}
              country={country}
              userId={user?.id || ""}
              hasPendingRequest={pendingRequests.has(order.id)}
              onRequested={(orderId) =>
                setPendingRequests((prev) => new Set(prev).add(orderId))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
