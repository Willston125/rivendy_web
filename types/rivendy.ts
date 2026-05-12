export const DEFAULT_COUNTRY_ID = "DJ";
export const RIVENDY_TEAL = "#009688";

export const CATEGORIES = [
  { id: "femme", label: "Femme" },
  { id: "homme", label: "Homme" },
  { id: "bebeEnfants", label: "Bebe & Enfants" },
  { id: "electronique", label: "Electronique" },
  { id: "maison", label: "Maison" },
  { id: "beauteParfums", label: "Beaute & Parfums" },
  { id: "artisanatLocal", label: "Artisanat local" },
  { id: "materiauxConstruction", label: "Construction" },
  { id: "alimentation", label: "Alimentation" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export type ProductStatus =
  | "active"
  | "boosted"
  | "sold"
  | "validated"
  | "pending"
  | "epuise"
  | "rejected";

export type ProductType = "standard" | "preorder" | "food_package";

export interface Country {
  id: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  whatsapp_number: string;
  is_active: boolean;
  created_at?: string;
}

export interface PaymentMethod {
  id: number;
  country_id: string;
  name: string;
  type: "cash" | "mobile_money" | string;
  logo_icon: string | null;
  color_hex: string | null;
  is_active: boolean;
  api_ready: boolean;
  display_order: number;
  created_at?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  whatsapp_number: string;
  real_email: string;
  country_id: string;
  store_name: string;
  store_description: string;
  avatar_url: string;
  store_banner_url: string;
  voice_note_url: string | null;
  is_certified: boolean;
  total_sales: number;
  role?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  seller_price: number;
  commission_amount: number;
  photos: string[];
  size: string;
  category: CategoryId | string;
  subcategory: string;
  condition: string;
  status: ProductStatus | string;
  boost_expires_at: string | null;
  stock_quantity: number;
  product_type: ProductType | string;
  delivery_days: number | null;
  show_in_catalog: boolean;
  is_story: boolean;
  package_contents: string;
  epuise_at?: string | null;
  sold_at?: string | null;
  views_count: number;
  comments_count: number;
  likes_count: number;
  average_rating?: number | null;
  reject_reason?: string | null;
  created_at: string;
  updated_at: string;
  seller_name?: string | null;
  seller_avatar_url?: string | null;
  seller_is_certified?: boolean | null;
  seller_country_id?: string | null;
}

export type AdvertisementPosition =
  | "home_banner"
  | "feed_inline"
  | "splash"
  | "web_home_banner"
  | "web_feed_inline"
  | "web_category_banner";

export interface Advertisement {
  id: string;
  country_id: string;
  title: string;
  image_url: string;
  link_type: "product" | "category" | "store" | "external" | "none" | "whatsapp";
  link_value: string | null;
  position: AdvertisementPosition | string;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  views_count?: number;
  clicks_count?: number;
  created_at: string;
}

export type OrderStatus =
  | "pending_whatsapp"
  | "confirmed_by_customer_service"
  | "assigned_to_delivery"
  | "picked_up"
  | "en_route"
  | "delivered_by_rider"
  | "completed"
  | "cancelled"
  | "pending"
  | "shipped"
  | "delivered";

export interface OrderItem {
  id?: string;
  order_id: string;
  product_id: string | null;
  product_title: string;
  product_image_url: string | null;
  product_price: number;
  product_size: string | null;
  quantity: number;
  subtotal: number;
  commission_rate: number;
  commission_amount: number;
  seller_amount: number;
  created_at?: string;
}

export interface AppOrder {
  id: string;
  order_type: "single" | "multi";
  seller_id: string | null;
  seller_name: string | null;
  buyer_id: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_zone: string | null;
  payment_method: string;
  payment_status: "pending_cash" | "paid" | "delivered";
  status: OrderStatus;
  transaction_ref: string | null;
  country_id: string | null;
  total_price: number;
  total_commission: number;
  total_seller_amount: number;
  delivered_at?: string | null;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SellerCartGroup {
  sellerId: string;
  sellerName: string;
  items: CartItem[];
}

export interface BoostPurchaseInput {
  product_id: string;
  seller_id: string;
  plan: "bronze" | "argent" | "or";
  price_paid: number;
  duration_days: number;
  status: "pending";
  payment_method: string;
  country_id: string;
  payment_reference?: string | null;
}

export interface SellerSubscriptionInput {
  seller_id: string;
  plan: "weekly" | "monthly" | "yearly";
  price_paid: number;
  duration_days: number;
  status: "pending";
  payment_method: string;
  country_id: string;
  payment_reference?: string | null;
}

export type PayoutStatus =
  | "pending_director"
  | "approved_director"
  | "pending_ceo"
  | "approved_ceo"
  | "pending"
  | "approved_regional"
  | "paid"
  | "rejected";
