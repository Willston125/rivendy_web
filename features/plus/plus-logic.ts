/**
 * Rivendy+ — règles PURES des pages /plus et /plus/abonnement (Omnicanal
 * lot B, 2026-10-21). Sans import : testées sous Node par
 * `node --test features/plus/plus-logic.test.mjs` (npm run check:plus).
 *
 * Contrat serveur (dépôt dashboard, 20261021_1920_omni_b3_demande_rivendy_plus.sql) :
 *  - `rivendy_plus_catalog(p_market)` : formules EN VENTE et moyens RÉELLEMENT
 *    disponibles dans le marché (numéro saisi au dashboard, agence active) ;
 *  - `request_play_pass(p_plan, p_payment_channel)` : prix, marché et référence
 *    RVP-XXXXXX fixés par le SERVEUR ;
 *  - `declare_play_pass_payment(p_pass_id, p_payer_phone, p_operator_reference,
 *    p_proof_path)` : le client déclare son paiement mobile money ;
 *  - `cancel_my_play_pass_request(p_pass_id)`, `rivendy_entitlements()`.
 * Aucun prix, numéro ni moyen de paiement n'est écrit dans ce fichier.
 */

export type ChannelKind = "mobile_money" | "cash" | string;

export interface PlusOffer {
  code: string;
  display_name: string;
  kind: "subscription" | "pass" | string;
  duration_hours: number;
  price: number;
  currency: string;
  entitlements?: Record<string, unknown>;
}

export interface PlusAgency {
  id: string;
  name: string;
  address?: string;
  opening_hours?: string;
  contact_phone?: string;
}

export interface PlusChannel {
  code: string;
  label: string;
  kind: ChannelKind;
  account_number?: string;
  account_name?: string;
  instructions?: string;
  agencies?: PlusAgency[];
}

export interface PlusCatalog {
  success: boolean;
  error?: string;
  market?: string;
  currency?: string;
  sale_open?: boolean;
  test_mode?: boolean;
  can_request?: boolean;
  signed_in?: boolean;
  request_valid_days?: number;
  offers?: PlusOffer[];
  channels?: PlusChannel[];
}

/**
 * Contenus exclusifs et avant-premières : droits semés à vrai (formule
 * `month`) mais qu'aucun contenu ni aucune règle n'applique encore (audit des
 * paramètres du 2026-11-03, M-01). Jamais promis avant d'exister.
 */
export const EXCLUSIVE_CONTENT_LIVE = false;
export const EARLY_ACCESS_LIVE = false;

/** Droits résolus d'une formule dans un marché (rivendy_offer_entitlements_resolved). */
export type Entitlements = Record<string, unknown>;

