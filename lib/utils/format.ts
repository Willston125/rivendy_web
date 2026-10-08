import { CATEGORIES, type Country, type Product } from "@/types/rivendy";

export function categoryLabel(category: string) {
  return CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function formatMoney(value: number | null | undefined, country?: Pick<Country, "currency_symbol" | "currency_code"> | null) {
  const amount = Number(value ?? 0);
  // Centimes en euro seulement, et toujours par deux (« 2,50 € », jamais
  // « 2,5 € ») — même règle que CurrencyManager.format() côté app. Les autres
  // devises n'ont pas de centimes en usage : arrondi à l'unité.
  const code = (country?.currency_code ?? "").toUpperCase();
  const digits = (code === "EUR" || code === "USD") && Math.round(amount * 100) % 100 !== 0 ? 2 : 0;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${formatted} ${country?.currency_symbol || country?.currency_code || "FDJ"}`;
}

/**
 * Somme de montants de plusieurs marchés, SANS addition entre devises :
 * « 12 000 FC · 3 000 FDJ ». Un seul marché : un seul montant. Miroir de
 * `formatSumsByMarket` côté app (audit des devises du 2026-10-08).
 */
export function formatMoneySums(
  entries: Array<[number, Pick<Country, "currency_symbol" | "currency_code"> | null | undefined]>,
  fallback?: Pick<Country, "currency_symbol" | "currency_code"> | null,
) {
  const sums = new Map<string, { amount: number; country: Pick<Country, "currency_symbol" | "currency_code"> | null | undefined }>();
  for (const [amount, country] of entries) {
    const key = country?.currency_code ?? country?.currency_symbol ?? "";
    const cur = sums.get(key);
    sums.set(key, { amount: (cur?.amount ?? 0) + amount, country: cur?.country ?? country });
  }
  if (sums.size === 0) return formatMoney(0, fallback);
  return [...sums.values()].map((s) => formatMoney(s.amount, s.country ?? fallback)).join(" · ");
}

export function firstPhoto(product?: Pick<Product, "photos"> | null) {
  return product?.photos?.find(Boolean) || "/brand/rivendy-logo-square.png";
}

export function isProductPublished(product: Pick<Product, "status">) {
  return ["active", "boosted"].includes(product.status);
}

export function isProductVisible(product: Pick<Product, "status" | "stock_quantity">) {
  return isProductPublished(product) && Number(product.stock_quantity ?? 0) > 0;
}

/**
 * Vrai si l'article serait renvoyé par la vue `visible_products`. À appliquer
 * partout où le site lit `products` EN DIRECT (jointure `products(*)` des
 * favoris…) au lieu de la vue — sinon un article supprimé, refusé ou en
 * attente reste affiché.
 * Jumeaux à garder identiques : le WHERE de la vue
 * (rivendy_dashboard/supabase/migrations/20260908_visible_products_seller_columns.sql)
 * et `isVisibleInCatalog` de l'app
 * (rivendy_app/lib/features/products/logic/catalog_visibility.dart).
 * Si la vue change, changer les trois.
 */
export function isVisibleInCatalog(
  product: Pick<Product, "status" | "product_type" | "show_in_catalog" | "is_deleted" | "deleted_at">,
) {
  return isProductPublished(product)
    && (product.product_type !== "preorder" || product.show_in_catalog === true)
    && product.is_deleted !== true
    && product.deleted_at == null;
}

/** Article supprimé (suppression douce) : ni affichable, ni modifiable. */
export function isProductDeleted(product: Pick<Product, "status" | "is_deleted" | "deleted_at">) {
  return product.status === "deleted" || product.is_deleted === true || product.deleted_at != null;
}

/**
 * Vrai si `quantity` exemplaires peuvent être commandés. Miroir du verrou de
 * `secure_create_order` (rivendy_dashboard/supabase/migrations/
 * 20261003_orders_home_market_only.sql : status active/boosted ET
 * stock_quantity >= quantité), suppression douce exclue. Ne PAS utiliser
 * `isVisibleInCatalog` ici : une précommande masquée du catalogue reste
 * commandable.
 */
export function isOrderable(
  product: Pick<Product, "status" | "is_deleted" | "deleted_at"> & { stock_quantity?: number | null },
  quantity = 1,
) {
  return isProductPublished(product)
    && Number(product.stock_quantity ?? 0) >= quantity
    && !isProductDeleted(product);
}

export function isBoosted(product: Pick<Product, "status" | "boost_expires_at">) {
  if (product.status !== "boosted") return false;
  if (!product.boost_expires_at) return true;
  return new Date(product.boost_expires_at).getTime() > Date.now();
}

/**
 * Référence de commande `CMD-AAAAMMJJ-XXXXXX` — miroir EXACT de
 * `generateOrderId` (rivendy_app/lib/core/utils/order_id.dart) : 6 caractères
 * tirés d'un générateur CRYPTOGRAPHIQUE sur un alphabet sans caractères
 * ambigus (ni O/0, ni I/1/L — la référence est lue au téléphone).
 * Jusqu'au 2026-10-04 le site tirait 5 caractères base36 de Math.random.
 */
const ORDER_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function orderId(prefix = "CMD") {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const bytes = new Uint32Array(6);
  globalThis.crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (n) => ORDER_ID_ALPHABET[n % ORDER_ID_ALPHABET.length]).join("");
  return `${prefix}-${yyyy}${mm}${dd}-${suffix}`;
}

export function syntheticEmailFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@nikey.app`;
}

// `categoryToCommissionName` a été supprimée le 2026-07-25 : jamais appelée,
// et ses libellés étaient SANS accents ('Electronique', 'Beaute & Parfums'),
// donc incapables de correspondre à `commission_rules.category` qui les stocke
// accentués. La correspondance catégorie → libellé de commission vit désormais
// dans `lib/utils/commission.ts` (COMMISSION_CATEGORY_LABELS), à côté du calcul.
//
// ⚠️ Ne pas réutiliser `categoryLabel()` ci-dessus pour une recherche en base :
// c'est un libellé d'AFFICHAGE ('Artisanat local', 'Supermarché') qui diffère
// des valeurs stockées ('Artisanat', 'Alimentation').

export function normalizePhoneForWhatsApp(phone: string) {
  return phone.replace(/\D/g, "");
}
