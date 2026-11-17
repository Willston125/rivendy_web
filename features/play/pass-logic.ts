/**
 * Rivendy Pass — règles PURES de Play sur le site (formules simplifiées,
 * lot 3, 2026-11-17). Sans import : testées sous Node par
 * `node --test features/play/pass-logic.test.mjs` (npm run check:pass).
 *
 * Contrat serveur (dépôt dashboard, 20261115_1400_formules_5_rivendy_pass.sql) :
 *  - `play_unlock_offer(p_title_id)` : niveau du titre (free / plus / locked),
 *    prix du marché, déjà débloqué, épisodes et saisons ;
 *  - `my_play_unlocks(p_title_id)` : demandes en cours et titres acquis ;
 *  - `request_play_unlock(p_unit, p_title_id, p_episode_id, p_season,
 *    p_payment_channel)` : référence RVD-XXXXXX et prix fixés par le SERVEUR ;
 *  - `declare_play_unlock_payment`, `cancel_my_play_unlock_request`.
 * Trois niveaux (grille du 15/11) : libre ; bloqué = Rivendy Pass ou
 * Rivendy+ ; Rivendy+ seulement. Aucun prix n'est écrit dans ce fichier.
 */

export type UnlockUnit = "title" | "episode" | "season";

export interface UnlockOfferEpisode {
  episode_id: string;
  season: number;
  number: number;
  free: boolean;
  unlocked: boolean;
  price: number | null;
}

export interface UnlockOfferSeason {
  season: number;
  episodes: number;
  price: number | null;
  unlocked: boolean;
}

export interface UnlockOffer {
  success: boolean;
  error?: string;
  access?: "free" | "plus" | "locked";
  unlockable?: boolean;
  plus_active?: boolean;
  market?: string;
  currency?: string;
  in_territory?: boolean;
  title?: { price: number | null; unlocked: boolean };
  episode_price?: number | null;
  seasons?: UnlockOfferSeason[];
  episodes?: UnlockOfferEpisode[];
}

export interface MyUnlock {
  id: string;
  unit: UnlockUnit;
  title_id: string;
  title?: string;
  episode_id?: string | null;
  season?: number | null;
  status: "pending" | "active";
  reference: string;
  price: number;
  country_id: string;
  declared_at?: string | null;
  activated_at?: string | null;
  created_at: string;
}

/**
 * État d'un film, d'un épisode ou d'une saison pour le compte connecté.
 *  - free : libre (titre libre ou épisode offert) ;
 *  - plus : ouvert par Rivendy+ ;
 *  - unlocked : débloqué avec le Pass, acquis pour toujours ;
 *  - to_pay / declared : demande en cours, à payer / paiement déclaré ;
 *  - locked : à débloquer, prix connu ;
 *  - plus_only : réservé à Rivendy+ (ne se débloque pas à l'unité) ;
 *  - not_in_territory : pas dans le pays du compte ;
 *  - not_for_sale : bloqué mais sans prix dans ce marché.
 */
export type PassState =
  | "free" | "plus" | "unlocked" | "to_pay" | "declared" | "locked" | "plus_only" | "not_in_territory" | "not_for_sale";

function pendingState(p: MyUnlock | undefined): PassState | null {
  if (!p) return null;
  return p.declared_at ? "declared" : "to_pay";
}

/** Demande en cours pour une cible précise (la même règle que le serveur). */
export function pendingFor(
  unlocks: MyUnlock[], titleId: string, unit: UnlockUnit, target: { episodeId?: string | null; season?: number | null } = {},
): MyUnlock | undefined {
  return unlocks.find((u) => u.status === "pending" && u.title_id === titleId && u.unit === unit
    && (unit !== "episode" || u.episode_id === target.episodeId)
    && (unit !== "season" || u.season === target.season));
}

/** Film (ou tout titre débloqué d'un bloc). */
export function filmState(offer: UnlockOffer, unlocks: MyUnlock[], titleId: string): PassState {
  if (offer.access === "free") return "free";
  if (offer.plus_active) return "plus";
  if (offer.access === "plus") return "plus_only";
  if (offer.title?.unlocked) return "unlocked";
  const pending = pendingState(pendingFor(unlocks, titleId, "title"));
  if (pending) return pending;
  if (offer.in_territory === false) return "not_in_territory";
  return offer.unlockable && offer.title?.price != null ? "locked" : "not_for_sale";
}

/** Épisode d'une série bloquée : offert, débloqué, ou couvert par une saison demandée. */
export function episodeState(ep: UnlockOfferEpisode, offer: UnlockOffer, unlocks: MyUnlock[], titleId: string): PassState {
  if (offer.access === "free" || ep.free) return "free";
  if (offer.plus_active) return "plus";
  if (offer.access === "plus") return "plus_only";
  if (ep.unlocked) return "unlocked";
  const pending = pendingState(pendingFor(unlocks, titleId, "episode", { episodeId: ep.episode_id }))
    ?? pendingState(pendingFor(unlocks, titleId, "season", { season: ep.season }));
  if (pending) return pending;
  if (offer.in_territory === false) return "not_in_territory";
  return offer.unlockable && ep.price != null ? "locked" : "not_for_sale";
}

