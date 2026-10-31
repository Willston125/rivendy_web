/**
 * Mini-lecteur vidéo de Rivendy Play sur le site (2026-10-31) — règles pures,
 * testées (node --test features/play/play-logic.test.mjs).
 *
 * Quitter la page de lecture pendant qu'un film, un épisode ou un clip JOUE le
 * fait passer dans le mini-lecteur ; en pause, fini ou en erreur, la lecture
 * se ferme (même règle que le lecteur flottant de l'app).
 */

export function shouldFloat(floatable: boolean, media: { paused: boolean; ended: boolean } | null): boolean {
  return floatable && !!media && !media.paused && !media.ended;
}

export type DockSide = "left" | "right";
/** Position choisie par l'utilisateur : le bord, et la distance au bas de la fenêtre (px). */
export type DockSpot = { side: DockSide; bottom: number };
type Size = { w: number; h: number };
/** Marges à respecter : haut (encoche, barres) et bas (barre système), en px. */
type Limits = { top: number; bottom: number };

/** Distance au bas gardée dans la fenêtre : jamais sous la marge basse, jamais au-dessus de la marge haute. */
function clampBottom(bottom: number, size: Size, view: Size, limits: Limits): number {
  const max = Math.max(limits.bottom, view.h - limits.top - size.h);
  return Math.round(Math.min(max, Math.max(limits.bottom, bottom)));
}

/** Fin d'un déplacement : collé au bord le plus proche du centre, toujours entièrement visible. */
export function settleDock(center: { x: number; y: number }, size: Size, view: Size, limits: Limits): DockSpot {
  return {
    side: center.x < view.w / 2 ? "left" : "right",
    bottom: clampBottom(view.h - center.y - size.h / 2, size, view, limits),
  };
}

/** Rotation ou fenêtre redimensionnée : la position gardée reste visible. */
export function clampDock(spot: DockSpot, size: Size, view: Size, limits: Limits): DockSpot {
  const bottom = clampBottom(spot.bottom, size, view, limits);
  return bottom === spot.bottom ? spot : { ...spot, bottom };
}

/** « 1:02:03 » / « 4:05 » — temps affiché dans le mini-lecteur. */
export function dockClock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
