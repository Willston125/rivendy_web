/**
 * Motif de refus d'une annonce, dit pour le vendeur.
 *
 * Le dashboard enregistre un CODE (`photos_insuffisantes`…, liste de
 * `rivendy_dashboard/app/dashboard/products/pending/page.tsx`) ou, pour
 * « Autre », un texte libre. L'espace vendeur affichait le code brut :
 * « Motif : photos_insuffisantes ». Un texte libre est rendu tel quel.
 */
const REJECT_REASON_LABELS: Record<string, string> = {
  photos_insuffisantes: "photos insuffisantes ou floues",
  prix_anormal: "prix anormal (trop élevé ou trop bas)",
  description_incomplete: "description incomplète",
  produit_interdit: "produit non autorisé sur Rivendy",
  contenu_inapproprie: "contenu inapproprié",
  doublon: "doublon d'une annonce existante",
  autre: "autre motif",
};

export function rejectReasonLabel(reason: string | null | undefined): string {
  const value = reason?.trim();
  if (!value) return "non précisé";
  return REJECT_REASON_LABELS[value] ?? value;
}
