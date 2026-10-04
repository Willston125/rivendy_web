"use client";

import { useEffect, useState } from "react";
import { ProductForm } from "@/features/products/product-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { isProductDeleted } from "@/lib/utils/format";
import type { Product } from "@/types/rivendy";

export function EditProductView({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      try {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("seller_id", user.id)
          .maybeSingle();
        const row = (data as Product | null) ?? null;
        // Article supprimé (suppression douce, la ligne reste) : plus
        // modifiable, même par URL directe. Le formulaire le renvoyait sinon
        // tel quel et annonçait un succès sur un article invisible partout
        // (2026-10-03).
        setProduct(row && !isProductDeleted(row) ? row : null);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId, user]);

  if (loading) return <p className="p-8 text-sm font-semibold text-slate-500">Chargement...</p>;
  if (!product) return <p className="p-8 text-sm font-semibold text-red-600">Produit introuvable ou non autorise.</p>;

  return <ProductForm product={product} />;
}
