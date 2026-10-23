"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { searchHref } from "./play-logic";

/**
 * Recherche de Rivendy Play (coque « application » du 2026-10-23) : UNE
 * saisie, partagée par le champ de la barre du haut (ordinateur) et celui
 * de la page de recherche (téléphone, tablette). Les résultats suivent la
 * frappe sans attendre ; l'adresse (/play/search?q=…) suit à son rythme,
 * sans recharger la page (partage du lien, retour arrière).
 */

type PlaySearchValue = {
  query: string;
  setQuery: (v: string) => void;
  /** Depuis une autre page : ouvre la recherche en gardant la saisie. */
  open: (v: string) => void;
  /** Champ de la barre du haut (raccourci Ctrl K). */
  inputRef: RefObject<HTMLInputElement | null>;
};

const PlaySearchContext = createContext<PlaySearchValue | null>(null);

export function usePlaySearch(): PlaySearchValue {
  const v = useContext(PlaySearchContext);
  if (!v) throw new Error("usePlaySearch hors de PlaySearchProvider");
  return v;
}

function addressQuery(): string {
  try {
    return (new URLSearchParams(window.location.search).get("q") ?? "").slice(0, 60);
  } catch {
    return "";
  }
}

export function PlaySearchProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/play";
  const router = useRouter();
  const onSearch = pathname === "/play/search";
  const [query, setQuery] = useState("");
  const fromBar = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Arrivée sur la recherche : la saisie de la barre du haut est gardée (on
  // continue de taper), sinon celle de l'adresse (lien partagé, retour
  // arrière). En quittant la recherche, le champ se vide.
  useEffect(() => {
    if (onSearch) {
      if (!fromBar.current) setQuery(addressQuery());
    } else {
      setQuery("");
    }
    fromBar.current = false;
  }, [onSearch]);

  // L'adresse suit la saisie, sans recharger la page ni redemander le serveur.
  useEffect(() => {
    if (!onSearch) return;
    const timer = window.setTimeout(() => {
      const url = searchHref(query);
      if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  const open = useCallback((v: string) => {
    fromBar.current = true;
    router.push(searchHref(v));
  }, [router]);

  const value = useMemo<PlaySearchValue>(() => ({ query, setQuery, open, inputRef }), [query, open]);
  return <PlaySearchContext.Provider value={value}>{children}</PlaySearchContext.Provider>;
}
