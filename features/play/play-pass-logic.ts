/**
 * Rivendy Play — Pass Premium : règles PURES de la page /play/premium
 * (lot 6, 2026-10-12). Sans import : testées sous Node par
 * `node --test features/play/play-pass-logic.test.mjs` (npm run check:play).
 *
 * Contrat serveur (dépôt dashboard, migrations 20261012_play_2 et _3) :
 *  - `play_pass_prices` (country_id, plan, price, is_on_sale) ;
 *  - `request_play_pass(p_plan, p_payment_method, p_payment_reference,
 *    p_proof_path)` : le PRIX et le MARCHÉ viennent de la base (marché
 *    d'origine du compte), jamais du navigateur ;
 *  - référence `^RVP-[A-Z0-9]{6}$`, unique.
 */

export type PassPlan = "day" | "week" | "month";

export interface PassPlanInfo {
  id: PassPlan;
  name: string;
  hint: string;
  hours: number;
}

/** Ordre d'affichage (maquette 4 validée le 2026-10-11). */
export const PASS_PLANS: PassPlanInfo[] = [
  { id: "day", name: "Pass 24 h", hint: "Idéal pour un film", hours: 24 },
  { id: "week", name: "Pass 7 jours", hint: "Le temps d’une série", hours: 168 },
  { id: "month", name: "Pass 30 jours", hint: "Films et séries pendant un mois", hours: 720 },
];

export interface PassPrice {
  plan: PassPlan;
  price: number;
  is_on_sale: boolean;
}

export function planInfo(plan: string): PassPlanInfo | undefined {
  return PASS_PLANS.find((p) => p.id === plan);
}

/** Tarifs en vente, dans l'ordre d'affichage. */
export function plansOnSale(prices: PassPrice[]): Array<PassPlanInfo & { price: number }> {
  return PASS_PLANS.flatMap((info) => {
    const row = prices.find((p) => p.plan === info.id && p.is_on_sale && Number(p.price) > 0);
    return row ? [{ ...info, price: Number(row.price) }] : [];
  });
}

/**
 * Formule au meilleur prix PAR JOUR parmi celles en vente — calculé, jamais
 * supposé : les tarifs se changent au dashboard. null s'il n'y a pas de
 * vainqueur strict (moins de deux formules, ou égalité).
 */
export function cheapestPerDayPlan(prices: PassPrice[]): PassPlan | null {
  const sale = plansOnSale(prices);
  if (sale.length < 2) return null;
  const perDay = sale.map((p) => ({ id: p.id, v: p.price / (p.hours / 24) }));
  perDay.sort((a, b) => a.v - b.v);
  return perDay[0].v < perDay[1].v ? perDay[0].id : null;
}

/**
 * La vente est ouverte si le marché a un tarif en vente ET un moyen de
 * paiement électronique activé (spec §3.2) — les espèces seules ne suffisent
 * pas : elles existent dans les 16 marchés.
 */
export function isPassSaleOpen(prices: PassPrice[], hasEnabledMobileMoney: boolean): boolean {
  return hasEnabledMobileMoney && plansOnSale(prices).length > 0;
}

/** Alphabet sans 0/O ni 1/I : la référence se dicte et se recopie sans erreur. */
export const PASS_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PASS_REFERENCE_PATTERN = /^RVP-[A-Z0-9]{6}$/;

/**
 * Référence « RVP-XXXXXX ». [randomBytes] est injectable pour les tests ; par
 * défaut `crypto.getRandomValues`. 32 symboles : un octet modulo 32 reste
 * uniforme (256 = 8 × 32).
 */
export function generatePassReference(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += PASS_REFERENCE_ALPHABET[bytes[i] % PASS_REFERENCE_ALPHABET.length];
  }
  return `RVP-${out}`;
}

/** Message affichable pour un code d'erreur de `request_play_pass`. */
export function passRequestMessage(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated":
      return "Votre session a expiré : reconnectez-vous puis réessayez.";
    case "not_on_sale":
      return "Le Pass Premium n’est pas encore disponible dans votre pays.";
    case "no_market":
      return "Votre compte n’a pas de pays enregistré : complétez votre profil puis réessayez.";
    case "too_many_pending":
      return "Vous avez déjà 3 demandes en attente : l’équipe Rivendy les vérifie avant d’en accepter une nouvelle.";
    case "proof_not_owned":
    case "proof_not_found":
      return "La capture du paiement n’a pas pu être jointe. Envoyez la demande sans capture, puis ajoutez-la dans « Mes pass ».";
    case "reference_taken":
      return "Cette référence vient d’être utilisée : une nouvelle référence a été créée. Vérifiez le motif de votre paiement puis renvoyez la demande.";
    case "unknown_plan":
    case "bad_reference":
    case "bad_method":
      return "La demande est incomplète. Rechargez la page puis réessayez.";
    default:
      return "Votre demande n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.";
  }
}

export type PassStatus = "pending" | "active" | "expired" | "rejected" | "cancelled";

export interface MyPass {
  id: string;
  plan: string;
  status: PassStatus;
  price_paid: number;
  country_id: string;
  payment_method: string;
  payment_reference: string;
  payment_proof_path: string | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/** Échéance du droit de regarder : la plus lointaine des passes actifs non échus. */
export function accessUntil(passes: MyPass[], now: Date): Date | null {
  let best: Date | null = null;
  for (const p of passes) {
    if (p.status !== "active" || !p.expires_at) continue;
    const end = new Date(p.expires_at);
    if (Number.isNaN(end.getTime()) || end <= now) continue;
    if (!best || end > best) best = end;
  }
  return best;
}

export type PassTone = "active" | "pending" | "ended" | "refused";

/**
 * Statut lisible. Un pass « active » dont l'échéance est passée (la tâche
 * d'expiration tourne toutes les 15 min) s'affiche déjà « Terminé ».
 */
export function passStatus(p: MyPass, now: Date): { label: string; tone: PassTone } {
  switch (p.status) {
    case "pending":
      return { label: "En attente de vérification", tone: "pending" };
    case "active": {
      const end = p.expires_at ? new Date(p.expires_at) : null;
      if (end && end > now) {
        const start = p.starts_at ? new Date(p.starts_at) : null;
        return start && start > now
          ? { label: "Validé — commence à la fin du pass en cours", tone: "active" }
          : { label: "Actif", tone: "active" };
      }
      return { label: "Terminé", tone: "ended" };
    }
    case "expired":
      return { label: "Terminé", tone: "ended" };
    case "rejected":
      return { label: "Non validé — le motif est dans vos notifications", tone: "refused" };
    default:
      return { label: "Annulé", tone: "ended" };
  }
}