const num = (e: Entitlements, key: string): number => {
  const v = Number(e[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
};
const yes = (e: Entitlements, key: string): boolean => e[key] === true;
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** « 3 jours », « 1 jour ». */
export function daysLabel(days: number): string {
  return `${days} ${plural(days, "jour", "jours")}`;
}

export interface BenefitGroups {
  sell: string[];
  buy: string[];
  watch: string[];
}

/**
 * Avantages d'une formule, rangés par usage (formules simplifiées, lot 3,
 * 2026-11-17), d'après SES droits dans le marché — jamais supposés : un droit
 * à zéro ou faux n'est pas promis (à Djibouti, aucun avantage de livraison).
 */
export function benefitGroups(e: Entitlements, money: (amount: number) => string): BenefitGroups {
  const sell: string[] = [];
  if (yes(e, "certified_badge")) sell.push("Compte certifié : le badge sur votre boutique et vos articles");
  const boosts = num(e, "boosts_per_cycle");
  if (boosts > 0) sell.push(`${boosts} ${plural(boosts, "boost", "boosts")} de ${daysLabel(num(e, "boost_days") || 3)} par mois`);
  const story = num(e, "story_max_hours");
  if (story > 24) sell.push(`Stories de 24 h ou de ${story} h, au choix`);
  if (yes(e, "videos_unlimited")) {
    const seconds = num(e, "video_max_seconds");
    sell.push(seconds > 0 ? `Publications avec vidéo sans limite, vidéos de ${seconds} s` : "Publications avec vidéo sans limite");
  }
  if (yes(e, "store_cover_video")) sell.push("Bannière vidéo en haut de votre boutique");

  const buy: string[] = [];
  const credits = num(e, "delivery_credits_per_cycle");
  if (credits > 0) {
    buy.push(`${credits} ${plural(credits, "livraison offerte", "livraisons offertes")} par mois, quel que soit le montant`);
  }
  const full = num(e, "delivery_full_threshold");
  if (full > 0) buy.push(`Livraison offerte dès ${money(full)} d’articles`);
  if (buy.length) buy.push("Rivendy choisit tout seul la réduction la plus forte, sans case à cocher");

  const watch: string[] = [];
  if (yes(e, "play_premium")) watch.push("Tout Rivendy Play, sans publicité");
  if (yes(e, "music_premium")) watch.push("Toute la Musique Premium, sans publicité");
  if (yes(e, "play_premium")) watch.push("Les titres bloqués s’ouvrent sans les débloquer un par un");
  if (EXCLUSIVE_CONTENT_LIVE && yes(e, "exclusive_content")) watch.push("Contenus exclusifs");
  if (EARLY_ACCESS_LIVE && yes(e, "early_access")) watch.push("Avant-premières");
  const streams = num(e, "simultaneous_streams");
  if (streams >= 2) watch.push(`${streams} écrans en même temps`);
  watch.push("Sur le site et dans l’application, avec le même compte");
  return { sell, buy, watch };
}

/** Avantages à plat (ancienne présentation, gardée pour les listes courtes). */
export function offerBenefits(offer: Pick<PlusOffer, "entitlements">, money: (amount: number) => string = String): string[] {
  const g = benefitGroups(offer.entitlements ?? {}, money);
  return [...g.sell, ...g.buy, ...g.watch];
}

export interface CompareRow {
  label: string;
  free: string;
  plus: string;
}

function thresholdsLabel(e: Entitlements, money: (amount: number) => string): string {
  const parts: string[] = [];
  const half = num(e, "delivery_half_threshold");
  const pct = num(e, "delivery_half_percent");
  const full = num(e, "delivery_full_threshold");
  if (half > 0 && pct > 0) {
    parts.push(`${pct >= 100 ? "offerte" : pct === 50 ? "à moitié prix" : `payée à ${pct} % par Rivendy`} dès ${money(half)}`);
  }
  if (full > 0) parts.push(`offerte dès ${money(full)}`);
  return parts.length ? `Livraison ${parts.join(", ")}` : "—";
}

/**
 * Tableau « Gratuit ou Rivendy+ » : les deux formules du marché, lues sur le
 * serveur (la formule Gratuit se règle au dashboard comme Rivendy+). Les
 * lignes de livraison n'apparaissent que si le marché en a.
 */
export function compareRows(free: Entitlements, plus: Entitlements, money: (amount: number) => string): CompareRow[] {
  const yn = (e: Entitlements, key: string) => (yes(e, key) ? "Oui" : "—");
  const boosts = (e: Entitlements) => {
    const n = num(e, "boosts_per_cycle");
    return n > 0 ? `${n} par mois` : "Aucun";
  };
  const story = (e: Entitlements) => {
    const h = num(e, "story_max_hours") || 24;
    return h > 24 ? `24 h ou ${h} h` : `${h} h`;
  };
  const videos = (e: Entitlements) => {
    if (yes(e, "videos_unlimited")) return "Sans limite";
    const n = num(e, "videos_per_day");
    return n > 0 ? `${n} par jour` : "—";
  };
  const seconds = (e: Entitlements) => {
    const s = num(e, "video_max_seconds");
    return s > 0 ? `${s} s` : "—";
  };
  const boostDays = num(plus, "boost_days") || num(free, "boost_days") || 3;
  const rows: CompareRow[] = [
    { label: "Badge compte certifié", free: yn(free, "certified_badge"), plus: yn(plus, "certified_badge") },
    { label: `Boosts d’articles (${daysLabel(boostDays)})`, free: boosts(free), plus: boosts(plus) },
    { label: "Story d’un article", free: story(free), plus: story(plus) },
    { label: "Publications avec vidéo", free: videos(free), plus: videos(plus) },
    { label: "Durée d’une vidéo d’article", free: seconds(free), plus: seconds(plus) },
    { label: "Bannière vidéo de la boutique", free: yn(free, "store_cover_video"), plus: yn(plus, "store_cover_video") },
  ];
  const hasDelivery = [free, plus].some((e) =>
    num(e, "delivery_credits_per_cycle") > 0 || num(e, "delivery_half_threshold") > 0 || num(e, "delivery_full_threshold") > 0);
  if (hasDelivery) {
    const credits = (e: Entitlements) => {
      const n = num(e, "delivery_credits_per_cycle");
      return n > 0 ? `${n} par mois` : "—";
    };
    rows.push(
      { label: "Livraisons offertes", free: credits(free), plus: credits(plus) },
      { label: "Selon le montant de la commande", free: thresholdsLabel(free, money), plus: thresholdsLabel(plus, money) },
    );
  }
  rows.push(
    {
      label: "Rivendy Play",
      free: yes(free, "play_premium") ? "Tout le catalogue" : "Titres libres ; titres bloqués avec le Rivendy Pass",
      plus: yes(plus, "play_premium") ? "Tout le catalogue, sans publicité" : "Titres libres",
    },
    {
      label: "Rivendy Musique",
      free: yes(free, "music_premium") ? "Tout le Premium" : "Avec publicités",
      plus: yes(plus, "music_premium") ? "Tout le Premium, sans publicité" : "Avec publicités",
    },
  );
  return rows;
}

/** « 30 jours », « 24 heures », « 7 jours ». */
export function durationLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  if (hours < 48) return `${hours} heures`;
  const days = Math.round(hours / 24);
  return `${days} jours`;
}

/** Même règle que le serveur (declare_play_pass_payment). */
export function isValidPayerPhone(value: string): boolean {
  return /^\+?[0-9][0-9 .-]{4,30}$/.test(value.trim());
}

/** Même règle que le serveur : 4 à 80 caractères. */
export function isValidOperatorReference(value: string): boolean {
  const v = value.trim();
  return v.length >= 4 && v.length <= 80;
}

/** Message affichable pour un code d'erreur de `request_play_pass`. */
export function requestErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated":
      return "Votre session a expiré : reconnectez-vous puis réessayez.";
    case "not_available_in_this_app":
      return "La souscription se fait sur rivendy.com.";
    case "sale_closed":
    case "not_on_sale":
      return "Rivendy+ n’est pas encore disponible dans votre pays.";
    case "no_market":
      return "Votre compte n’a pas de pays enregistré : complétez votre profil puis réessayez.";
    case "channel_unavailable":
      return "Ce moyen de paiement n’est plus disponible. Choisissez-en un autre.";
    case "too_many_pending":
      return "Vous avez déjà 3 demandes en attente : réglez ou annulez-en une avant d’en créer une nouvelle.";
    case "unknown_plan":
      return "Cette formule n’existe plus. Rechargez la page.";
    default:
      return "Votre demande n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.";
  }
}

