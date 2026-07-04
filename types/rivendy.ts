export const DEFAULT_COUNTRY_ID = "DJ";
export const RIVENDY_TEAL = "#009688";

export const CATEGORIES = [
  { id: "femme", label: "Femme" },
  { id: "homme", label: "Homme" },
  { id: "bebeEnfants", label: "Bébé & Enfants" },
  { id: "electronique", label: "Électronique" },
  { id: "maison", label: "Maison" },
  { id: "beauteParfums", label: "Beauté & Parfums" },
  { id: "artisanatLocal", label: "Artisanat local" },
  { id: "materiauxConstruction", label: "Construction" },
  { id: "alimentation", label: "Supermarché" },
  { id: "location", label: "Location" },
  { id: "mariage", label: "Mariage" },
  { id: "restaurant", label: "Restaurant" },
  { id: "pharmacie", label: "Pharmacie" },
  { id: "personnels", label: "Personnels" },
  { id: "hotel", label: "Hôtels" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/** Subcategories per main category — mirrors Flutter _subcategoriesMap */
export const SUBCATEGORIES: Partial<Record<CategoryId, string[]>> = {
  femme: [
    "Robes", "Hauts & Tops", "Pantalons & Jeans", "Abaya & Djellaba",
    "Vêtements de sport", "Sous-vêtements", "Sacs & Maroquinerie",
    "Chaussures", "Bijoux & Montres", "Accessoires",
  ],
  homme: [
    "Chemises & Polos", "T-shirts", "Pantalons & Jeans", "Djellaba & Boubou",
    "Vêtements de sport", "Sous-vêtements", "Chaussures",
    "Ceintures & Accessoires", "Montres", "Parfums",
  ],
  bebeEnfants: [
    "Vêtements fille 0–2 ans", "Vêtements garçon 0–2 ans",
    "Vêtements fille 3–12 ans", "Vêtements garçon 3–12 ans",
    "Chaussures enfants", "Jouets", "Puériculture", "Sacs à dos",
  ],
  electronique: [
    "Smartphones", "Tablettes", "Ordinateurs & Laptops", "TV & Écrans",
    "Accessoires téléphone", "Casques & Écouteurs", "Appareils photo",
    "Consoles de jeu", "Câbles & Chargeurs", "Petits électroménagers",
  ],
  maison: [
    "Meubles", "Décoration", "Literie", "Vaisselle & Cuisine",
    "Électroménager", "Luminaires", "Jardinage", "Rangement",
  ],
};

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
  /** Couverture spécifique au site web (cadrage large). Ignorée par l'app. */
  store_banner_url_web?: string | null;
  voice_note_url: string | null;
  is_certified: boolean;
  total_sales: number;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
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
  story_started_at?: string | null;
  story_expires_at?: string | null;
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
  business_type: string;
  extra_attributes: Record<string, string>;
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
  target_category?: string | null;
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
  | "payment_received_cash"
  | "assigned_to_delivery"
  | "accepted_by_agent"
  | "picked_up"
  | "en_route"
  | "arrived"
  | "code_generated"
  | "awaiting_customer_confirmation"
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
  /** Variante choisie par l'acheteur dans le panier (une ligne par produit). */
  selectedSize?: string;
  selectedColor?: string;
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
