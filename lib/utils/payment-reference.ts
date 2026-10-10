/**
 * Référence courte d'une demande payée (boost) — ex. `BST-K7QM4T`.
 * Miroir de `rivendy_app/lib/core/utils/payment_reference.dart`.
 *
 * Jusqu'au 2026-10-10 : `BOOST-<identifiant complet de l'article>-<PALIER>`,
 * une cinquantaine de caractères impossibles à recopier dans le motif d'un
 * transfert Mobile Money, et identiques pour deux boosts du même article au
 * même palier. Alphabet sans O/0 ni I/1/L, comme les références de commande.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePaymentReference(prefix = "BST"): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${suffix}`;
}
