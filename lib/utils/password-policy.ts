/**
 * 🔐 Politique de mot de passe — MIROIR EXACT de
 * `rivendy_app/lib/core/utils/password_policy.dart` (source de vérité, verrouillée
 * par un test) et des règles bloquantes de l'Edge Function `password-reset`.
 *
 * Avant le 2026-10-04 le site acceptait 6 caractères à l'inscription, sans
 * confirmation : un compte créé sur le web vivait sous la règle que l'app et
 * le serveur imposent ensuite (8 caractères, ni le numéro ni le nom).
 *
 * ⚠️ AUCUN trim() : les espaces font partie du mot de passe.
 * ⚠️ Modifier une règle = modifier les TROIS fichiers ensemble.
 */

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

const BANNED_PASSWORDS = new Set([
  "password", "motdepasse", "passe", "azerty", "qwerty", "qwertyuiop",
  "azertyuiop", "12345678", "123456789", "1234567890", "00000000",
  "11111111", "iloveyou", "bonjour", "welcome", "rivendy", "admin123",
  "abcdefgh", "letmein", "sunshine", "football", "princess", "dragon",
]);

const digitsOnly = (s: string) => s.replace(/[^0-9]/g, "");
const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-zà-öø-ÿ]/g, "");

function isSequential(s: string): boolean {
  if (s.length < 4) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < s.length; i++) {
    const delta = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (delta !== 1) up = false;
    if (delta !== -1) down = false;
  }
  return up || down;
}

/** `null` si acceptable, sinon le message à afficher (en français). */
export function validatePassword(
  password: string,
  { phone, fullName }: { phone?: string | null; fullName?: string | null } = {},
): string | null {
  if (!password) return "Entrez un mot de passe";
  if (password.length < MIN_PASSWORD_LENGTH) return `Minimum ${MIN_PASSWORD_LENGTH} caractères`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Mot de passe trop long (maximum ${MAX_PASSWORD_BYTES} octets)`;
  }
  const lower = password.toLowerCase();
  if (BANNED_PASSWORDS.has(lower)) return "Ce mot de passe est trop courant. Choisissez-en un autre.";
  if (new Set(password.split("")).size === 1) return "Évitez de répéter le même caractère";
  if (isSequential(lower)) return "Évitez les suites comme 12345678 ou abcdefgh";

  // Le numéro EST l'identifiant de connexion, et il est public sur la boutique.
  const phoneDigits = digitsOnly(phone ?? "");
  const pwdDigits = digitsOnly(password);
  if (phoneDigits.length >= 6 && pwdDigits.length >= 6) {
    const tail = phoneDigits.slice(-6);
    if (pwdDigits.includes(phoneDigits) || phoneDigits.includes(pwdDigits) || pwdDigits.includes(tail)) {
      return "N'utilisez pas votre numéro comme mot de passe";
    }
  }

  const name = lettersOnly(fullName ?? "");
  if (name.length >= 4 && lettersOnly(password).includes(name)) {
    return "N'utilisez pas votre nom comme mot de passe";
  }
  return null;
}

export type PasswordCriterion = { label: string; met: boolean };

/** Critères affichés pendant la saisie — seul le premier est bloquant. */
export function passwordCriteria(password: string): PasswordCriterion[] {
  return [
    { label: `Au moins ${MIN_PASSWORD_LENGTH} caractères`, met: password.length >= MIN_PASSWORD_LENGTH },
    { label: "Une majuscule", met: /[A-Z]/.test(password) },
    { label: "Un chiffre", met: /[0-9]/.test(password) },
    { label: "Un caractère spécial", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export type PasswordStrength = "vide" | "faible" | "moyen" | "bon" | "excellent";

export const PASSWORD_STRENGTH_LABEL: Record<PasswordStrength, string> = {
  vide: "",
  faible: "Faible",
  moyen: "Moyen",
  bon: "Bon",
  excellent: "Excellent",
};

/** Robustesse indicative, plafonnée à « Faible » si la politique refuse. */
export function passwordStrength(
  password: string,
  identity: { phone?: string | null; fullName?: string | null } = {},
): PasswordStrength {
  if (!password) return "vide";
  if (validatePassword(password, identity) != null) return "faible";
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return "faible";
  if (score === 2) return "moyen";
  if (score === 3) return "bon";
  return "excellent";
}
