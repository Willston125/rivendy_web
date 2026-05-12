"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="p-8 text-center text-sm font-semibold text-slate-500">Chargement...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-slate-950">Connexion requise</h1>
        <p className="mt-3 text-sm text-slate-500">Connecte-toi pour acceder a cette page Rivendy.</p>
        <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} className={buttonVariants({ className: "mt-6" })}>
          Se connecter
        </Link>
      </div>
    );
  }

  return children;
}
