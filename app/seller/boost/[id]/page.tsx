import { notFound } from "next/navigation";
import { RequireAuth } from "@/features/auth/require-auth";
import { BoostView } from "@/features/seller/boost-view";
import { createAnonServerClient } from "@/lib/supabase/server";
import type { Product } from "@/types/rivendy";

export default async function BoostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAnonServerClient();

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <RequireAuth>
      <BoostView product={data as Product} />
    </RequireAuth>
  );
}