/** Message affichable pour un code d'erreur de `declare_play_pass_payment`. */
export function declareErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "bad_phone":
      return "Numéro de téléphone invalide.";
    case "bad_operator_reference":
      return "Indiquez la référence de la transaction reçue par SMS (4 caractères au moins).";
    case "operator_reference_used":
      return "Cette transaction a déjà servi pour une autre demande. Vérifiez la référence du SMS.";
    case "already_declared":
      return "Ce paiement est déjà déclaré : Rivendy le vérifie.";
    case "request_not_pending":
      return "Cette demande n’est plus en attente.";
    case "not_declarable":
      return "Cette demande se règle en agence.";
    case "proof_not_owned":
    case "proof_not_found":
      return "La capture n’a pas pu être jointe. Déclarez le paiement sans capture.";
    default:
      return "La déclaration n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.";
  }
}

export type PeriodStatus = "pending" | "active" | "expired" | "rejected" | "cancelled" | "refunded";

export interface MyPeriod {
  id: string;
  plan: string;
  status: PeriodStatus;
  price_paid: number;
  country_id: string;
  payment_method: string;
  payment_reference: string;
  payment_channel: string | null;
  declared_at: string | null;
  agency_id: string | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export type PeriodTone = "active" | "pending" | "todo" | "ended" | "refused";

/** Statut lisible d'une période ou d'une demande. */
export function periodStatus(p: MyPeriod, now: Date): { label: string; tone: PeriodTone } {
  switch (p.status) {
    case "pending":
      if (p.declared_at) return { label: "Paiement déclaré — en vérification", tone: "pending" };
      return p.payment_channel === "agency"
        ? { label: "À payer en agence", tone: "todo" }
        : { label: "À payer", tone: "todo" };
    case "active": {
      const end = p.expires_at ? new Date(p.expires_at) : null;
      if (end && end > now) {
        const start = p.starts_at ? new Date(p.starts_at) : null;
        return start && start > now
          ? { label: "Payé — commence à la fin de la période en cours", tone: "active" }
          : { label: "Actif", tone: "active" };
      }
      return { label: "Terminé", tone: "ended" };
    }
    case "expired":
      return { label: "Terminé", tone: "ended" };
    case "rejected":
      return { label: "Non validé", tone: "refused" };
    case "refunded":
      return { label: "Remboursé", tone: "ended" };
    default:
      return { label: "Annulé", tone: "ended" };
  }
}

/** Date limite de paiement d'une demande (validité côté serveur : 7 jours). */
export function requestValidUntil(createdAt: string, days = 7): Date {
  return new Date(new Date(createdAt).getTime() + days * 24 * 3600 * 1000);
}

/**
 * Motifs de refus, par demande : lus dans les notifications `play_pass`
 * (`metadata.step = 'rejected'`). Le texte de la notification reste NEUTRE
 * (il s'affiche aussi dans l'app) ; le motif ne se lit qu'ici.
 */
export function rejectReasons(notifications: Array<{ metadata?: unknown }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of notifications) {
    const m = n.metadata;
    if (!m || typeof m !== "object") continue;
    // Rivendy+ (play_pass_id) ou Rivendy Pass (play_unlock_id, lot 3).
    const { step, play_pass_id: passId, play_unlock_id: unlockId, reason } = m as Record<string, unknown>;
    const id = typeof passId === "string" ? passId : typeof unlockId === "string" ? unlockId : null;
    if (step !== "rejected" || !id || typeof reason !== "string") continue;
    const text = reason.trim();
    if (text && !(id in out)) out[id] = text;
  }
  return out;
}
