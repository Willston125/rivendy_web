"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { loginHref } from "@/lib/hotels/search-params";

/**
 * Garde de connexion du parcours hôtelier.
 *
 * Diffère de `RequireAuth` sur un point qui compte ici : le lien de
 * connexion conserve la QUERY STRING. Le brouillon de réservation vit dans
 * l'URL ; le perdre au passage par la connexion obligerait le voyageur à
 * tout ressaisir.
 */
export function HotelAuthGate({
  children,
  title = "Connexion requise",
  message = "Connectez-vous pour accéder à vos réservations d'hôtel.",
}: {
  children: React.ReactNode;
  title?: string;
  message?: string;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();

  if (loading) {
    return <div className="p-8 text-center text-sm font-semibold text-slate-500" aria-busy="true">Chargement…</div>;
  }
  if (!user) {
    const qs = params.toString();
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E0F2F1] text-[#007168]">
          <LogIn className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <Link href={loginHref(`${pathname}${qs ? `?${qs}` : ""}`)} className={buttonVariants({ className: "mt-6" })}>
          Se connecter
        </Link>
      </main>
    );
  }
  return <>{children}</>;
}
