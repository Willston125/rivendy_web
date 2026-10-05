/**
 * Validation du numéro WhatsApp — MIROIR EXACT de
 * `rivendy_app/lib/core/utils/phone_validator.dart`.
 *
 * Règle Rivendy : le MARCHÉ ≠ le PAYS DU NUMÉRO. Un numéro saisi avec son
 * indicatif (+33, +269…) est accepté quel que soit le marché ; un numéro
 * local est validé selon la longueur du marché choisi.
 */

type PhoneRule = { dialDigits: string; localLengths: number[]; hint: string; countryName: string };

const RULES: Record<string, PhoneRule> = {
  BF: { dialDigits: "226", localLengths: [8], hint: "+226 70 12 34 56", countryName: "Burkina Faso" },
  CM: { dialDigits: "237", localLengths: [9], hint: "+237 6 12 34 56 78", countryName: "Cameroun" },
  KM: { dialDigits: "269", localLengths: [7], hint: "+269 321 45 67", countryName: "Comores" },
  CI: { dialDigits: "225", localLengths: [10], hint: "+225 07 12 34 56 78", countryName: "Côte d'Ivoire" },
  DJ: { dialDigits: "253", localLengths: [8], hint: "+253 77 12 34 56", countryName: "Djibouti" },
  ET: { dialDigits: "251", localLengths: [9], hint: "+251 91 123 4567", countryName: "Éthiopie" },
  FR: { dialDigits: "33", localLengths: [9, 10], hint: "+33 6 12 34 56 78", countryName: "France" },
  KE: { dialDigits: "254", localLengths: [9], hint: "+254 712 345 678", countryName: "Kenya" },
  MG: { dialDigits: "261", localLengths: [9], hint: "+261 32 12 345 67", countryName: "Madagascar" },
  ML: { dialDigits: "223", localLengths: [8], hint: "+223 70 12 34 56", countryName: "Mali" },
  MR: { dialDigits: "222", localLengths: [8], hint: "+222 22 12 34 56", countryName: "Mauritanie" },
  YT: { dialDigits: "262", localLengths: [9], hint: "+262 639 12 34 56", countryName: "Mayotte" },
  RE: { dialDigits: "262", localLengths: [9], hint: "+262 692 12 34 56", countryName: "Réunion" },
  SN: { dialDigits: "221", localLengths: [9], hint: "+221 70 123 45 67", countryName: "Sénégal" },
  SO: { dialDigits: "252", localLengths: [7, 8], hint: "+252 61 234 567", countryName: "Somalie" },
  TZ: { dialDigits: "255", localLengths: [9], hint: "+255 712 345 678", countryName: "Tanzanie" },
};

function validateLocal(rule: PhoneRule, digits: string): string | null {
  if (rule.localLengths.includes(digits.length)) return null;
  if (digits.startsWith(rule.dialDigits)) {
    const local = digits.slice(rule.dialDigits.length);
    if (rule.localLengths.includes(local.length)) return null;
    if (rule.dialDigits === "33" && local.length === 10 && local.startsWith("0")) return null;
  }
  const examples = rule.localLengths.map((l) => `${l} chiffres`).join(" ou ");
  return `Format ${rule.countryName} : ${examples} locaux — ou saisissez +${rule.dialDigits}XX…`;
}

/** `null` si valide, sinon le message à afficher. */
export function validatePhone(value: string | null | undefined, countryId: string | null | undefined): string | null {
  if (!countryId) return "Choisissez votre marché avant de saisir votre numéro";
  const raw = (value ?? "").trim();
  if (!raw) return "Le numéro WhatsApp est obligatoire";
  if (raw.replace(/[\d\s+\-()]/g, "").length > 0) return "Numéro invalide — caractères non autorisés";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "Numéro trop court (minimum 7 chiffres)";
  if (digits.length > 15) return "Numéro trop long (maximum 15 chiffres)";
  if (raw.startsWith("+")) return null;
  if (digits.startsWith("00") && digits.length >= 9) return null;
  const rule = RULES[countryId];
  if (!rule) return null;
  return validateLocal(rule, digits);
}

/** Placeholder de saisie selon le marché. */
export function phoneHint(countryId: string | null | undefined): string {
  return (countryId && RULES[countryId]?.hint) || "+XXX XX XX XX XX";
}

/**
 * Pays du NUMÉRO (+XX…) → `profiles.phone_country_code`. `null` si le numéro
 * n'a pas d'indicatif ou si l'indicatif est ambigu (+262 = Mayotte ou Réunion).
 */
export function detectPhoneCountryId(phone: string): string | null {
  const raw = phone.trim();
  if (!raw.startsWith("+")) return null;
  const digits = raw.replace(/\D/g, "");
  const sorted = Object.entries(RULES).sort((a, b) => b[1].dialDigits.length - a[1].dialDigits.length);
  let matched: string | null = null;
  for (const [code, rule] of sorted) {
    if (digits.startsWith(rule.dialDigits)) {
      if (matched == null) matched = code;
      else return null;
    }
  }
  return matched;
}
