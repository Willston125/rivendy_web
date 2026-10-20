/**
 * Traduction des erreurs Supabase Auth — miroir de
 * `rivendy_app/lib/core/utils/auth_errors.dart`. Avant le 2026-10-04 le site
 * affichait le message brut, en anglais (« Invalid login credentials »).
 */

function commonError(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Pas de connexion internet. Vérifiez votre réseau.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  return null;
}

export function friendlyLoginError(raw: string): string {
  const common = commonError(raw);
  if (common) return common;
  if (raw.includes("Invalid login credentials") || raw.includes("invalid_credentials")) {
    // Audit 19 (RG19-1) : avant la 1.4.8 de l'app, changer de numéro dans les
    // Réglages ne changeait pas le numéro de connexion.
    return "Numéro ou mot de passe incorrect. Si vous aviez changé de numéro dans l’application, essayez aussi votre ancien numéro.";
  }
  if (raw.includes("Email not confirmed")) {
    return "Compte non confirmé. Contactez le support Rivendy.";
  }
  return "Connexion impossible. Vérifiez vos informations.";
}

export function friendlySignupError(raw: string): string {
  const common = commonError(raw);
  if (common) return common;
  if (raw.includes("User already registered") || raw.includes("already been registered") || raw.includes("already exists")) {
    return "Ce numéro WhatsApp est déjà utilisé. Connectez-vous !";
  }
  if (raw.includes("Password should be at least")) {
    return "Le mot de passe est trop court.";
  }
  return "Inscription impossible. Vérifiez vos informations.";
}
