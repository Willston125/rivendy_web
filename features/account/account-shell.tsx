"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserRound,
  Settings,
  KeyRound,
  Wallet,
  CreditCard,
  Store,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Coque "Mon compte" — layout 2 colonnes (menu latéral + contenu) façon
 * espace compte des sites e-commerce. Le menu met en évidence la section
 * active. Sur mobile, le menu passe au-dessus du contenu en grille scrollable.
 */

type AccountLink = { href: string; label: string; icon: LucideIcon };

const ACCOUNT_NAV: AccountLink[] = [
  { href: "/profile", label: "Mon profil", icon: UserRound },
  { href: "/profile/info", label: "Informations", icon: UserRound },
  { href: "/profile/password", label: "Sécurité", icon: KeyRound },
  { href: "/profile/payment-methods", label: "Moyens de paiement", icon: CreditCard },
  { href: "/wallet", label: "Portefeuille", icon: Wallet },
  { href: "/profile/settings", label: "Paramètres", icon: Settings },
  { href: "/seller", label: "Ma boutique", icon: Store },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* ── Menu latéral ──────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
            Mon compte
          </p>
          {/* Mobile : grille scrollable / Desktop : liste verticale */}
          <nav className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm lg:flex-col lg:gap-0.5">
            {ACCOUNT_NAV.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || (href !== "/profile" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition lg:justify-between",
                    active
                      ? "bg-[#E0F2F1] text-[#009688]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{label}</span>
                  </span>
                  <ChevronRight
                    className={cn("hidden h-4 w-4 shrink-0 lg:block", active ? "text-[#009688]" : "text-slate-300")}
                  />
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Contenu ───────────────────────────────────────────── */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
