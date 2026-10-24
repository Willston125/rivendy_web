/**
 * Rivendy Play « Emerald Cinema » (refonte du 2026-10-24) — recettes de
 * classes partagées par les composants Play. Les VALEURS (couleurs, rayons,
 * ombres, durées, courbe, polices) sont les jetons de app/site.css (`--rvp-*`
 * et `@theme`) ; ce module ne fait que les assembler, pour qu'aucune valeur
 * ne soit répétée d'un fichier à l'autre.
 */

/** Transition commune (survols, bascules) : durée et courbe de Play. */
export const motion = "transition duration-(--rvp-base) ease-rvp";

const btnBase =
  "inline-flex h-12 items-center justify-center gap-2 rounded-rvp px-5 text-[15px] font-semibold transition duration-(--rvp-base) ease-rvp disabled:cursor-not-allowed disabled:opacity-60";

/** Bouton principal (regarder, reprendre) : le vert lumineux, un halo qui s'intensifie au survol. */
export const btnPrimary =
  `${btnBase} bg-rvp-accent px-6 text-rvp-on-accent shadow-rvp-cta hover:bg-rvp-accent-hover hover:shadow-rvp-cta-hover active:bg-rvp-accent-pressed motion-safe:hover:scale-[1.03] motion-safe:active:scale-100`;
/** Bouton secondaire (Ma liste, partager) : verre sombre, bord vert au survol. */
export const btnSecondary =
  `${btnBase} border border-white/15 bg-white/[0.06] text-rvp-text backdrop-blur-md hover:border-rvp-edge-strong hover:bg-white/[0.1]`;
export const btnGhost = `${btnBase} px-3 text-rvp-soft hover:text-rvp-text`;
/** Bouton carré à icône seule (fiche d'information de la bannière). */
export const btnIcon =
  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-rvp border border-white/15 bg-white/[0.06] text-rvp-soft backdrop-blur-md transition duration-(--rvp-base) ease-rvp hover:border-rvp-edge-strong hover:text-rvp-text";
/** Bouton rond posé sur une image ou la bannière (précédent, suivant). */
export const btnRound =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-rvp-ground/50 text-rvp-soft backdrop-blur-md transition duration-(--rvp-base) ease-rvp hover:border-rvp-edge-strong hover:text-rvp-text";

/**
 * Téléphone (< 640 px) : la scène (bannière, fiche) va d'un bord à l'autre et
 * passe sous la barre du haut transparente (h-14 de MobileTopBar), comme une
 * affiche plein écran.
 */
export const sceneBleed = "max-sm:-mx-4 max-sm:-mt-14 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0";

/** Titres : Urbanist très gras, serré (bannière, rubriques, cartes). */
export const display = "font-rvp-display font-extrabold tracking-[-0.02em]";
/** Petite ligne en capitales espacées (« RIVENDY PLAY ▶ », « L'ESPACE DES TALENTS »). */
export const eyebrow = "text-[11px] font-bold uppercase tracking-[0.18em]";

/** Carte entière (image et commandes posées dessus) : léger agrandissement au survol et au clavier. */
export const cardLift =
  "transition-transform duration-(--rvp-base) ease-rvp motion-safe:hover:scale-[1.025] motion-safe:focus-within:scale-[1.025]";
/** Cadre de l'image d'une carte : bord discret, vert et halo au survol. */
export const cardFrame =
  "relative block overflow-hidden rounded-rvp-card border border-white/[0.07] bg-rvp-surface shadow-rvp-card transition duration-(--rvp-base) ease-rvp group-hover:border-rvp-edge-strong group-hover:shadow-rvp-glow";
/** Bouton rond posé sur une carte (lecture). */
export const cardPlay =
  "grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-rvp-ground/45 text-rvp-text backdrop-blur-md transition duration-(--rvp-base) ease-rvp hover:border-rvp-accent hover:bg-rvp-accent hover:text-rvp-on-accent group-hover:border-rvp-accent/70";

// ── Images ──────────────────────────────────────────────────────────────────
// Largeurs proposées au navigateur (`srcset`, redimensionnées par Supabase
// sans recadrage) et place réelle de chaque image (`sizes`).

/** Bannière : la même adresse pour l'ambiance floutée et l'image nette (un seul téléchargement). */
export const HERO_WIDTHS = [480, 720, 1080] as const;
export const HERO_SIZES_POSTER = "(min-width: 1024px) 680px, (min-width: 640px) 70vw, 100vw";
export const HERO_SIZES_WIDE = "(min-width: 1024px) 70vw, 100vw";

export const CARD_WIDTHS = [320, 480, 720] as const;
/** Cartes 4:3 du catalogue (grilles de 2 à 5 colonnes). */
export const CARD_SIZES = "(min-width: 1536px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 31vw, 47vw";
/** Cartes 16:9 (reprise, clips). */
export const WIDE_SIZES = "(min-width: 1536px) 24vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 82vw";
/** Affiches 2:3 (classement d'un grand catalogue). */
export const POSTER_SIZES = "(min-width: 1536px) 14vw, (min-width: 1024px) 17vw, (min-width: 640px) 28vw, 42vw";
