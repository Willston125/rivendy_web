"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle,
  Eye,
  Heart,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  Zap,
  PlaySquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { firstPhoto, formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import type { Product, AppOrder } from "@/types/rivendy";

type Tab = "garde-robe" | "commandes" | "ventes" | "stats";

const SELLER_ORDER_STATUS: Record<string, { label: string; bg: string; text: string }> = {
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
  pending:                       { label: "En attente",     bg: "bg-amber-50",  text: "text-amber-700" },
  shipped:                       { label: "Expédiée",       bg: "bg-cyan-50",   text: "text-cyan-700" },
};

const MONTHS = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:  { label: "En ligne",    cls: "bg-[#E0F2F1] text-[#009688]" },
    boosted: { label: "⚡ Boosté",    cls: "bg-amber-50 text-amber-700" },
    epuise:  { label: "Épuisé",       cls: "bg-slate-100 text-slate-500" },
    pending: { label: "En attente",  cls: "bg-blue-50 text-blue-600" },
    sold:    { label: "Vendu",        cls: "bg-green-50 text-green-700" },
    validated:{ label: "Validé",     cls: "bg-green-50 text-green-700" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500" };
  return (
    <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function SellerSalesView() {
  const { user, profile } = useAuth();
  const { country } = useCountry();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("garde-robe");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [togglingStory, setTogglingStory] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    const [prodRes, orderRes] = await Promise.all([
      supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("*, items:order_items(*)").eq("seller_id", user.id).order("created_at", { ascending: false })
    ]);
    
    setProducts((prodRes.data ?? []) as Product[]);
    setOrders((orderRes.data ?? []) as AppOrder[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Filtres ────────────────────────────────────────────────
  const activeProducts = useMemo(
    () => products.filter((p) => ["active","boosted","epuise","pending"].includes(p.status)),
    [products],
  );
  const soldProducts = useMemo(
    () => products.filter((p) => ["sold","validated"].includes(p.status)),
    [products],
  );
  
  const activeOrders = useMemo(
    () => orders.filter((o) => !["delivered", "delivered_by_rider", "completed", "cancelled"].includes(o.status)),
    [orders],
  );

  // ── Actions ────────────────────────────────────────────────
  async function markAsSold(productId: string) {
    setMarking(productId);
    await supabase.from("products").update({ status: "sold" }).eq("id", productId);
    await load();
    setMarking(null);
  }

  async function deleteProduct(id: string) {
    if (!confirm("Voulez-vous vraiment supprimer cet article ? Cette action est irréversible.")) return;
    setDeleting(id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    setDeleting(null);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert("Erreur lors de la suppression.");
    }
  }

  async function toggleStory(product: Product) {
    setTogglingStory(product.id);
    const willBeStory = !product.is_story;
    const isCertified = profile?.is_certified;
    
    // Si on active, on définit la durée selon certification
    let expiresAt: Date | null = null;
    if (willBeStory) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (isCertified ? 72 : 24));
    }

    const { error } = await supabase
      .from("products")
      .update({
        is_story: willBeStory,
        story_started_at: willBeStory ? new Date().toISOString() : null,
        story_expires_at: willBeStory ? expiresAt?.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    setTogglingStory(null);
    if (!error) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                is_story: willBeStory,
                story_started_at: willBeStory ? new Date().toISOString() : undefined,
                story_expires_at: willBeStory ? expiresAt?.toISOString() : undefined,
              }
            : p
        )
      );
    } else {
      alert("Erreur lors du changement de story.");
    }
  }

  // ── Stats ──────────────────────────────────────────────────
  const totalRevenue = soldProducts.reduce(
    (sum, p) => sum + (p.seller_price > 0 ? p.seller_price : p.price),
    0,
  );
  const totalCommissions = soldProducts.reduce((sum, p) => sum + p.commission_amount, 0);
  const top5 = useMemo(
    () => [...products].sort((a, b) => b.views_count - a.views_count).slice(0, 5),
    [products],
  );
  const maxViews = top5[0]?.views_count || 1;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[#E0F2F1]">
          <Store className="h-12 w-12 text-[#009688]" />
        </div>
        <h1 className="mt-6 text-2xl font-black text-[#1A1A1A]">
          Vous n&apos;avez pas encore<br />d&apos;articles en vente
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Commencez à vendre dès maintenant — c&apos;est simple et rapide.
        </p>
        <Link
          href="/sell"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#009688] px-8 text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          <Plus className="h-4 w-4" />
          Publier mon premier article
        </Link>
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-blue-50 p-4 text-left">
          <span className="text-xl">💡</span>
          <p className="text-xs text-blue-800">
            Une photo, une description, et c&apos;est en ligne en 30 secondes !
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">

      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Espace vendeur</p>
          <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Ma Boutique</h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile?.store_name || profile?.full_name || "Boutique Rivendy"}
          </p>
        </div>
        <Link
          href="/sell"
          className="flex items-center gap-2 rounded-full bg-[#009688] px-5 py-3 text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          <Plus className="h-4 w-4" />
          Ajouter un article
        </Link>
      </div>

      {/* Bannière certification */}
      {profile?.is_certified ? (
        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#E0F2F1] px-4 py-3 text-sm font-bold text-[#009688]">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Badge Certifié actif — tes produits inspirent confiance
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <span>⭐</span>
            Boostez vos ventes avec le badge Certifié
          </div>
          <Link href="/seller/subscription" className="shrink-0 text-xs font-black text-[#009688] hover:underline">
            Voir les offres →
          </Link>
        </div>
      )}

      {/* Onglets */}
      <div className="mb-5 flex gap-1 rounded-2xl bg-slate-100 p-1">
        {(
          [
            { id: "garde-robe", label: `Garde-Robe (${activeProducts.length})`, icon: Package },
            { id: "commandes",  label: `Commandes (${activeOrders.length})`,    icon: Package },
            { id: "ventes",     label: `Mes Ventes (${soldProducts.length})`,    icon: CheckCircle },
            { id: "stats",      label: "Statistiques",                            icon: BarChart3 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition ${
              tab === id
                ? "bg-white text-[#009688] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === "garde-robe" ? "Garde-Robe" : id === "commandes" ? "Commandes" : id === "ventes" ? "Ventes" : "Stats"}</span>
          </button>
        ))}
      </div>

      {/* ── ONGLET GARDE-ROBE ─────────────────────────────── */}
      {tab === "garde-robe" && (
        <div className="space-y-4">
          {activeProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400">
              Aucun article en vente.
            </div>
          ) : (
            activeProducts.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {/* Ligne principale */}
                <div className="flex gap-3 p-4">
                  {/* Image */}
                  <Link
                    href={`/products/${product.id}`}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                  >
                    <Image
                      src={firstPhoto(product)}
                      alt={product.title}
                      fill
                      sizes="80px"
                      className="object-cover transition hover:scale-105"
                    />
                    {product.status === "boosted" && (
                      <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur-sm">
                        <Zap className="h-2.5 w-2.5" />
                        BOOSTÉ
                      </span>
                    )}
                  </Link>

                  {/* Infos */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="line-clamp-2 text-sm font-bold text-[#1A1A1A] hover:text-[#009688]"
                      >
                        {product.title}
                      </Link>
                      <StatusPill status={product.status} />
                    </div>

                    {/* Prix vendeur + commission */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-[#009688]">
                        {formatMoney(product.seller_price > 0 ? product.seller_price : product.price, country)}
                      </span>
                      {product.commission_amount > 0 && (
                        <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">
                          + {formatMoney(product.commission_amount, country)} comm.
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {product.views_count} vues
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {product.likes_count} favoris
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barre d'actions */}
                <div className="grid grid-cols-5 divide-x divide-slate-100 border-t border-slate-100">
                  <Link
                    href={`/seller/products/${product.id}/edit`}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#009688]"
                  >
                    ✏️ <span className="hidden sm:inline">Modifier</span>
                  </Link>
                  <button
                    type="button"
                    disabled={togglingStory === product.id}
                    onClick={() => toggleStory(product)}
                    className={`flex items-center justify-center gap-1 py-3 text-xs font-bold transition disabled:opacity-50 ${
                      product.is_story
                        ? "text-[#E4405F] hover:bg-pink-50"
                        : "text-slate-500 hover:bg-slate-50 hover:text-[#009688]"
                    }`}
                  >
                    {togglingStory === product.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlaySquare className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{product.is_story ? "Story ✓" : "Story"}</span>
                  </button>
                  <Link
                    href={`/seller/boost/${product.id}`}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-bold text-amber-600 transition hover:bg-amber-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Booster</span>
                  </Link>
                  <button
                    type="button"
                    disabled={marking === product.id}
                    onClick={() => markAsSold(product.id)}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-bold text-green-600 transition hover:bg-green-50 disabled:opacity-50"
                  >
                    {marking === product.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Vendu</span>
                  </button>
                  <button
                    type="button"
                    disabled={deleting === product.id}
                    onClick={() => deleteProduct(product.id)}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-bold text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {deleting === product.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Supprimer</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* ── ONGLET COMMANDES ────────────────────────────── */}
      {tab === "commandes" && (
        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400">
              Aucune commande en cours.
            </div>
          ) : (
            activeOrders.map((order) => {
              const statusCfg = SELLER_ORDER_STATUS[order.status] ?? { label: order.status, bg: "bg-slate-50", text: "text-slate-600" };
              const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(order.created_at));
              const items = order.items ?? [];
              const phone = normalizePhoneForWhatsApp(order.buyer_phone || "");

              return (
                <div key={order.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {/* En-tête commande */}
                  <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-black text-slate-500">
                        #{order.id.split("-")[0].toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">{fmtDate}</span>
                    </div>
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Détail commande */}
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{order.buyer_name || "Acheteur inconnu"}</p>
                    {order.buyer_zone && (
                      <p className="text-xs text-slate-500">📍 {order.buyer_zone}</p>
                    )}

                    <div className="mt-3 space-y-2">
                      {items.map((item, idx) => (
                        <div key={item.id ?? idx} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                            {item.product_image_url ? (
                              <Image src={item.product_image_url} alt={item.product_title} width={40} height={40} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="line-clamp-1 text-sm font-bold text-slate-700">{item.product_title}</p>
                            <p className="text-xs text-slate-500">Qté: {item.quantity} {item.product_size && `· Taille: ${item.product_size}`}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-[#009688]">
                              {formatMoney(item.subtotal, country)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                      <p className="text-sm font-black text-[#1A1A1A]">Total à encaisser</p>
                      <p className="text-lg font-black text-[#009688]">
                        {formatMoney(order.total_seller_amount, country)}
                      </p>
                    </div>

                    {phone && (
                      <div className="mt-4">
                        <a
                          href={`https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${order.buyer_name}, je suis le vendeur de votre commande #${order.id.split("-")[0].toUpperCase()} sur Rivendy.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366]/10 px-4 py-2.5 text-sm font-black text-[#1DA851] transition hover:bg-[#25D366]/20"
                        >
                          Contacter l&apos;acheteur sur WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── ONGLET MES VENTES ─────────────────────────────── */}
      {tab === "ventes" && (
        <div className="space-y-4">
          {/* Résumé encaissements */}
          {soldProducts.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-[#007168] to-[#00C4B4] p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
                <ShoppingBag className="h-4 w-4" />
                {soldProducts.length} vente{soldProducts.length > 1 ? "s" : ""} confirmée{soldProducts.length > 1 ? "s" : ""}
              </div>
              <p className="mt-2 text-3xl font-black">
                {formatMoney(totalRevenue, country)}
              </p>
              <p className="mt-0.5 text-xs text-white/60">Total encaissé (hors commission)</p>
              {totalCommissions > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/80">
                  <span>%</span>
                  {formatMoney(totalCommissions, country)} versés à Rivendy
                </div>
              )}
            </div>
          )}

          {soldProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-slate-200" />
              <p className="mt-4 font-bold text-slate-500">Aucune vente encore</p>
              <p className="mt-1 text-xs text-slate-400">
                Les articles vendus apparaîtront ici une fois les transactions confirmées.
              </p>
            </div>
          ) : (
            soldProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
                {/* Image grisée + badge VENDU */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={firstPhoto(product)}
                    alt={product.title}
                    fill
                    sizes="64px"
                    className="object-cover opacity-50 grayscale"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                      VENDU
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-bold text-slate-400 line-through">
                    {product.title}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-sm">
                    <span className="text-base font-black text-[#009688]">
                      {formatMoney(product.seller_price > 0 ? product.seller_price : product.price, country)}
                    </span>
                    <span className="text-xs text-slate-400">encaissé</span>
                  </div>
                  {product.commission_amount > 0 && (
                    <p className="text-xs text-orange-600">
                      {formatMoney(product.commission_amount, country)} versés à Rivendy
                    </p>
                  )}
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ONGLET STATISTIQUES ───────────────────────────── */}
      {tab === "stats" && (
        <div className="space-y-5">
          {/* Chiffres clés */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Revenus encaissés"
              value={formatMoney(totalRevenue, country)}
              color="text-[#009688]"
            />
            <StatCard
              label="Articles vendus"
              value={String(soldProducts.length)}
              color="text-green-600"
            />
            <StatCard
              label="En vente"
              value={String(activeProducts.filter((p) => p.status === "active" || p.status === "boosted").length)}
              color="text-[#6A5ACD]"
            />
            <StatCard
              label="Commissions Rivendy"
              value={totalCommissions > 0 ? formatMoney(totalCommissions, country) : "—"}
              color="text-orange-500"
            />
          </div>

          {/* Top produits par vues */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-black text-[#1A1A1A]">Top produits par vues</h2>
            {top5.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune donnée de vues disponible.</p>
            ) : (
              <div className="space-y-4">
                {top5.map((p) => {
                  const ratio = maxViews > 0 ? p.views_count / maxViews : 0;
                  return (
                    <div key={p.id}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="line-clamp-1 text-sm font-bold text-[#1A1A1A]">{p.title}</p>
                        <span className="ml-2 shrink-0 text-xs text-slate-500">
                          {p.views_count} vue{p.views_count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-[#6A5ACD] transition-all duration-500"
                          style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
