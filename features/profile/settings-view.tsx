"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Shield,
  Store,
  User,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

// ── Types ──────────────────────────────────────────────────
interface SettingsItem {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

// ── Composant ligne ────────────────────────────────────────
function SettingsRow({ item, isLast }: { item: SettingsItem; isLast: boolean }) {
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 transition ${
        !item.disabled ? "hover:bg-slate-50 active:bg-slate-100" : "opacity-40"
      } ${!isLast ? "border-b border-slate-50" : ""}`}
    >
      {/* Icône */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: item.iconBg }}
      >
        <item.icon className="h-4.5 w-4.5" style={{ color: item.iconColor }} />
      </div>

      {/* Texte */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#1A1A1A]">{item.label}</p>
        {item.sub && <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p>}
      </div>

      {/* Badge ou chevron */}
      {item.badge ?? (
        !item.disabled && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      )}
    </div>
  );

  if (item.disabled) return inner;
  if (item.href) return <Link href={item.href}>{inner}</Link>;
  if (item.onClick) return <button type="button" onClick={item.onClick} className="w-full text-left">{inner}</button>;
  return inner;
}

// ── Composant principal ────────────────────────────────────
export function SettingsView() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    if (!confirm("Voulez-vous vraiment vous déconnecter ?")) return;
    await signOut();
    router.push("/");
  }

  const isCertified = profile?.is_certified ?? false;

  const sections: SettingsSection[] = [
    {
      title: "Compte",
      items: [
        {
          icon: User,
          iconColor: "#007168",
          iconBg: "#E0F2F1",
          label: "Informations personnelles",
          sub: profile?.full_name || undefined,
          href: "/profile/info",
        },
        {
          icon: Lock,
          iconColor: "#6A5ACD",
          iconBg: "#6A5ACD18",
          label: "Mot de passe",
          href: "/profile/password",
        },
      ],
    },
    {
      title: "Mon statut vendeur",
      items: [
        isCertified
          ? {
              icon: BadgeCheck,
              iconColor: "#007168",
              iconBg: "#E0F2F1",
              label: "Abonnement Vendeur Certifié",
              sub: "Badge actif sur vos annonces",
              href: "/seller/subscription",
              badge: (
                <span className="rounded-full bg-[#E0F2F1] px-2.5 py-0.5 text-xs font-black text-[#009688]">
                  ACTIF
                </span>
              ),
            }
          : {
              icon: BadgeCheck,
              iconColor: "#007168",
              iconBg: "#E0F2F1",
              label: "Devenir Vendeur Certifié ✅",
              sub: "Badge de confiance sur vos annonces",
              href: "/seller/subscription",
            },
        {
          icon: Store,
          iconColor: "#007168",
          iconBg: "#E0F2F1",
          label: "Ma boutique",
          href: "/seller/sales",
        },
      ],
    },
    {
      title: "Paiement",
      items: [
        {
          icon: Wallet,
          iconColor: "#007168",
          iconBg: "#E0F2F1",
          label: "Portefeuille & Gains",
          href: "/wallet",
        },
        {
          icon: CreditCard,
          iconColor: "#6A5ACD",
          iconBg: "#6A5ACD18",
          label: "Moyens de paiement",
          href: "/profile/payment-methods",
        },
      ],
    },
    {
      title: "Informations légales",
      items: [
        {
          icon: HelpCircle,
          iconColor: "#007168",
          iconBg: "#E0F2F1",
          label: "Aide & Support",
          href: "/help",
        },
        {
          icon: Shield,
          iconColor: "#6A5ACD",
          iconBg: "#6A5ACD18",
          label: "Confidentialité",
          href: "/legal?tab=privacy",
        },
        {
          icon: FileText,
          iconColor: "#1A1A1A",
          iconBg: "#F5F7FA",
          label: "Conditions d'utilisation",
          href: "/legal?tab=cgu",
        },
      ],
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Compte</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Paramètres</h1>
        {(profile?.whatsapp_number || profile?.real_email) && (
          <p className="mt-1 text-sm text-slate-400">
            {profile.whatsapp_number || profile.real_email}
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {section.items.map((item, i) => (
                <SettingsRow
                  key={item.label}
                  item={item}
                  isLast={i === section.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Version */}
        <p className="py-2 text-center text-xs text-slate-300">
          Rivendy · Marketplace de confiance
        </p>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 text-sm font-black text-red-500 transition hover:bg-red-100"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
