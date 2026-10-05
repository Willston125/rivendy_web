"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { isOrderable } from "@/lib/utils/format";
import type { CartItem, Product, SellerCartGroup } from "@/types/rivendy";

const CART_KEY = "rivendy_cart_v1";

/* ── Revérification du panier (2026-10-04) ──────────────────────────────
   Le panier vit dans localStorage avec une COPIE du produit, jamais relue :
   un article supprimé, vendu ou épuisé y restait affiché comme achetable,
   compté dans le badge, et l'acheteur ne l'apprenait qu'en commandant.
   Les lignes sont relues en base au chargement et à l'ouverture du panier
   ou du checkout : un article qui ne peut plus être commandé (même règle
   que la RPC, isOrderable) est retiré, une quantité au-delà du stock est
   ramenée au stock, et les prix sont remis à jour. Un avis nomme ce qui a
   été retiré. Sans réseau, le panier reste tel quel : la commande
   revérifie de toute façon. */
const FRESH_COLUMNS =
  "id, seller_id, country_id, category, title, price, seller_price, commission_amount, photos, status, stock_quantity, is_deleted, deleted_at";

type FreshProduct = Pick<
  Product,
  | "id"
  | "seller_id"
  | "country_id"
  | "category"
  | "title"
  | "price"
  | "seller_price"
  | "commission_amount"
  | "photos"
  | "status"
  | "stock_quantity"
  | "is_deleted"
  | "deleted_at"
>;

/** Deux revérifications du même panier à moins de 10 s : une seule requête. */
const REVALIDATE_INTERVAL_MS = 10_000;

function quote(title: string) {
  return `« ${title || "Article"} »`;
}

function cartChangeNotice(removed: string[], reduced: string[]) {
  const parts: string[] = [];
  if (removed.length === 1) {
    parts.push(`${quote(removed[0])} n'est plus disponible : il a été retiré de votre panier.`);
  } else if (removed.length > 1) {
    parts.push(
      `${removed.length} articles ne sont plus disponibles et ont été retirés de votre panier : ${removed.map(quote).join(", ")}.`,
    );
  }
  if (reduced.length) {
    parts.push(`Quantité ramenée au stock disponible : ${reduced.join(", ")}.`);
  }
  return parts.join(" ");
}

