"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { clampPanel, fitPanels, type LibraryKind, type LibrarySort } from "./music-logic";

/**
 * Disposition de l'espace Musique (mise en page « application » du
 * 2026-10-22) : largeur de la bibliothèque et du panneau « En cours de
 * lecture », bibliothèque repliée ou agrandie, panneau droit ouvert ou
 * fermé, tri et vue de la bibliothèque. Un confort du navigateur : gardé
 * dans localStorage, jamais envoyé au serveur.
 */

export const LIB_MIN = 240;
export const LIB_MAX = 440;
export const LIB_COLLAPSED = 72;
export const RIGHT_MIN = 280;
export const RIGHT_MAX = 440;
/** Le panneau central ne descend jamais en dessous (lisibilité des listes). */
export const CENTER_MIN = 420;
/** Marges et espaces entre panneaux : aucun depuis le style « fraîcheur » (colonnes jointives). */
const CHROME = 0;

export type LibraryMode = "list" | "collapsed" | "expanded";
export type LibraryView = "list" | "compact" | "grid";
export type RightMode = "now" | "queue";

type Saved = {
  libWidth: number;
  libMode: LibraryMode;
  libView: LibraryView;
  libSort: LibrarySort;
  rightWidth: number;
  rightOpen: boolean;
};

const DEFAULTS: Saved = { libWidth: 300, libMode: "list", libView: "list", libSort: "recent", rightWidth: 340, rightOpen: true };
const KEY = "rivendy_music_layout_v1";

type LayoutContext = Saved & {
  /** Largeurs réellement affichées (le centre garde sa largeur minimale). */
  shownLib: number;
  shownRight: number;
  libKind: LibraryKind | null;
  rightMode: RightMode;
  /** Panneau droit en tiroir (écrans intermédiaires) : ouvert ? */
  drawerOpen: boolean;
  /** ≥ 1280 px : panneau droit dans la page ; en dessous, en tiroir. */
  wide: boolean;
  /** ≥ 768 px : bibliothèque à gauche ; en dessous, navigation du bas. */
  tablet: boolean;
  setLibWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
  setLibMode: (m: LibraryMode) => void;
  setLibView: (v: LibraryView) => void;
  setLibSort: (s: LibrarySort) => void;
  setLibKind: (k: LibraryKind | null) => void;
  /** Bouton du lecteur : ouvre ou ferme le panneau « En cours de lecture ». */
  toggleNowPlaying: () => void;
  /** Bouton du lecteur : ouvre la file d'attente (ou referme si elle est affichée). */
  toggleQueue: () => void;
  setRightMode: (m: RightMode) => void;
  closeRight: () => void;
  /** Le panneau droit est-il affiché (dans la page ou en tiroir) ? */
  rightVisible: boolean;
};

const Ctx = createContext<LayoutContext | null>(null);

function useMedia(query: string, fallback: boolean): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

