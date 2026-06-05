"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Heart,
  LogOut,
  MessageCircle,
  Search,
  ShoppingCart,
  Store,
  UserRound,
  X,
  Globe,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/features/auth/auth-provider";
import { useCart } from "@/features/cart/cart-provider";
import { useCountry } from "@/features/country/country-provider";
import { useNotifications } from "@/features/notifications/use-notifications";
import type { AppNotification } from "@/features/notifications/use-notifications";

const navItems = [
  { href: "/", label: "Explorer" },
  { href: "/preorders", label: "Sur commande" },
  { href: "/sell", label: "Vendre" },
  { href: "/seller", label: "Ma boutique" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { profile, user, signOut } = useAuth();
  const { totalItems } = useCart();
  const { country, countries, setCountryId } = useCountry();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const displayName = useMemo(() => {
    return profile?.full_name || profile?.store_name || user?.email?.split("@")[0] || "Mon compte";
  }, [profile, user]);

  const initials = useMemo(() => {
    const name = profile?.store_name || profile?.full_name || user?.email || "R";
    return name.slice(0, 1).toUpperCase();
  }, [profile, user]);

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    next.set("country", country.id);
    router.push(`/?${next.toString()}`);
  }

  async function changeCountry(countryId: string) {
    await setCountryId(countryId);
    const next = new URLSearchParams(params.toString());
    next.set("country", countryId);
    router.push(`${pathname === "/" ? "/" : pathname}?${next.toString()}`);
    router.refresh();
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">

      {/* ── Barre principale ───────────────────────────────────────── */}
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-2.5 lg:gap-4 lg:px-6">

        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[#009688]">
            <Image
              src="/brand/rivendy-logo.jpg"
              alt="Rivendy"
              fill
              sizes="36px"
              className="object-cover"
              priority
            />
          </div>
          <span className="hidden text-xl font-extrabold tracking-tight text-slate-900 lg:block">
            Rivendy
          </span>
        </Link>

        {/* Barre de recherche — desktop */}
        <form onSubmit={onSearch} className="relative hidden flex-1 md:block lg:max-w-xl xl:max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, une boutique..."
            className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009688] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,150,136,0.1)]"
          />
        </form>

        {/* Nav desktop — liens texte */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                  active
                    ? "bg-[#E0F2F1] text-[#009688]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="hidden flex-1 lg:block" />

        {/* ── Icônes d'action ─────────────────────────────────────── */}
        <div className="flex items-center gap-1">

          {/* Sélecteur de pays — desktop */}
          <div className="relative hidden items-center md:flex mr-1.5">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={country.id}
              onChange={(e) => changeCountry(e.target.value)}
              className="h-10 appearance-none rounded-full border border-slate-200 bg-slate-50 pl-9 pr-8 text-xs font-bold text-slate-700 outline-none transition hover:border-[#009688] focus:border-[#009688] focus:bg-white cursor-pointer"
            >
              {countries.map((c) => (
                <option value={c.id} key={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Favoris */}
          <Link
            href="/favorites"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:flex"
            aria-label="Favoris"
          >
            <Heart className="h-[20px] w-[20px]" />
          </Link>

          {/* Panier */}
          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Panier"
          >
            <ShoppingCart className="h-[20px] w-[20px]" />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[20px] min-w-[20px] place-items-center rounded-full bg-[#009688] px-1 text-[10px] font-bold text-white">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>

          {/* Messages */}
          <Link
            href="/help"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:flex"
            aria-label="Messages"
          >
            <MessageCircle className="h-[20px] w-[20px]" />
          </Link>

          {/* Notifications */}
          <div ref={notifRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileMenuOpen(false);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-[20px] w-[20px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#FF6B35] px-0.5 text-[9px] font-black text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown notifications */}
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50">
                  {/* En-tête */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-black text-slate-900">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 rounded-full bg-[#FF6B35] px-2 py-0.5 text-[10px] font-black text-white">
                          {unreadCount}
                        </span>
                      )}
                    </p>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[11px] font-bold text-[#009688] hover:underline"
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  {/* Liste */}
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <Bell className="h-8 w-8 text-slate-200" />
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          Aucune notification
                        </p>
                      </div>
                    ) : (
                      notifications.map((n: AppNotification) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markRead(n.id)}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                            !n.is_read && "bg-[#E0F2F1]/40",
                          )}
                        >
                          {/* Point non-lu */}
                          <span
                            className={cn(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              n.is_read ? "bg-transparent" : "bg-[#009688]",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold text-slate-900 line-clamp-1">
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                                {n.body}
                              </p>
                            )}
                            <p className="mt-1 text-[10px] text-slate-400">
                              {new Intl.DateTimeFormat("fr-FR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(n.created_at))}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Séparateur vertical */}
          <div className="mx-1.5 hidden h-8 w-px bg-slate-200 md:block" />

          {/* Profil utilisateur — desktop */}
          {user ? (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 transition hover:bg-slate-50"
              >
                {/* Avatar */}
                <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#009688] text-xs font-bold text-white ring-2 ring-[#009688]/20">
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt="" fill sizes="32px" className="object-cover" />
                  ) : (
                    initials
                  )}
                </span>
                <span className="hidden text-sm font-semibold text-slate-700 xl:block">
                  {displayName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Dropdown profil */}
              {profileMenuOpen && (
                <>
                  {/* Overlay invisible pour fermer */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl shadow-slate-200/50">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                      {/* Afficher le numéro WhatsApp ou email réel, jamais l'email synthétique @nikey.app */}
                      {(profile?.whatsapp_number || profile?.real_email) && (
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {profile.whatsapp_number || profile.real_email}
                        </p>
                      )}
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <UserRound className="h-4 w-4" />
                      Mon profil
                    </Link>
                    <Link
                      href="/seller"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Store className="h-4 w-4" />
                      Ma boutique
                    </Link>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        if (confirm("Voulez-vous vraiment vous déconnecter ?")) signOut();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="hidden h-10 items-center gap-2 rounded-full bg-[#009688] px-5 text-sm font-bold text-white shadow-sm shadow-[#009688]/20 transition hover:bg-[#00796B] md:flex"
            >
              <UserRound className="h-4 w-4" />
              Connexion
            </Link>
          )}

          {/* Bouton menu mobile */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 md:hidden"
          >
            {menuOpen
              ? <X className="h-5 w-5" />
              : <UserRound className="h-5 w-5" />
            }
          </button>
        </div>
      </div>

      {/* ── Barre de recherche mobile ──────────────────────────────── */}
      <div className="px-4 pb-2.5 md:hidden">
        <form onSubmit={onSearch} className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher sur Rivendy..."
            className="h-10 w-full rounded-full border-0 bg-slate-50 pl-9 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#009688]/25"
          />
        </form>
      </div>

      {/* ── Menu mobile déroulant ──────────────────────────────────── */}
      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-3 md:hidden">

          {/* Sélecteur pays */}
          <div className="relative mb-3">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={country.id}
              onChange={(e) => changeCountry(e.target.value)}
              className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm font-bold text-slate-700 outline-none"
            >
              {countries.map((c) => (
                <option value={c.id} key={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Liens nav */}
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm font-bold transition",
                    active
                      ? "bg-[#E0F2F1] text-[#009688]"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              href="/favorites"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm font-bold transition",
                pathname === "/favorites"
                  ? "bg-[#E0F2F1] text-[#009688]"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
            >
              Favoris
            </Link>

            <Link
              href="/notifications"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "relative rounded-2xl px-4 py-3 text-sm font-bold transition",
                pathname === "/notifications"
                  ? "bg-[#E0F2F1] text-[#009688]"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="absolute right-3 top-1/2 grid h-5 min-w-[20px] -translate-y-1/2 place-items-center rounded-full bg-[#FF6B35] px-1 text-[10px] font-black text-white">
                  {unreadCount}
                </span>
              )}
            </Link>

            {user ? (
              <button
                onClick={() => { signOut(); setMenuOpen(false); }}
                className="rounded-2xl bg-red-50 px-4 py-3 text-left text-sm font-bold text-red-600"
              >
                Déconnexion
              </button>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-2xl bg-[#009688] px-4 py-3 text-sm font-bold text-white"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
