import { CATEGORIES, type Country, type Product } from "@/types/rivendy";

export function categoryLabel(category: string) {
  return CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

export function formatMoney(value: number | null | undefined, country?: Pick<Country, "currency_symbol" | "currency_code"> | null) {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `${formatted} ${country?.currency_symbol || country?.currency_code || "FDJ"}`;
}

export function firstPhoto(product?: Pick<Product, "photos"> | null) {
  return product?.photos?.find(Boolean) || "/brand/rivendy-logo-square.png";
}

export function isProductVisible(product: Pick<Product, "status" | "stock_quantity">) {
  return ["active", "boosted"].includes(product.status) && Number(product.stock_quantity ?? 0) > 0;
}

export function isBoosted(product: Pick<Product, "status" | "boost_expires_at">) {
  if (product.status !== "boosted") return false;
  if (!product.boost_expires_at) return true;
  return new Date(product.boost_expires_at).getTime() > Date.now();
}

export function orderId(prefix = "CMD") {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
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