type CartContextValue = {
  items: CartItem[];
  groups: SellerCartGroup[];
  totalItems: number;
  totalAmount: number;
  sellerCount: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  clearCart: () => void;
  clearGroup: (sellerId: string) => void;
  quantityOf: (productId: string) => number;
  setItemVariant: (productId: string, variant: { size?: string; color?: string }) => void;
  /** Relit les articles du panier en base (voir FRESH_COLUMNS). `force` ignore
   *  le délai entre deux revérifications (juste avant de commander). */
  revalidateCart: (options?: { force?: boolean }) => Promise<void>;
  /** Ce que la dernière revérification a retiré ou ajusté, à afficher. */
  cartNotice: string | null;
  dismissCartNotice: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function groupItems(items: CartItem[]): SellerCartGroup[] {
  const groups = new Map<string, SellerCartGroup>();
  for (const item of items) {
    const sellerId = item.product.seller_id || item.product.seller_name || "unknown";
    const sellerName = item.product.seller_name || "Boutique Rivendy";
    const group = groups.get(sellerId) ?? { sellerId, sellerName, items: [] };
    group.items.push(item);
    groups.set(sellerId, group);
  }
  return Array.from(groups.values());
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  const lastCheckRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const revalidate = useCallback(async (snapshot?: CartItem[], force = false) => {
    const list = snapshot ?? itemsRef.current;
    const ids = Array.from(new Set(list.map((item) => item.product.id).filter(Boolean)));
    if (!ids.length) return;

    const key = list.map((item) => `${item.product.id}:${item.quantity}`).sort().join("|");
    const last = lastCheckRef.current;
    if (!force && last && last.key === key && Date.now() - last.at < REVALIDATE_INTERVAL_MS) return;

    const { data, error } = await supabase.from("products").select(FRESH_COLUMNS).in("id", ids);
    if (error || !data) return;
    lastCheckRef.current = { key, at: Date.now() };

    const fresh = new Map((data as FreshProduct[]).map((row) => [row.id, row]));
    const checked = new Set(ids);

    // Décisions prises UNE fois, hors du updater (React peut le rejouer).
    const removed: string[] = [];
    const reduced: string[] = [];
    for (const item of list) {
      const row = fresh.get(item.product.id);
      if (!row || !isOrderable(row)) {
        removed.push(row?.title || item.product.title);
      } else if (Number(row.stock_quantity ?? 0) < item.quantity) {
        reduced.push(`${quote(row.title || item.product.title)} (${Number(row.stock_quantity)})`);
      }
    }

    setItems((current) =>
      current.flatMap((item): CartItem[] => {
        // Ajouté pendant la requête : pas encore vérifié, gardé tel quel.
        if (!checked.has(item.product.id)) return [item];
        const row = fresh.get(item.product.id);
        if (!row || !isOrderable(row)) return [];
        const stock = Number(row.stock_quantity ?? 0);
        return [
          {
            ...item,
            quantity: Math.min(item.quantity, stock),
            product: {
              ...item.product,
              // Marché, vendeur et catégorie relus (2026-10-04) : un panier
              // enregistré avant ce correctif n'avait pas country_id, et la
              // garde « marché d'origine » ne pouvait pas s'y appliquer.
              seller_id: row.seller_id || item.product.seller_id,
              country_id: row.country_id ?? item.product.country_id ?? null,
              category: row.category || item.product.category,
              title: row.title || item.product.title,
              price: Number(row.price ?? item.product.price),
              seller_price: Number(row.seller_price ?? row.price ?? item.product.seller_price),
              commission_amount: Number(row.commission_amount ?? item.product.commission_amount ?? 0),
              photos: Array.isArray(row.photos) && row.photos.length ? row.photos : item.product.photos,
              status: row.status,
              stock_quantity: stock,
              is_deleted: row.is_deleted ?? null,
              deleted_at: row.deleted_at ?? null,
            },
          },
        ];
      }),
    );

    if (removed.length || reduced.length) setCartNotice(cartChangeNotice(removed, reduced));
  }, []);

  const revalidateCart = useCallback(
    (options?: { force?: boolean }) => revalidate(undefined, options?.force === true),
    [revalidate],
  );
  const dismissCartNotice = useCallback(() => setCartNotice(null), []);

  useEffect(() => {
    const restored = readCart();
    setItems(restored);
    void revalidate(restored);
  }, [revalidate]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.product.id === product.id);
      if (index === -1) return [...current, { product, quantity }];
      return current.map((item, i) =>
        i === index ? { ...item, quantity: item.quantity + quantity } : item,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  }, []);

  const increment = useCallback((productId: string) => {
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }, []);

  const decrement = useCallback((productId: string) => {
    setItems((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const clearGroup = useCallback((sellerId: string) => {
    setItems((current) => current.filter((item) => (item.product.seller_id || item.product.seller_name) !== sellerId));
  }, []);

  const quantityOf = useCallback(
    (productId: string) => items.find((item) => item.product.id === productId)?.quantity ?? 0,
    [items],
  );

  const setItemVariant = useCallback(
    (productId: string, variant: { size?: string; color?: string }) => {
      setItems((current) =>
        current.map((item) =>
          item.product.id === productId
            ? {
                ...item,
                ...(variant.size !== undefined ? { selectedSize: variant.size || undefined } : {}),
                ...(variant.color !== undefined ? { selectedColor: variant.color || undefined } : {}),
              }
            : item,
        ),
      );
    },
    [],
  );

  const groups = useMemo(() => groupItems(items), [items]);
  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      groups,
      totalItems,
      totalAmount,
      sellerCount: groups.length,
      addItem,
      removeItem,
      increment,
      decrement,
      clearCart,
      clearGroup,
      quantityOf,
      setItemVariant,
      revalidateCart,
      cartNotice,
      dismissCartNotice,
    }),
    [addItem, cartNotice, clearCart, clearGroup, decrement, dismissCartNotice, groups, increment, items, quantityOf, removeItem, revalidateCart, setItemVariant, totalAmount, totalItems],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
