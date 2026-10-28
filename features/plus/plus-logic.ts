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

/** Les crédits livraison n'existent qu'au lot F : jamais promis avant. */
export const DELIVERY_CREDITS_LIVE = false;

/** Avantages affichés pour une formule, d'après SES droits (jamais supposés). */
export function offerBenefits(offer: Pick<PlusOffer, "entitlements">): string[] {
  const e = offer.entitlements ?? {};
  const out: string[] = [];
  if (e.play_premium === true) out.push("Films et séries Premium sur Rivendy Play");
  if (e.music_premium === true) out.push("Musique Premium en écoute complète");
  if (e.exclusive_content === true) out.push("Contenus exclusifs");
  if (e.early_access === true) out.push("Avant-premières");
  const streams = Number(e.simultaneous_streams ?? 0);
  if (streams >= 2) out.push(`${streams} écrans en même temps`);
  if (DELIVERY_CREDITS_LIVE) {
    const credits = Number(e.delivery_credits_per_cycle ?? 0);
    if (credits > 0) out.push(`${credits} livraisons offertes par cycle`);
  }
  out.push("Sur le site et dans l’application, avec le même compte");
  return out;
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
    const { step, play_pass_id: id, reason } = m as Record<string, unknown>;
    if (step !== "rejected" || typeof id !== "string" || typeof reason !== "string") continue;
    const text = reason.trim();
    if (text && !(id in out)) out[id] = text;
  }
  return out;
}
