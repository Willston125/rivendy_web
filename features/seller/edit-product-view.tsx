"use client";

import { useEffect, useState } from "react";
import { ProductForm } from "@/features/products/product-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import type { Product } from "@/types/rivendy";

export function EditProductView({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("seller_id", user.id)
        .maybeSingle();
      setProduct((data as Product | null) ?? null);
      setLoading(false);
    }
    load();
  }, [productId, user]);

  if (loading) return <p className="p-8 text-sm font-semibold text-slate-500">Chargement...</p>;
  if (!product) return <p className="p-8 text-sm font-semibold text-red-600">Produit introuvable ou non autorise.</p>;

  return <ProductForm product={product} />;
}