export interface SeasonOffer {
  season: number;
  price: number | null;
  state: PassState;
  /** Prix des épisodes payants de la saison, un par un (repère « au lieu de »). */
  regularTotal: number | null;
  /** Épisodes payants de la saison. */
  paidEpisodes: number;
}

/** La saison entière, si elle se vend dans ce marché. */
export function seasonOffer(season: number, offer: UnlockOffer, unlocks: MyUnlock[], titleId: string): SeasonOffer | null {
  const s = offer.seasons?.find((x) => x.season === season);
  if (!s) return null;
  const paid = (offer.episodes ?? []).filter((e) => e.season === season && !e.free);
  const regularTotal = offer.episode_price != null && paid.length > 0 ? paid.length * offer.episode_price : null;
  let state: PassState;
  if (offer.access === "free") state = "free";
  else if (offer.plus_active) state = "plus";
  else if (offer.access === "plus") state = "plus_only";
  else if (s.unlocked || (paid.length > 0 && paid.every((e) => e.unlocked))) state = "unlocked";
  else {
    state = pendingState(pendingFor(unlocks, titleId, "season", { season }))
      ?? (offer.in_territory === false ? "not_in_territory"
        : offer.unlockable && s.price != null ? "locked" : "not_for_sale");
  }
  return { season, price: s.price, state, regularTotal, paidEpisodes: paid.length };
}

/** La carte « saison entière » ne s'affiche que si elle peut servir. */
export function showSeasonCard(s: SeasonOffer | null): boolean {
  return !!s && s.price != null && (s.state === "locked" || s.state === "to_pay" || s.state === "declared");
}

/** Niveau d'accès d'un titre du catalogue (pastilles et filtre). */
export type AccessLevel = "free" | "pass" | "plus";

export function accessLevel(t: { is_premium?: boolean | null; pass_unlockable?: boolean | null }): AccessLevel {
  if (!t.is_premium) return "free";
  return t.pass_unlockable ? "pass" : "plus";
}

/** Prix du Pass d'un marché pour un visiteur (play_unlock_prices, lisible sans compte). */
export function passPriceFor(
  rows: Array<{ country_id: string; unit: string; price: number | string; is_on_sale?: boolean | null }>,
  market: string | null | undefined, unit: "title" | "episode",
): number | null {
  if (!market) return null;
  const row = rows.find((r) => r.country_id === market && r.unit === unit && r.is_on_sale !== false);
  const price = row ? Number(row.price) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** « « Ngoma ya Hairi » », « Saison 1 de « … » », « Épisode 3 de « … » ». */
export function unlockTargetLabel(t: { unit: UnlockUnit; title?: string | null; season?: number | null; episodeNumber?: number | null }): string {
  const name = t.title ? `« ${t.title} »` : "ce titre";
  if (t.unit === "season") return `Saison ${t.season ?? "?"} de ${name}`;
  if (t.unit === "episode") return t.episodeNumber ? `Épisode ${t.episodeNumber} de ${name}` : `Un épisode de ${name}`;
  return name;
}

/** Message affichable pour un code d'erreur de `request_play_unlock`. */
export function unlockErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated":
      return "Votre session a expiré : reconnectez-vous puis réessayez.";
    case "not_available_in_this_app":
      return "Le déblocage se fait sur rivendy.com.";
    case "not_found":
    case "bad_target":
    case "bad_unit":
      return "Ce titre n’est plus disponible. Rechargez la page.";
    case "not_unlockable":
      return "Ce titre ne se débloque pas à l’unité : il est réservé à Rivendy+.";
    case "no_market":
      return "Votre compte n’a pas de pays enregistré : complétez votre profil puis réessayez.";
    case "not_in_territory":
      return "Ce titre n’est pas disponible dans votre pays.";
    case "sale_closed":
      return "Le Rivendy Pass n’est pas encore disponible dans votre pays.";
    case "not_on_sale":
      return "Ce titre n’est pas encore en vente dans votre pays.";
    case "already_unlocked":
      return "C’est déjà débloqué sur votre compte.";
    case "free_episode":
      return "Cet épisode est offert : regardez-le directement.";
    case "channel_unavailable":
      return "Ce moyen de paiement n’est plus disponible. Choisissez-en un autre.";
    case "too_many_pending":
      return "Vous avez déjà 5 demandes en attente : réglez ou annulez-en une avant d’en créer une nouvelle.";
    default:
      return "Votre demande n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.";
  }
}

/** Statut lisible d'une demande ou d'un titre acquis (Mon Rivendy+). */
export function unlockStatusLabel(u: Pick<MyUnlock, "status" | "declared_at">): string {
  if (u.status === "active") return "Débloqué";
  return u.declared_at ? "Paiement déclaré — en vérification" : "À payer";
}
