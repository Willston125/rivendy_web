"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, PlusCircle, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Flutter nav : Home | Search | [FAB Publier] | Favoris | Profil
const items = [
  { href: "/",          label: "Accueil",  icon: Home },
  { href: "/search",    label: "Chercher", icon: Search },
  { href: "/sell",      label: "Publier",  icon: PlusCircle, isCenter: true },
  { href: "/favorites", label: "Favoris",  icon: Heart },
  { href: "/profile",   label: "Profil",   icon: UserRound },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white pb-safe md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          /* ── Bouton central FAB ─────────────────────────────── */
          if ("isCenter" in item && item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex -translate-y-3 flex-col items-center gap-0.5"
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-[#007168]/30 transition",
                    active ? "bg-[#00796B]" : "bg-[#007168] hover:bg-[#00796B]",
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    active ? "text-[#007168]" : "text-slate-500",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          /* ── Bouton standard ────────────────────────────────── */
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-2"
            >
              <span
                className={cn(
                  "relative flex h-6 w-6 items-center justify-center transition",
                  active ? "text-[#007168]" : "text-slate-400",
                )}
              >
                <Icon className={cn("h-6 w-6", active && "stroke-[2.5px]")} />
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#007168]" />
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold",
                  active ? "text-[#007168]" : "text-slate-400",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