function useViewportWidth(): number {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("resize", cb); return () => window.removeEventListener("resize", cb); },
    () => window.innerWidth,
    () => 1440,
  );
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Saved>;
    return {
      libWidth: clampPanel(Number(v.libWidth ?? DEFAULTS.libWidth), LIB_MIN, LIB_MAX),
      libMode: v.libMode === "collapsed" || v.libMode === "expanded" ? v.libMode : "list",
      libView: v.libView === "compact" || v.libView === "grid" ? v.libView : "list",
      libSort: v.libSort === "added" || v.libSort === "alpha" ? v.libSort : "recent",
      rightWidth: clampPanel(Number(v.rightWidth ?? DEFAULTS.rightWidth), RIGHT_MIN, RIGHT_MAX),
      rightOpen: v.rightOpen !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(s: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
}

/**
 * La première coque s'hydrate avec les valeurs par défaut (comme le serveur)
 * puis lit la disposition ; une coque remontée ensuite (retour dans la
 * Musique depuis une autre page du site) la lit tout de suite, sans à-coup.
 */
let hydrated = false;

export function MusicLayoutProvider({ children, hasCurrent }: { children: ReactNode; hasCurrent: boolean }) {
  const [saved, setSaved] = useState<Saved>(() => (hydrated ? load() : DEFAULTS));
  const [libKind, setLibKind] = useState<LibraryKind | null>(null);
  const [rightMode, setRightMode] = useState<RightMode>("now");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = useMedia("(min-width: 1280px)", true);
  const tablet = useMedia("(min-width: 768px)", true);
  const vw = useViewportWidth();

  // Disposition du navigateur retrouvée (après le premier rendu : pas d'écart d'hydratation).
  useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    setSaved(load());
  }, []);

  // Enregistrée seulement sur un geste : un montage n'écrase jamais la disposition
  // (en développement, React joue les effets deux fois).
  const patch = useCallback((p: Partial<Saved>) => setSaved((s) => {
    const next = { ...s, ...p };
    persist(next);
    return next;
  }), []);

  // Le tiroir se referme en passant en grand écran (le panneau rejoint la page).
  useEffect(() => { if (wide) setDrawerOpen(false); }, [wide]);

  const rightDocked = wide && saved.rightOpen && hasCurrent;
  const rightVisible = hasCurrent && (wide ? saved.rightOpen : drawerOpen);
  // Tablette (768-1023 px) : navigation compacte, la colonne de gauche à sa
  // largeur minimale (sans poignée) ; la largeur choisie sur ordinateur est gardée.
  const compactLeft = vw < 1024;
  const fitted = fitPanels({
    available: vw - CHROME,
    left: saved.libMode === "collapsed" ? LIB_COLLAPSED : compactLeft ? LIB_MIN : saved.libWidth,
    right: rightDocked ? saved.rightWidth : 0,
    leftMin: saved.libMode === "collapsed" ? LIB_COLLAPSED : LIB_MIN,
    rightMin: rightDocked ? RIGHT_MIN : 0,
    centerMin: CENTER_MIN,
  });

  const openRight = useCallback((mode: RightMode) => {
    setRightMode(mode);
    if (wide) patch({ rightOpen: true }); else setDrawerOpen(true);
  }, [patch, wide]);

  const closeRight = useCallback(() => {
    if (wide) patch({ rightOpen: false }); else setDrawerOpen(false);
  }, [patch, wide]);

  const toggleNowPlaying = useCallback(() => {
    if (rightVisible && rightMode === "now") closeRight(); else openRight("now");
  }, [closeRight, openRight, rightMode, rightVisible]);

  const toggleQueue = useCallback(() => {
    if (rightVisible && rightMode === "queue") closeRight(); else openRight("queue");
  }, [closeRight, openRight, rightMode, rightVisible]);

  const value = useMemo<LayoutContext>(() => ({
    ...saved,
    shownLib: fitted.left,
    shownRight: fitted.right,
    libKind, rightMode, drawerOpen, wide, tablet, rightVisible,
    setLibWidth: (w) => patch({ libWidth: clampPanel(w, LIB_MIN, LIB_MAX), libMode: "list" }),
    setRightWidth: (w) => patch({ rightWidth: clampPanel(w, RIGHT_MIN, RIGHT_MAX) }),
    setLibMode: (m) => patch({ libMode: m, ...(m === "expanded" ? { libView: "grid" as const } : {}) }),
    setLibView: (v) => patch({ libView: v }),
    setLibSort: (s) => patch({ libSort: s }),
    setLibKind,
    toggleNowPlaying, toggleQueue, setRightMode, closeRight,
  }), [saved, fitted.left, fitted.right, libKind, rightMode, drawerOpen, wide, tablet, rightVisible, patch, toggleNowPlaying,
    toggleQueue, closeRight]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMusicLayout(): LayoutContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMusicLayout doit être utilisé dans MusicLayoutProvider");
  return ctx;
}

/** Hors de l'espace Musique (lecteur flottant des autres pages) : pas de disposition. */
export function useMusicLayoutOptional(): LayoutContext | null {
  return useContext(Ctx);
}
