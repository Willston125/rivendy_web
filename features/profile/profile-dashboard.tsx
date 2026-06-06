"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Heart,
  KeyRound,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { firstPhoto, formatMoney } from "@/lib/utils/format";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import type { AppOrder, OrderStatus, Product } from "@/types/rivendy";

/* ── Libellés & couleurs des statuts commande ────────────────────── */
const STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  pending_whatsapp:              { label: "En attente",       color: "bg-amber-100 text-amber-700" },
  confirmed_by_customer_service: { label: "Confirmée",        color: "bg-blue-100 text-blue-700" },
  payment_received_cash:         { label: "Paiement reçu",    color: "bg-[#E0F2F1] text-[#009688]" },
  assigned_to_delivery:          { label: "Livreur assigné",  color: "bg-indigo-100 text-indigo-700" },
  accepted_by_agent:             { label: "Pris en charge",   color: "bg-indigo-100 text-indigo-700" },
  picked_up:                     { label: "Récupérée",        color: "bg-violet-100 text-violet-700" },
  en_route:                      { label: "En route",         color: "bg-cyan-100 text-cyan-700" },
  arrived:                       { label: "Livreur arrivé",   color: "bg-amber-100 text-amber-800" },
  code_generated:                { label: "Code envoyé",      color: "bg-amber-100 text-amber-800" },
  awaiting_customer_confirmation:{ label: "Livreur chez vous", color: "bg-amber-100 text-amber-800" },
  delivered_by_rider:            { label: "Livrée",           color: "bg-green-100 text-green-700" },
  completed:                     { label: "Terminée ✓",       color: "bg-green-100 text-green-700" },
  cancelled:                     { label: "Annulée",          color: "bg-red-100 text-red-600" },
  pending:                       { label: "En attente",       color: "bg-amber-100 text-amber-700" },
  shipped:                       { label: "Expédiée",         color: "bg-sky-100 text-sky-700" },
  delivered:                     { label: "Livrée ✓",         color: "bg-[#E0F2F1] text-[#009688]" },
};

/* ── Liens de navigation du profil ──────────────────────────────── */
const NAV_LINKS = [
  { href: "/profile/info",             icon: UserRound, label: "Informations personnelles" },
  { href: "/profile/password",         icon: KeyRound,  label: "Sécurité & mot de passe" },
  { href: "/profile/payment-methods",  icon: Wallet,    label: "Modes de paiement" },
  { href: "/profile/settings",         icon: Settings,  label: "Paramètres" },
  { href: "/seller",                   icon: Store,     label: "Mon espace vendeur" },
];

