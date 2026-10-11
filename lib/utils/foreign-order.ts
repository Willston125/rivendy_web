// ══════════════════════════════════════════════════════════════════
//  🌍 Commande depuis l'étranger (2026-10-11) — étape 1
//
//  Un acheteur ne commande pas directement hors du marché de création de son
//  compte (règle du 2026-10-03, secure_create_order → 'foreign_market'). La
//  fenêtre le renvoyait vers « Sur commande » de son pays, où l'article qu'il
//  regardait ne figure pas : un cul-de-sac. Désormais, sur UN article
//  étranger, il envoie une DEMANDE à Rivendy (dashboard « Demandes d'aide »,
//  sujet 'order', vendeur rattaché) ; Rivendy lui répond dans ses
//  notifications avec le prix final dans sa monnaie, livraison internationale
//  comprise, et le délai. Rien n'est payé à ce stade.
//
//  MIROIR EXACT de rivendy_app/lib/features/checkout/logic/foreign_order_request.dart :
//  le dashboard reconnaît la demande à sa première ligne (FOREIGN_ORDER_MARKER).
// ══════════════════════════════════════════════════════════════════

export const FOREIGN_ORDER_MARKER = "🌍 Commande depuis l'étranger";

/** Adresse publique de l'article, avec son marché (lue par Rivendy). */
export function foreignOrderProductUrl(productId: string, marketId: string): string {
  return `https://www.rivendy.com/products/${productId}?country=${marketId}`;
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Texte de la demande (10 à 2 000 caractères exigés par la base). */
export function foreignOrderMessage({
  productId,
  productTitle,
  productMarketId,
  productMarketName,
  unitPriceText,
  quantity,
  homeMarketName,
  note,
}: {
  productId: string;
  productTitle: string;
  productMarketId: string;
  productMarketName: string;
  unitPriceText: string;
  quantity: number;
  homeMarketName: string;
  note?: string | null;
}): string {
  const ref = productId.split("-")[0].toUpperCase();
  const cleanNote = clip(note ?? "", 1000);
  return [
    FOREIGN_ORDER_MARKER,
    `Article : ${clip(productTitle, 120)} (réf. #${ref})`,
    `Vendu au marché : ${productMarketName} — ${unitPriceText} l'unité`,
    `Quantité souhaitée : ${quantity < 1 ? 1 : quantity}`,
    `À livrer : ${homeMarketName}`,
    `Lien : ${foreignOrderProductUrl(productId, productMarketId)}`,
    `Précisions : ${cleanNote === "" ? "—" : cleanNote}`,
  ].join("\n");
}
