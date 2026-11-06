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
    case "foreign_market":
      // 2026-10-03 : la base refuse les produits d'un autre marché que celui
      // de création du compte (20261003_orders_home_market_only.sql).
      return "Votre commande contient des articles d'un autre pays que celui de votre compte : Rivendy ne prend pas encore ces commandes. Retirez-les du panier, ou passez par « Sur commande » pour acheter des produits d'un autre pays.";
    // Audit 19 (MK19-2) : refus de l'audit 17, affichés jusqu'ici en code.
    case "mixed_sellers":
    case "seller_mismatch":
      return "Votre panier a changé depuis son ouverture (un article a changé de boutique). Rechargez la page, vérifiez votre panier puis réessayez.";
    case "mixed_markets":
      return "Votre commande mélange des articles de deux pays. Passez une commande par pays.";
    // Audit 20, lot 1 (20261022_0900_audit20_commande.sql) : mêmes textes que l'app.
    case "invalid_buyer_phone":
      return "Numéro de téléphone invalide : Rivendy doit pouvoir vous joindre. Vérifiez-le (7 à 15 chiffres) puis réessayez.";
    case "neighborhood_locality_mismatch":
    case "delivery_zone_market_mismatch":
      return "Adresse de livraison invalide — reprenez la sélection de votre localité et de votre quartier puis réessayez.";
    case "missing_price_snapshot":
    case "invalid_price_snapshot":
      return productTitle
        ? `Le prix de « ${productTitle} » doit être revu par Rivendy avant la vente. Retirez-le du panier ou réessayez plus tard.`
        : "Le prix d'un article doit être revu par Rivendy avant la vente. Retirez-le du panier ou réessayez plus tard.";
    // Audit 21 (20261026_0900_audit21_lot2_frais_dj.sql) : pas encore dans l'app.
    case "unknown_delivery_zone":
      return "Zone de livraison inconnue — reprenez la sélection de votre zone puis réessayez.";
    case "too_many_open_orders":
      return "Vous avez déjà beaucoup de commandes en attente de prise en charge. Attendez que Rivendy les traite, puis réessayez.";
  }

  const suffix = code ? ` (code : ${code.slice(0, 80)})` : "";
  return `Impossible d'enregistrer votre commande. Réessayez dans un instant.${suffix}`;
}
