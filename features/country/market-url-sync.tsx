"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCountry } from "@/features/country/country-provider";

/**
 * Synchronise le marché résolu (profil → localStorage) avec l'URL.
 *
 * Pourquoi : l'accueil (`app/page.tsx`) est rendu côté serveur et choisit le
 * pays UNIQUEMENT d'après `?country=`, avec fallback `DJ` si le paramètre est
 * absent. Un utilisateur qui revient (marché déjà résolu → pas de modale)
 * atterrit sur l'URL nue `/` → le serveur affiche Djibouti même si son marché
 * est les Comores. Ce composant réécrit l'URL avec le marché résolu.
 *
 * Règles :
 *  - N'agit que sur l'accueil `/` (seule route serveur pilotée par `?country=`).
 *  - N'agit que si AUCUN `?country=` n'est présent : un `?country=` explicite est
 *    un choix de l'utilisateur (lien, sélecteur) et doit être respecté.
 *  - `router.replace` (pas `push`) pour ne pas polluer l'historique.
 *  - Agit dès que `country` est résolu, sans attendre la fin complète du loading
 *    (évite la fenêtre de race condition qui affichait DJ).
 */
export function MarketUrlSync() {
  const { country } = useCountry();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Évite de remplacer l'URL plusieurs fois si le composant re-rend
  const replaced = useRef(false);

  useEffect(() => {
    if (pathname !== "/") return;
    if (!country) return;            // marché non résolu → la modale s'en charge
    if (params.get("country")) return; // choix explicite déjà présent → respecter

    // Si l'URL n'a pas encore le bon pays, on la corrige immédiatement
    if (replaced.current) return;
    replaced.current = true;

    const next = new URLSearchParams(params.toString());
    next.set("country", country.id);
    router.replace(`/?${next.toString()}`);
  }, [country, pathname, params, router]);

  // Reset le flag quand l'utilisateur navigue vers une autre page puis revient
  useEffect(() => {
    replaced.current = false;
  }, [pathname]);

  return null;
}

