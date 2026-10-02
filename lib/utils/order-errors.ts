/**
 * Traduction des échecs de `secure_create_order` en messages actionnables.
 *
 * Miroir de l'app (`rivendy_app/lib/features/checkout/widgets/order_error_helper.dart`) :
 * les deux clients doivent dire la même chose pour la même cause. Avant le
 * 2026-10-02, le site affichait le code brut renvoyé par la RPC — un client
 * qui perdait la course au dernier article en stock lisait
 * « product_not_available ».
 *
 * Un code inconnu garde un message générique, avec le code en suffixe pour
 * le support.
 */
export function orderFailureMessage(raw: string | null | undefined, productTitle?: string): string {
  const code = (raw ?? "").trim();
  const low = code.toLowerCase();

  // Exceptions transport / authentification (chaînes techniques du SDK).
  if (
    low.includes("permission denied") ||
    low.includes("jwt") ||
    low.includes("401") ||
    low.includes("403") ||
    low.includes("not_authenticated")
  ) {
    return "Votre session a expiré. Reconnectez-vous puis réessayez — votre panier est conservé.";
  }
  if (
    low.includes("failed to fetch") ||
    low.includes("networkerror") ||
    low.includes("timed out") ||
    low.includes("timeout")
  ) {
    return "Connexion internet instable. Vérifiez votre réseau puis réessayez.";
  }

  // Codes métier renvoyés par la RPC.
  switch (code) {
    case "product_not_available":
      // Deux acheteurs sur le dernier article : la RPC verrouille la ligne
      // (FOR UPDATE), le premier l'obtient, le second arrive ici.
      return productTitle
        ? `« ${productTitle} » n'est plus disponible ou est en rupture de stock. Retirez-le du panier puis réessayez.`
        : "Un article de votre panier n'est plus disponible ou est en rupture de stock. Retirez-le puis réessayez.";
    case "invalid_quantity":
      return "Quantité invalide sur un article — ajustez votre panier puis réessayez.";
    case "duplicate_order_id":
      return "Cette commande a peut-être déjà été envoyée. Vérifiez « Mes commandes » avant de réessayer.";
    case "incomplete_delivery_address":
      return "Adresse de livraison incomplète — reprenez la sélection de votre zone puis réessayez.";
    case "locality_region_mismatch":
      return "Adresse de livraison invalide — resélectionnez votre localité puis réessayez.";
    case "empty_items":
      return "Votre panier est vide.";
  }

  const suffix = code ? ` (code : ${code.slice(0, 80)})` : "";
  return `Impossible d'enregistrer votre commande. Réessayez dans un instant.${suffix}`;
}