/* ── Composant métrique ──────────────────────────────────────────── */
function Metric({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: number; href?: string }) {
  const inner = (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-[#009688]/20 hover:shadow-md">
      <Icon className="h-5 w-5 text-[#009688]" />
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-center text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ── Composant principal ─────────────────────────────────────────── */
interface FollowedStore {
  id: string;
  name: string;
  avatarUrl: string;
  isCertified: boolean;
}

export function ProfileDashboard() {
  const { user, profile, signOut } = useAuth();
  const country = useCountryOrDefault();

  const [orders,    setOrders]    = useState<AppOrder[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [ratings,   setRatings]   = useState<Array<{ has_photo: boolean | null; delivery_validated: boolean | null }>>([]);
  const [followedStores, setFollowedStores] = useState<FollowedStore[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) return;

      /* Commandes */
      const phone = profile?.whatsapp_number || user.user_metadata?.whatsapp_number || "";
      if (phone) {
        const { data } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("buyer_phone", phone)
          .order("created_at", { ascending: false })
          .limit(30);
        setOrders(
          ((data ?? []) as Array<Record<string, unknown>>).map(
            (row) => ({ ...row, items: row.order_items }) as AppOrder,
          ),
        );
      }

      /* Favoris */
      const { data: favRows } = await supabase
        .from("favorites")
        .select("products(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setFavorites(
        ((favRows ?? []) as unknown as Array<{ products: Product | null }>)
          .map((r) => r.products)
          .filter(Boolean) as Product[],
      );

      /* Produits publiés */
      const { data: prodRows } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      setProducts((prodRows ?? []) as Product[]);

      /* Ratings pour trust */
      const { data: ratingRows } = await supabase
        .from("product_ratings")
        .select("has_photo, delivery_validated")
        .eq("user_id", user.id);
      setRatings((ratingRows ?? []) as Array<{ has_photo: boolean | null; delivery_validated: boolean | null }>);

      /* Boutiques suivies */
      const { data: followRows } = await supabase
        .from("store_follows")
        .select(`
          seller_id,
          profiles:seller_id (
            id,
            store_name,
            full_name,
            avatar_url,
            is_certified
          )
        `)
        .eq("follower_id", user.id)
        .order("created_at", { ascending: false });

      if (followRows) {
        const formatted = (followRows as unknown as Array<{
          seller_id: string;
          profiles: {
            id: string;
            store_name: string | null;
            full_name: string | null;
            avatar_url: string | null;
            is_certified: boolean | null;
          } | null;
        }>).map((r) => {
          const prof = r.profiles;
          return {
            id: r.seller_id,
            name: prof?.store_name || prof?.full_name || "Boutique Rivendy",
            avatarUrl: prof?.avatar_url || "",
            isCertified: !!prof?.is_certified,
          };
        });
        setFollowedStores(formatted);
      }
    }
    load();
  }, [profile, user]);

  const trustPoints = useMemo(
    () =>
      ratings.reduce((sum, r) => {
        let pts = 5;
        if (r.has_photo) pts += 10;
        if (r.delivery_validated) pts += 5;
        return sum + pts;
      }, 0),
    [ratings],
  );

  const displayName = profile?.full_name || profile?.store_name || user?.email?.split("@")[0] || "Utilisateur";
  const initials    = displayName.slice(0, 1).toUpperCase();

  /* Formatage date courte */
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">

      {/* ══════════════════════════════════════════════════════════════
          CARTE PROFIL
      ══════════════════════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        {/* Bannière dégradée */}
        <div className="h-24 bg-gradient-to-r from-[#009688] to-[#004D40]" />

        <div className="relative px-5 pb-6 md:px-8">
          {/* Avatar */}
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Link href="/profile/info" className="shrink-0">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-[#E0F2F1] shadow-md">
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt={displayName} fill sizes="80px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[#009688]">
                      {initials}
                    </div>
                  )}
                </div>
              </Link>

              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900">{displayName}</h1>
                  {profile?.is_certified && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-black text-white">
                      <BadgeCheck className="h-3 w-3 fill-white" />
                      Certifié
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {profile?.whatsapp_number || "Numéro WhatsApp non renseigné"}
                </p>
              </div>
            </div>

            {/* Déconnexion */}
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 self-end rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 sm:self-auto"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          MÉTRIQUES
      ══════════════════════════════════════════════════════════════ */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={ShoppingBag} label="Commandes"       value={orders.length}   href="/orders" />
        <Metric icon={Heart}       label="Favoris"         value={favorites.length} href="/favorites" />
        <Metric icon={Package}     label="Produits publiés" value={products.length}  href="/seller" />
        <Metric icon={Star}        label="Trust points"    value={trustPoints} />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CONTENU PRINCIPAL + SIDEBAR
      ══════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* ── Commandes récentes ────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Commandes récentes</h2>
            <Link href="/orders" className="text-sm font-bold text-[#009688] hover:underline">
              Voir tout
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <ShoppingBag className="h-9 w-9 text-slate-200" />
              <p className="mt-3 text-sm font-semibold text-slate-500">Aucune commande pour le moment</p>
              <Link
                href="/"
                className="mt-3 text-sm font-bold text-[#009688] hover:underline"
              >
                Explorer les produits →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 6).map((order) => {
                const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-600" };
                const shortRef   = order.id.split("-")[0].toUpperCase();
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900">#{shortRef}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {fmtDate(order.created_at)} · {order.items?.length ?? 0} article{(order.items?.length ?? 0) > 1 ? "s" : ""}
                        {order.seller_name ? ` · ${order.seller_name}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-black text-[#009688]">
                      {formatMoney(order.total_price, country)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Sidebar droite ────────────────────────────────────────── */}
        <aside className="space-y-5">

          {/* Navigation profil */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <p className="border-b border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Mon compte
            </p>
            {NAV_LINKS.map(({ href, icon: Icon, label }) => (
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

          {/* Favoris aperçu */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-black text-slate-900">Favoris</p>
              <Link href="/favorites" className="text-xs font-bold text-[#009688] hover:underline">
                Voir tout ({favorites.length})
              </Link>
            </div>

            {favorites.length === 0 ? (
              <p className="px-4 py-5 text-xs font-semibold text-slate-400">
                Tes produits favoris apparaîtront ici.
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {favorites.slice(0, 4).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    {/* Miniature */}
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <Image
                        src={firstPhoto(product)}
                        alt={product.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-slate-900">{product.title}</p>
                      <p className="text-[11px] font-semibold text-[#009688]">
                        {formatMoney(product.price, country)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Boutiques suivies */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-black text-slate-900">Boutiques suivies</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                {followedStores.length}
              </span>
            </div>

            {followedStores.length === 0 ? (
              <p className="px-4 py-5 text-xs font-semibold text-slate-400">
                Tu ne suis aucune boutique pour le moment.
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {followedStores.slice(0, 4).map((store) => (
                  <Link
                    key={store.id}
                    href={`/store/${store.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    {/* Avatar */}
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#E0F2F1]">
                      {store.avatarUrl ? (
                        <Image
                          src={store.avatarUrl}
                          alt={store.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#009688]">
                          {store.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-[12px] font-bold text-slate-900">{store.name}</p>
                        {store.isCertified && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-amber-400 text-white" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">Voir la boutique</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
