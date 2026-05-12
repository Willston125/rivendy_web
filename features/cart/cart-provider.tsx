"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Product, SellerCartGroup } from "@/types/rivendy";

const CART_KEY = "rivendy_cart_v1";

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

  useEffect(() => {
    setItems(readCart());
  }, []);

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
    }),
    [addItem, clearCart, clearGroup, decrement, groups, increment, items, quantityOf, removeItem, totalAmount, totalItems],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
