import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { EditProductView } from "@/features/seller/edit-product-view";

export const metadata: Metadata = {
  title: "Modifier le produit — Rivendy",
  robots: { index: false },
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-950 md:text-5xl">Modifier le produit</h1>
          <p className="mt-2 text-sm text-slate-500">Les modifications gardent le statut actuel du produit.</p>
        </div>
        <section className="rounded-3xl bg-white p-5 shadow-sm md:p-8">
          <EditProductView productId={id} />
        </section>
      </div>
    </RequireAuth>
  );
}
