import { createAnonServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_COUNTRY_ID,
  type Advertisement,
  type CategoryId,
  type Country,
  type PaymentMethod,
  type Product,
  type Profile,
} from "@/types/rivendy";

type ProductRow = Record<string, unknown> & {
  profiles?: Partial<Profile> | null;
};

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function normalizeProduct(row: ProductRow): Product {
  const profile = row.profiles;
  const photos = Array.isArray(row.photos) ? row.photos.map(String) : [];

  return {
    id: String(row.id ?? ""),
    seller_id: String(row.seller_id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    price: toNumber(row.price),
    seller_price: toNumber(row.seller_price ?? row.price),
    commission_amount: toNumber(row.commission_amount),
    photos,
    size: String(row.size ?? ""),
    category: String(row.category ?? "femme"),
    subcategory: String(row.subcategory ?? ""),
    condition: String(row.condition ?? "Bon état"),
    status: String(row.status ?? "active"),
    boost_expires_at: (row.boost_expires_at as string | null) ?? null,
    stock_quantity: Number(row.stock_quantity ?? 1),
    product_type: String(row.product_type ?? "standard"),
    delivery_days: row.delivery_days == null ? null : Number(row.delivery_days),
    show_in_catalog: Boolean(row.show_in_catalog ?? false),
    is_story: Boolean(row.is_story ?? false),
    package_contents: String(row.package_contents ?? ""),
    epuise_at: (row.epuise_at as string | null) ?? null,
    sold_at: (row.sold_at as string | null) ?? null,
    views_count: Number(row.views_count ?? 0),
    comments_count: Number(row.comments_count ?? 0),
    likes_count: Number(row.likes_count ?? 0),
    average_rating: row.average_rating == null ? null : toNumber(row.average_rating),
    reject_reason: (row.reject_reason as string | null) ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    seller_name:
      (row.seller_name as string | null) ||
      profile?.store_name ||
      profile?.full_name ||
      null,
    seller_avatar_url:
      (row.seller_avatar_url as string | null) ||
      profile?.avatar_url ||
      null,
    seller_is_certified:
      Boolean(row.seller_is_certified ?? profile?.is_certified ?? false),
    seller_country_id:
      (row.seller_country_id as string | null) ||
      profile?.country_id ||
      null,
  };
}

function normalizeAd(row: Record<string, unknown>): Advertisement {
  return {
    id: String(row.id ?? ""),
    country_id: String(row.country_id ?? DEFAULT_COUNTRY_ID),
    title: String(row.title ?? ""),
    image_url: String(row.image_url ?? ""),
    link_type: (row.link_type as Advertisement["link_type"]) ?? "none",
    link_value: (row.link_value as string | null) ?? null,
    position: String(row.position ?? "home_banner"),
    display_order: Number(row.display_order ?? 1),
    is_active: Boolean(row.is_active ?? false),
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    views_count: Number(row.views_count ?? 0),
    clicks_count: Number(row.clicks_count ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function getCountries() {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error || !data?.length) {
    return [
      {
        id: "DJ",
        name: "Djibouti",
        currency_code: "FDJ",
        currency_symbol: "FDJ",
        whatsapp_number: process.env.NEXT_PUBLIC_RIVENDY_WHATSAPP_FALLBACK || "+25377145306",
        is_active: true,
      },
    ] satisfies Country[];
  }
  return data as Country[];
}

export async function getCountry(countryId = DEFAULT_COUNTRY_ID) {
  const countries = await getCountries();
  return countries.find((country) => country.id === countryId) ?? countries[0];
}

export async function getPaymentMethods(countryId = DEFAULT_COUNTRY_ID) {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("country_id", countryId)
    .eq("is_active", true)
    .order("display_order");

  if (error || !data?.length) {
    return [
      {
        id: 1,
        country_id: countryId,
        name: "Cash a la livraison",
        type: "cash",
        logo_icon: "payments",
        color_hex: "#4CAF50",
        is_active: true,
        api_ready: false,
        display_order: 1,
      },
    ] satisfies PaymentMethod[];
  }
  return data as PaymentMethod[];
}

export async function getAdvertisements({
  countryId = DEFAULT_COUNTRY_ID,
  positions,
}: {
  countryId?: string;
  positions: string[];
}) {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("advertisements")
    .select("*")
    .eq("country_id", countryId)
    .eq("is_active", true)
    .in("position", positions)
    .order("display_order", { ascending: true });

  if (error || !data) return [];

  const now = Date.now();
  return data
    .map((row) => normalizeAd(row as Record<string, unknown>))
    .filter((ad) => {
      if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return false;
      if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return false;
      return true;
    });
}

// Tri du catalogue — parity Flutter search_screen.dart (_sortOrder)
export type ProductSort = "recent" | "price_asc" | "price_desc";

export async function getProducts({
  countryId = DEFAULT_COUNTRY_ID,
  category,
  subcategory,
  search,
  priceMin,
  priceMax,
  sort = "recent",
  limit = 60,
}: {
  countryId?: string;
  category?: CategoryId | string;
  subcategory?: string;
  search?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: ProductSort;
  limit?: number;
}) {
  const supabase = createAnonServerClient();
  let query = supabase.from("visible_products").select("*").limit(limit);

  // Parity Flutter : filtrer sur country_id du produit (pas seller_country_id du profil)
  if (countryId && countryId !== "all") query = query.eq("country_id", countryId);
  if (category && category !== "all") query = query.eq("category", category);
  if (subcategory?.trim()) query = query.eq("subcategory", subcategory.trim());
  if (search?.trim()) query = query.ilike("title", `%${search.trim()}%`);
  // Fourchette de prix — parity Flutter (filtre _priceMin / _priceMax)
  if (typeof priceMin === "number" && !Number.isNaN(priceMin)) query = query.gte("price", priceMin);
  if (typeof priceMax === "number" && !Number.isNaN(priceMax)) query = query.lte("price", priceMax);

  // Tri — parity Flutter : recent | price_asc | price_desc
  if (sort === "price_asc") query = query.order("price", { ascending: true });
  else if (sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error || !data) return [];

  const products = data.map((row) => normalizeProduct(row as ProductRow));
  // Tri récents : on remonte les boostés ; tri prix : on respecte le prix.
  if (sort === "recent") {
    return products.sort((a, b) => Number(b.status === "boosted") - Number(a.status === "boosted"));
  }
  return products;
}

export async function getProductById(id: string) {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, profiles!seller_id(id, full_name, store_name, store_description, avatar_url, store_banner_url, voice_note_url, is_certified, total_sales, country_id, created_at)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeProduct(data as ProductRow);
}

export async function getSimilarProducts(product: Product, limit = 8) {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("visible_products")
    .select("*")
    .eq("category", product.category)
    .neq("id", product.id)
    .eq("country_id", product.seller_country_id ?? DEFAULT_COUNTRY_ID)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => normalizeProduct(row as ProductRow));
}

export async function getSellerProfile(sellerId: string) {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, store_name, store_description, avatar_url, store_banner_url, voice_note_url, is_certified, total_sales, country_id, created_at")
    .eq("id", sellerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

export async function getSellerPublicProducts(sellerId: string, includeSold = false) {
  const supabase = createAnonServerClient();
  let query = supabase
    .from("products")
    .select("*, profiles!seller_id(full_name, store_name, avatar_url, is_certified, country_id)")
    .eq("seller_id", sellerId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  query = includeSold
    ? query.in("status", ["active", "boosted", "sold", "epuise"])
    : query.in("status", ["active", "boosted"]);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => normalizeProduct(row as ProductRow));
}

export async function getStoreTrustSummary(sellerId: string) {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase
    .from("store_ratings")
    .select("rating, has_photo, delivery_validated")
    .eq("seller_id", sellerId);

  if (error || !data?.length) {
    return {
      score: 0,
      totalReviews: 0,
      verifiedReviews: 0,
      label: "Nouveau magasin",
    };
  }

  const rows = data as Array<{ rating: number; has_photo?: boolean; delivery_validated?: boolean }>;
  const score = rows.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) / rows.length;
  const verifiedReviews = rows.filter((row) => row.delivery_validated || row.has_photo).length;

  return {
    score: Number(score.toFixed(1)),
    totalReviews: rows.length,
    verifiedReviews,
    label:
      score >= 4.5
        ? "Excellent"
        : score >= 4
          ? "Tres bien"
          : score >= 3.5
            ? "Bien"
            : "En progression",
  };
}

export interface VendorPillars {
  totalOrders: number;
  deliveredOrders: number;
  avgPreparationHours: number | null;
  conformityRate: number | null;
  responseRate: number | null;
}

/**
 * Piliers de performance vendeur (préparation / conformité / réponse).
 * Agrégés via la RPC `get_vendor_pillars` (SECURITY DEFINER) car le rôle
 * anon ne peut pas lire `orders` directement. Renvoie null si pas de donnée
 * ou si la RPC n'est pas encore déployée.
 */
export async function getVendorPillars(sellerId: string): Promise<VendorPillars | null> {
  const supabase = createAnonServerClient();
  const { data, error } = await supabase.rpc("get_vendor_pillars", { p_seller_id: sellerId });
  if (error || !data) return null;
  const row = data as {
    total_orders?: number;
    delivered_orders?: number;
    avg_preparation_hours?: number | null;
    conformity_rate?: number | null;
    response_rate?: number | null;
  };
  if (!row.total_orders || row.total_orders <= 0) return null;
  return {
    totalOrders: Number(row.total_orders ?? 0),
    deliveredOrders: Number(row.delivered_orders ?? 0),
    avgPreparationHours: row.avg_preparation_hours != null ? Number(row.avg_preparation_hours) : null,
    conformityRate: row.conformity_rate != null ? Number(row.conformity_rate) : null,
    responseRate: row.response_rate != null ? Number(row.response_rate) : null,
  };
}

export async function getStoryProducts(countryId = DEFAULT_COUNTRY_ID) {
  const supabase = createAnonServerClient();
  const nowIso = new Date().toISOString();

  // Parity Flutter : is_deleted=false + story_expires_at > now + country_id sur le produit (pas le profil)
  const { data, error } = await supabase
    .from("products")
    .select("*, profiles!seller_id(full_name, store_name, avatar_url, is_certified, country_id)")
    .eq("is_story", true)
    .eq("is_deleted", false)
    .in("status", ["active", "boosted", "validated", "pending"])
    .gt("story_expires_at", nowIso)
    .eq("country_id", countryId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data.map((row) => normalizeProduct(row as ProductRow));
}
