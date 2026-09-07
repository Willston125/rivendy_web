/**
 * SOURCE UNIQUE de la couverture de boutique.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 * Il a existé DEUX couvertures pour une seule boutique :
 *   • `store_banner_url`      — écrite par l'application Flutter
 *                               (lib/features/store/services/seller_profile_service.dart)
 *   • `store_banner_url_web`  — écrite par l'éditeur du site
 *                               (features/store/store-image-editor.tsx), qui
 *                               ne touchait volontairement jamais la première.
 *
 * Le site lisait `_web` EN PREMIER. Conséquence constatée le 2026-09-07 :
 * dès qu'une couverture avait été choisie une fois depuis le site, toutes les
 * couvertures posées ensuite depuis l'application devenaient invisibles sur le
 * site — définitivement. Le propriétaire voyait « une ancienne photo » sans
 * qu'aucun cache soit en cause (la route /store/[sellerId] est bien rendue à
 * la demande, vérifié au build : ƒ Dynamic).
 *
 * ── La règle désormais ────────────────────────────────────────────────────
 * L'APPLICATION FAIT FOI : `store_banner_url` d'abord, `store_banner_url_web`
 * seulement en repli pour les boutiques qui n'ont jamais posé de couverture
 * depuis l'app. Et l'éditeur du site écrit les DEUX colonnes, pour qu'elles
 * cessent de diverger.
 *
 * Ne pas réintroduire l'ordre inverse, et ne pas recopier ce `||` dans un
 * écran : toute page qui affiche une couverture importe `storeBannerOf`.
 */

/** Forme minimale acceptée : une ligne `profiles` partielle. */
export type BannerSource = {
  store_banner_url?: string | null;
  store_banner_url_web?: string | null;
};

/** Couverture à afficher, ou `""` si la boutique n'en a aucune. */
export function storeBannerOf(row: BannerSource | null | undefined): string {
  if (!row) return "";
  return (
    String(row.store_banner_url ?? "").trim() ||
    String(row.store_banner_url_web ?? "").trim()
  );
}
