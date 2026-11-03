// Un portefeuille, un solde PAR MARCHÉ (audit des paramètres, D-05, décision
// du propriétaire du 2026-11-03). Chaque ligne `wallets` porte un marché et la
// devise de ce marché : une vente crédite la ligne du marché de la commande,
// un retrait se paie depuis le compte Rivendy de ce marché, dans sa monnaie.
// On n'additionne JAMAIS deux lignes. Calcul seul, sans React ni Supabase :
// testé par wallet-markets.test.mjs. Miroir de l'app
// (lib/features/checkout/services/wallet_markets.dart).
//
// Aucune importation (comme les autres modules testés par node --test) : le
// validateur de numéros est passé en paramètre.

/** Les deux fonctions de lib/utils/phone-validator.ts dont on a besoin. */
export type PhoneRules = {
  phoneHint: (countryId: string | null | undefined) => string;
  validatePhone: (value: string | null | undefined, countryId: string | null | undefined) => string | null;
};

export type WalletLine = { id: string; country_id: string | null; currency: string | null; balance: number };

/** Demandes de retrait encore en cours (mêmes statuts que l'app et le serveur). */
export const PENDING_PAYOUT_STATUSES = ["pending_director", "approved_director", "pending_ceo", "approved_ceo"];

/** Types de mouvement qui AJOUTENT au solde. Tous les montants sont positifs
 *  en base (CHECK) : c'est le type qui donne le signe — un retrait affiché en
 *  vert avec « + » venait de là. */
const CREDIT_TYPES = new Set(["credit", "order_credit", "refund_credit", "refund", "bonus"]);

export function isCreditType(type: string): boolean {
  return CREDIT_TYPES.has(type);
}

/** Lignes lues de `wallets`, montants en nombre. */
export function toWalletLines(rows: Array<Record<string, unknown>> | null | undefined): WalletLine[] {
  return (rows ?? []).map((r) => ({
    id: String(r.id ?? ""),
    country_id: typeof r.country_id === "string" ? r.country_id : null,
    currency: typeof r.currency === "string" ? r.currency : null,
    balance: Number(r.balance ?? 0),
  }));
}

/**
 * Ligne principale (carte en dégradé) et autres marchés. La principale est
 * celle du pays du compte ; à défaut, la première. Les autres sont triées par
 * nom de marché.
 */
export function splitWalletLines(
  lines: WalletLine[],
  homeCountryId: string | null | undefined,
  nameOf: (countryId: string) => string,
): { main: WalletLine | null; others: WalletLine[] } {
  const byName = [...lines].sort((a, b) =>
    nameOf(a.country_id ?? "").localeCompare(nameOf(b.country_id ?? ""), "fr"));
  const main = byName.find((l) => l.country_id === homeCountryId) ?? byName[0] ?? null;
  return { main, others: byName.filter((l) => l !== main) };
}

/** Retraits en cours, par marché. */
export function pendingByMarket(rows: Array<{ amount?: unknown; country_id?: unknown }> | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows ?? []) {
    const key = typeof r.country_id === "string" ? r.country_id : "";
    out.set(key, (out.get(key) ?? 0) + Number(r.amount ?? 0));
  }
  return out;
}

/** Disponible sur une ligne = son solde moins les retraits en cours DE CE marché. */
export function availableFor(line: WalletLine, pending: Map<string, number>): number {
  return Math.max(0, line.balance - (pending.get(line.country_id ?? "") ?? 0));
}

export type WithdrawalProblem = "amount_invalid" | "below_minimum" | "exceeds_available";

/** Contrôle d'un montant avant l'envoi (le serveur refait les mêmes contrôles). */
export function withdrawalProblem(amount: number, available: number, min: number): WithdrawalProblem | null {
  if (!Number.isFinite(amount) || amount <= 0) return "amount_invalid";
  if (amount < min) return "below_minimum";
  if (amount > available) return "exceeds_available";
  return null;
}

/** Indicatif du marché (« +253 »), tiré de l'exemple de saisie du validateur. */
export function dialCode(countryId: string | null | undefined, rules: PhoneRules): string | null {
  const head = rules.phoneHint(countryId).split(" ")[0];
  return /^\+\d+$/.test(head) ? head : null;
}

/**
 * Numéro Mobile Money complet, OBLIGATOIREMENT du pays du marché : Rivendy
 * paie depuis son compte de ce pays. Rend { phone } ou { error }.
 */
export function marketPhone(
  input: string,
  countryId: string,
  countryName: string,
  rules: PhoneRules,
): { phone: string } | { error: string } {
  const dial = dialCode(countryId, rules);
  const raw = input.trim();
  if (!raw) return { error: `Indiquez le numéro Mobile Money (${countryName}).` };
  let local = raw.replace(/[\s\-()]/g, "");
  if (local.startsWith("00")) local = `+${local.slice(2)}`;
  if (local.startsWith("+")) {
    if (!dial || !local.startsWith(dial)) {
      return { error: dial ? `Un numéro ${dial} (${countryName}) est attendu.` : `Un numéro de ${countryName} est attendu.` };
    }
    local = local.slice(dial.length);
  }
  const problem = rules.validatePhone(local, countryId);
  if (problem) return { error: problem };
  return { phone: `${dial ?? ""}${local.replace(/\D/g, "")}` };
}

/** Note jointe à la demande : c'est ce que le dashboard affiche à l'équipe. */
export function payoutNotes(p: {
  method: "mobile_money" | "cash";
  operator?: string | null;
  agency?: string | null;
  beneficiary: string;
  channel: string;
}): string {
  const who = p.beneficiary.trim().slice(0, 80);
  const head = p.method === "cash"
    ? `Agence : ${(p.agency ?? "").trim() || "Rivendy"} · Retrait par : ${who}`
    : `Opérateur : ${(p.operator ?? "").trim() || "Mobile Money"} · Bénéficiaire : ${who}`;
  return `${head} · ${p.channel}`.slice(0, 300);
}
