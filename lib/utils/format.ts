import { CATEGORIES, type CategoryId, type Country, type Product } from "@/types/rivendy";

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

export function categoryToCommissionName(category: CategoryId | string) {
  const map: Record<string, string> = {
    femme: "Femme",
    homme: "Homme",
    bebeEnfants: "Bebe & Enfants",
    electronique: "Electronique",
    maison: "Maison",
    beauteParfums: "Beaute & Parfums",
    artisanatLocal: "Artisanat",
    materiauxConstruction: "Construction",
    alimentation: "Alimentation",
  };
  return map[category] ?? category;
}

export function normalizePhoneForWhatsApp(phone: string) {
  return phone.replace(/\D/g, "");
}
