"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type StoreSort = "recent" | "price_asc" | "price_desc";
export type StoreView = "grid" | "list";

interface BrowseState {
  query: string;
  setQuery: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  sort: StoreSort;
  setSort: (v: StoreSort) => void;
  view: StoreView;
  setView: (v: StoreView) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
}

const StoreBrowseContext = createContext<BrowseState | null>(null);

/**
 * État de navigation du catalogue partagé entre la barre sticky (recherche/filtres)
 * et la grille de produits. Permet à la recherche placée dans la nav de piloter
 * le catalogue rendu plus bas, sans dupliquer l'état.
 */
export function StoreBrowseProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<StoreSort>("recent");
  const [view, setView] = useState<StoreView>("grid");
  const [showFilters, setShowFilters] = useState(false);

  return (
    <StoreBrowseContext.Provider
      value={{ query, setQuery, category, setCategory, sort, setSort, view, setView, showFilters, setShowFilters }}
    >
      {children}
    </StoreBrowseContext.Provider>
  );
}

export function useStoreBrowse(): BrowseState {
  const ctx = useContext(StoreBrowseContext);
  if (!ctx) throw new Error("useStoreBrowse doit être utilisé dans <StoreBrowseProvider>");
  return ctx;
}
