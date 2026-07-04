"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  MapPin,
  MessageCircle,
  Banknote,
  Phone,
  ShieldCheck,
  Store,
  Truck,
  User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCart } from "@/features/cart/cart-provider";
import { useCountry } from "@/features/country/country-provider";

import { firstPhoto, formatMoney, normalizePhoneForWhatsApp, orderId } from "@/lib/utils/format";
import type { CartItem, PaymentMethod } from "@/types/rivendy";

// ── Types ──────────────────────────────────────────────────────────────────
type DeliveryMode = "none" | "delivery" | "pickup";

type CheckoutProductPatch = {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  seller_price: number | null;
  commission_amount: number | null;
  photos: string[] | null;
  size: string | null;
  status: string;
};

// ── Composant principal ────────────────────────────────────────────────────
export function CheckoutForm() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { groups, totalAmount, totalItems, sellerCount, clearCart } = useCart();
  const { country: countryOrNull, paymentMethods, needsMarketSelection } = useCountry();
  // country est alias de countryOrNull — utilise optional chaining partout
  const country = countryOrNull;


  // Infos acheteur
  const [buyerName, setBuyerName] = useState(profile?.full_name || "");
  const [buyerPhone, setBuyerPhone] = useState(profile?.whatsapp_number || "");
  const [buyerZone, setBuyerZone] = useState("");

  // Mode de livraison
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("none");

  // Méthode de paiement sélectionnée
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [transactionRef, setTransactionRef] = useState("");

  // État commande
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const fallbackMethods: PaymentMethod[] = useMemo(
    () => [
      {
        id: 0,
        country_id: country?.id ?? "DJ",

        name: "Cash à la livraison",
        type: "cash",
        logo_icon: null,
        color_hex: null,
        is_active: true,
        api_ready: false,
        display_order: 0,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [country?.id],
  );


  const activeMethods = paymentMethods.length ? paymentMethods : fallbackMethods;

  const commissionTotal = useMemo(
    () =>
      groups.reduce(
        (sum, group) =>
          sum +
          group.items.reduce(
            (inner, item) => inner + Number(item.product.commission_amount || 0) * item.quantity,
            0,
          ),
        0,
      ),
    [groups],
  );

  // Label zone effectif selon mode de livraison
  const effectiveZoneLabel = useMemo(() => {
    if (deliveryMode === "delivery") return buyerZone.trim();
    if (deliveryMode === "pickup") return "Retrait personnel";
    return "";
  }, [deliveryMode, buyerZone]);

  // Livraison prête ?
  const isDeliveryReady = useMemo(() => {
    if (deliveryMode === "delivery") return buyerZone.trim().length > 0;
    if (deliveryMode === "pickup") return true;
    return false;
  }, [deliveryMode, buyerZone]);

  // Formulaire complet ?
  const isFormValid =
    buyerName.trim().length > 0 &&
    buyerPhone.trim().length > 0 &&
    isDeliveryReady &&
    selectedMethod !== null;

  // ── Message WhatsApp (format identique à l'app Flutter) ──────────────────

  function buildWhatsAppMessage(
    groupSellerName: string,
    groupItems: CartItem[],
    groupTotal: number,
    ref: string,
    paymentName: string,
  ): string {
    const lines: string[] = [];
    lines.push(`🛒 *Nouvelle commande — ${groupSellerName}*`);
    lines.push(`📋 Réf : ${ref}`);
    lines.push("─────────────────");
    for (const item of groupItems) {
      const subtotal = item.product.price * item.quantity;
      lines.push(`• ${item.product.title} × ${item.quantity} → ${Math.round(subtotal).toLocaleString("fr-FR")} ${country?.currency_symbol || country?.currency_code || "FDJ"}`);
      // Variantes déclarées (options à préciser par l'acheteur avec le vendeur/Rivendy)
      const extra = item.product.extra_attributes ?? {};
      const sizes = (extra.sizes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const colors = (extra.colors ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (sizes.length > 0) lines.push(`   ↳ Tailles proposées : ${sizes.join(", ")}`);
      if (colors.length > 0) lines.push(`   ↳ Couleurs proposées : ${colors.join(", ")}`);
    }
    lines.push("─────────────────");
    lines.push(`💰 Total : ${Math.round(groupTotal).toLocaleString("fr-FR")} ${country?.currency_symbol || country?.currency_code || "FDJ"}`);
    lines.push(`💳 Paiement : ${paymentName}`);
    lines.push("─────────────────");
    if (deliveryMode === "pickup") {
      lines.push("🏪 Mode : Retrait personnel");
    } else {
      lines.push("🛵 Mode : Livraison à domicile");
      lines.push(`📍 Zone : ${buyerZone.trim()}`);
    }
    lines.push("─────────────────");
    lines.push(`👤 ${buyerName.trim()}`);
    lines.push(`📞 ${buyerPhone.trim()}`);
    return lines.join("\n");
  }

  // ── Soumission ────────────────────────────────────────────────────────────

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid || !groups.length) return;
    setLoading(true);
    setError("");

    try {
      // Rafraîchir les données produit depuis Supabase
      const productIds = Array.from(
        new Set(groups.flatMap((group) => group.items.map((item) => item.product.id))),
      );
      const { data: productRows, error: productsError } = await supabase
        .from("products")
        .select("id, seller_id, title, price, seller_price, commission_amount, photos, size, status")
        .in("id", productIds);

      if (productsError) throw productsError;

      const productMap = new Map(
        (productRows as CheckoutProductPatch[] | null | undefined)?.map((p) => [p.id, p]) ?? [],
      );

      const checkoutGroups = groups.map((group) => ({
        ...group,
        items: group.items.map((item): CartItem => {
          const fresh = productMap.get(item.product.id);
          if (!fresh) return item;
          return {
            ...item,
            product: {
              ...item.product,
              seller_id: fresh.seller_id || item.product.seller_id,
              title: fresh.title || item.product.title,
              price: Number(fresh.price ?? item.product.price),
              seller_price: Number(fresh.seller_price ?? fresh.price ?? item.product.seller_price),
              commission_amount: Number(fresh.commission_amount ?? item.product.commission_amount ?? 0),
              photos: Array.isArray(fresh.photos) ? fresh.photos : item.product.photos,
              size: fresh.size ?? item.product.size,
              status: fresh.status ?? item.product.status,
            },
          };
        }),
      }));

      const orderIds: string[] = [];
      const paymentName = selectedMethod!.name;
      const paymentStatus = selectedMethod!.type === "cash" ? "pending_cash" : "paid";

      type SecureOrderResult = {
        success: boolean;
        order_id: string;
        total_price: number;
        total_commission: number;
        total_seller_amount: number;
        error?: string;
      };

      for (const group of checkoutGroups) {
        const id = orderId();

        // Appeler le RPC sécurisé pour créer la commande et les articles
        const { data: rpcResult, error: rpcError } = await supabase.rpc("secure_create_order", {
          p_order_id: id,
          p_order_type: sellerCount > 1 ? "multi" : "single",
          p_seller_id: group.sellerId,
          p_seller_name: group.sellerName,
          p_buyer_name: buyerName.trim(),
          p_buyer_phone: buyerPhone.trim(),
          p_buyer_zone: effectiveZoneLabel,
          p_payment_method: paymentName,
          p_payment_status: paymentStatus,
          p_country_id: country?.id ?? "DJ",
          p_transaction_ref: transactionRef.trim() || null,
          p_items: group.items.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        });

        if (rpcError) throw rpcError;

        const resultObj = rpcResult as SecureOrderResult | null;
        if (!resultObj || resultObj.success === false) {
          throw new Error(resultObj?.error || "Une erreur est survenue lors de la création de la commande.");
        }

        const actualTotal = resultObj.total_price;

        // Log WhatsApp
        const msg = buildWhatsAppMessage(group.sellerName, group.items, actualTotal, id, paymentName);
        supabase.from("whatsapp_logs").insert({
          country_id: country?.id ?? "DJ",
          phone_number: country?.whatsapp_number ?? null,
          message_type: "order_confirmation",
          order_id: id,
          recipient_name: buyerName.trim(),
          message_content: msg,
          status: "sent",
        }).then(() => null, () => null);

        orderIds.push(id);
      }

      setCreatedIds(orderIds);
      clearCart();

      // Ouvrir WhatsApp avec le message de la 1ère commande (résumé global)
      const firstGroup = checkoutGroups[0];
      const allTotal = checkoutGroups.reduce(
        (sum, g) => sum + g.items.reduce((s, i) => s + i.product.price * i.quantity, 0),
        0,
      );
      const summaryMsg = buildWhatsAppMessage(
        sellerCount > 1 ? `${sellerCount} boutiques` : (firstGroup?.sellerName ?? "Rivendy"),
        checkoutGroups.flatMap((g) => g.items),
        allTotal,
        orderIds.join(", "),
        paymentName,
      );
      const whatsapp = normalizePhoneForWhatsApp(
        country?.whatsapp_number || process.env.NEXT_PUBLIC_RIVENDY_WHATSAPP_FALLBACK || "",
      );
      if (whatsapp) {
        window.open(
          `https://wa.me/${whatsapp}?text=${encodeURIComponent(summaryMsg)}`,
          "_blank",
          "noopener,noreferrer",
        );
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commande impossible. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  // ── Vues ──────────────────────────────────────────────────────────────────

  if (needsMarketSelection) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-2xl font-black text-slate-950">Sélectionne ton marché</p>
        <p className="mt-3 text-sm text-slate-500">
          Choisis ton pays en haut de la page pour accéder au checkout.
        </p>
      </div>
    );
  }

  if (!totalItems && !createdIds.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-slate-950">Panier vide</h1>
        <p className="mt-3 text-sm text-slate-500">Ajoute des produits depuis le feed pour commander.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-[#009688] px-6 text-sm font-black text-white hover:bg-[#00796B]"
        >
          Voir le feed
        </Link>
      </div>
    );
  }

  if (createdIds.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E0F2F1]">
          <CheckCircle2 className="h-8 w-8 text-[#25D366]" />
        </div>
        <h1 className="mt-5 text-3xl font-black text-slate-950">Commandes envoyées !</h1>
        <p className="mt-3 text-sm text-slate-500">
          {createdIds.length} commande{createdIds.length > 1 ? "s" : ""} créée{createdIds.length > 1 ? "s" : ""} et transmise{createdIds.length > 1 ? "s" : ""} à Rivendy.
        </p>
        <div className="mt-4 space-y-2">
          {createdIds.map((id) => (
            <p key={id} className="text-sm font-bold text-[#009688]">✅ {id}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="mt-8 inline-flex h-12 items-center rounded-full bg-[#1A1A1A] px-8 text-sm font-black text-white hover:bg-slate-800"
        >
          Voir mon profil
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">

      {/* ── COLONNE GAUCHE ─────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Résumé groupes vendeurs */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">🛒 Finaliser ma commande</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sellerCount} boutique{sellerCount > 1 ? "s" : ""} · {totalItems} article{totalItems > 1 ? "s" : ""}
          </p>
          <div className="mt-4 space-y-2">
            {groups.map((group) => (
              <div key={group.sellerId} className="rounded-xl bg-[#F5F7FA] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-[#6A5ACD]" />
                    <span className="text-sm font-bold text-slate-900">{group.sellerName}</span>
                  </div>
                  <span className="text-sm font-black text-slate-950">
                    {formatMoney(
                      group.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
                      country,
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {group.items.map((i) => `${i.product.title} × ${i.quantity}`).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Sélecteur mode de livraison */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#009688]" />
            <h2 className="text-base font-black text-slate-950">Mode de livraison</h2>
            <span className="rounded-full bg-[#009688]/10 px-2 py-0.5 text-[10px] font-black text-[#009688]">
              Requis
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DeliveryChip
              icon={<Truck className="h-5 w-5" />}
              label="Livraison"
              sublabel="À domicile"
              selected={deliveryMode === "delivery"}
              color="#007168"
              onClick={() => setDeliveryMode("delivery")}
            />
            <DeliveryChip
              icon={<Store className="h-5 w-5" />}
              label="Retrait"
              sublabel="Chez le vendeur"
              selected={deliveryMode === "pickup"}
              color="#6A5ACD"
              onClick={() => setDeliveryMode("pickup")}
            />
          </div>

          {/* Champ zone — livraison uniquement */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              deliveryMode === "delivery" ? "mt-4 max-h-24 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-1.5">
              <Label htmlFor="buyerZone" className="text-sm font-bold text-slate-700">
                Votre quartier / zone de livraison
              </Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00C4B4]" />
                <Input
                  id="buyerZone"
                  value={buyerZone}
                  onChange={(e) => setBuyerZone(e.target.value)}
                  placeholder="Balbala, Héron, PK12..."
                  className="pl-9"
                  required={deliveryMode === "delivery"}
                />
              </div>
            </div>
          </div>

          {/* Badge retrait personnel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              deliveryMode === "pickup" ? "mt-4 max-h-16 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex items-center gap-2 rounded-xl border border-[#6A5ACD]/25 bg-[#6A5ACD]/07 p-3">
              <Store className="h-4 w-4 shrink-0 text-[#6A5ACD]" />
              <p className="text-sm font-bold text-[#6A5ACD]">
                Retrait personnel chez le vendeur — coordonnées envoyées par Rivendy
              </p>
            </div>
          </div>
        </section>

        {/* Informations acheteur */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-black text-slate-950">Vos informations</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="buyerName" className="text-sm font-bold text-slate-700">
                Nom complet
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00C4B4]" />
                <Input
                  id="buyerName"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="buyerPhone" className="text-sm font-bold text-slate-700">
                Numéro WhatsApp
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00C4B4]" />
                <Input
                  id="buyerPhone"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+253 77 00 00 00"
                  type="tel"
                  className="pl-9"
                  required
                />
              </div>
            </div>
          </div>
        </section>

        {/* Méthodes de paiement */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-black text-slate-950">Mode de paiement</h2>
          <div className="space-y-2">
            {activeMethods.map((method) => (
              <PaymentCard
                key={method.id}
                method={method}
                selected={selectedMethod?.id === method.id}
                onClick={() => setSelectedMethod(method)}
              />
            ))}
          </div>

          {/* Référence mobile money */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              selectedMethod?.type !== "cash" && selectedMethod !== null
                ? "mt-4 max-h-24 opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-1.5">
              <Label htmlFor="transactionRef" className="text-sm font-bold text-slate-700">
                Référence de paiement (optionnel)
              </Label>
              <Input
                id="transactionRef"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Numéro de transaction"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ── COLONNE DROITE — RÉSUMÉ ────────────────────────────────────── */}
      <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-xl font-black text-slate-950">Résumé</h2>

        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.sellerId} className="rounded-xl bg-[#F5F7FA] p-3">
              <p className="text-sm font-bold text-slate-900">{group.sellerName}</p>
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-xs text-slate-500">
                    <span className="truncate pr-2">{item.product.title} × {item.quantity}</span>
                    <span className="shrink-0 font-semibold">
                      {formatMoney(item.product.price * item.quantity, country)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Total</span>
            <span className="text-lg font-black text-slate-950">{formatMoney(totalAmount, country)}</span>
          </div>
          {commissionTotal > 0 && (
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-slate-400">dont commission Rivendy</span>
              <span className="font-semibold text-slate-400">{formatMoney(commissionTotal, country)}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-[#E0F2F1] p-3 text-xs font-semibold text-[#009688]">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>WhatsApp s&apos;ouvre sur le numéro officiel Rivendy — jamais celui du vendeur.</span>
        </div>

        <button
          type="submit"
          disabled={!isFormValid || loading}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#25D366] text-sm font-black text-white transition hover:bg-[#1da853] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loading ? (
            <span className="animate-pulse">Création en cours...</span>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-5 w-5" />
              Commander · {formatMoney(totalAmount, country)}
            </>
          )}
        </button>

        {!isFormValid && !loading && (
          <p className="text-center text-xs text-slate-400">
            {!isDeliveryReady
              ? "Sélectionnez un mode de livraison"
              : !selectedMethod
              ? "Sélectionnez un mode de paiement"
              : "Remplissez vos informations"}
          </p>
        )}
      </aside>
    </form>
  );
}

// ── Chip Livraison / Retrait ───────────────────────────────────────────────
function DeliveryChip({
  icon,
  label,
  sublabel,
  selected,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  selected: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-center transition-all duration-200"
      style={{
        borderColor: selected ? color : "#E2E8F0",
        backgroundColor: selected ? `${color}15` : "#F8FAFC",
        color: selected ? color : "#64748B",
      }}
    >
      <span style={{ color: selected ? color : "#94A3B8" }}>{icon}</span>
      <span className="text-sm font-black">{label}</span>
      <span className="text-[11px] font-medium opacity-80">{sublabel}</span>
    </button>
  );
}

// ── Card Méthode de paiement ───────────────────────────────────────────────
function PaymentCard({
  method,
  selected,
  onClick,
}: {
  method: PaymentMethod;
  selected: boolean;
  onClick: () => void;
}) {
  const isCash = method.type === "cash";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-200"
      style={{
        borderColor: selected ? "#25D366" : "#E2E8F0",
        backgroundColor: selected ? "#25D36610" : "#F8FAFC",
      }}
    >
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: selected ? "#25D36620" : "#E2E8F0" }}
      >
        {isCash ? (
          <Banknote className="h-5 w-5" style={{ color: selected ? "#25D366" : "#94A3B8" }} />
        ) : (
          <Phone className="h-5 w-5" style={{ color: selected ? "#25D366" : "#94A3B8" }} />
        )}
      </div>
      <span
        className="flex-1 text-sm"
        style={{
          fontWeight: selected ? 700 : 500,
          color: selected ? "#1A1A1A" : "#64748B",
        }}
      >
        {method.name}
      </span>
      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#25D366]" />}
    </button>
  );
}
