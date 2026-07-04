"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { uploadProductPhotos } from "@/services/image-upload";
import { VENDOR_CATEGORIES, type CategoryId, type Product } from "@/types/rivendy";
import { categoryLabel, formatMoney } from "@/lib/utils/format";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";

type EditableProduct = Partial<Product> & { id?: string };

const CONDITION_OPTIONS = ["Neuf", "Très bon état", "Bon état", "Correct"];
const MAX_PHOTOS = 8;

/* ── Séparateur de section ───────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  

  return (
    <p className="border-b border-slate-100 pb-2 text-[13px] font-black uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

export function ProductForm({ product }: { product?: EditableProduct }) {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const countryNullable = useCountryOrDefault();
  const country = countryNullable as any;

  const [title, setTitle]               = useState(product?.title ?? "");
  const [description, setDescription]   = useState(product?.description ?? "");
  const [sellerPrice, setSellerPrice]   = useState(String(product?.seller_price || product?.price || ""));
  const [category, setCategory]         = useState<CategoryId>((product?.category as CategoryId) || "femme");
  const [size, setSize]                 = useState(product?.size ?? "");
  const [variantSizes, setVariantSizes] = useState(product?.extra_attributes?.sizes ?? "");
  const [variantColors, setVariantColors] = useState(product?.extra_attributes?.colors ?? "");
  const [condition, setCondition]       = useState(product?.condition ?? "Bon état");
  const [stock, setStock]               = useState(String(product?.stock_quantity ?? 1));
  const [packageContents, setPackageContents] = useState(product?.package_contents ?? "");
  const [files, setFiles]               = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(product?.photos ?? []);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");

  const previews           = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  const numericSellerPrice = Number(sellerPrice || 0);
  const isFood             = category === "alimentation";
  const showVariants       = ["femme", "homme", "bebeEnfants"].includes(category);
  const totalPhotos        = existingPhotos.length + files.length;
  const canAddMore         = totalPhotos < MAX_PHOTOS;

  /* ── Commission estimate (7 % par défaut) ──────────────────────── */
  const estimatedCommission = Number((numericSellerPrice * 0.07).toFixed(0));
  const estimatedDisplay    = numericSellerPrice + estimatedCommission;

  /* ── Helpers ────────────────────────────────────────────────────── */
  async function getCommissionRate() {
    const { data: rule } = await supabase
      .from("commission_rules")
      .select("rate")
      .eq("country_id", country?.id)
      .eq("category", category)
      .maybeSingle();
    if (rule?.rate != null) return Number(rule.rate) / 100;

    const { data: commission } = await supabase
      .from("commissions")
      .select("rate")
      .eq("country_id", country?.id)
      .eq("category", categoryLabel(category))
      .eq("is_active", true)
      .maybeSingle();
    const rate = Number(commission?.rate ?? 0.07);
    return rate > 1 ? rate / 100 : rate;
  }

  function onFilesChange(nextFiles: FileList | null) {
    if (!nextFiles) return;
    setFiles((current) => [...current, ...Array.from(nextFiles)].slice(0, MAX_PHOTOS - existingPhotos.length));
  }

  function removeExisting(url: string) {
    setExistingPhotos((current) => current.filter((p) => p !== url));
  }

  function removeNew(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  /* ── Soumission ─────────────────────────────────────────────────── */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    // Garde-fou (défense en profondeur) : Pharmacie et Hôtels sont réservées à
    // l'agence Rivendy (dashboard) — jamais publiables par un vendeur.
    if (category === "pharmacie" || category === "hotel") {
      setError("Cette catégorie est réservée à Rivendy et ne peut pas être publiée depuis ce formulaire.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const uploaded = files.length ? await uploadProductPhotos(user.id, files) : [];
      const photos   = [...existingPhotos, ...uploaded].filter(Boolean);
      if (!photos.length) throw new Error("Ajoute au moins une photo du produit.");

      const rate             = isFood ? 0 : await getCommissionRate();
      const commissionAmount = Number((numericSellerPrice * rate).toFixed(2));
      const displayPrice     = Number((numericSellerPrice + commissionAmount).toFixed(2));

      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: profile?.full_name || user.user_metadata?.full_name || "Utilisateur Rivendy",
        whatsapp_number: profile?.whatsapp_number || user.user_metadata?.whatsapp_number || "",
        country_id: country?.id,
        updated_at: new Date().toISOString(),
      });

      // Variantes (vêtements) : tailles + couleurs en CSV, format lu par
      // Product.availableSizes / availableColors côté app.
      const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean).join(",");
      const variantExtra: Record<string, string> = showVariants
        ? {
            ...(product?.extra_attributes ?? {}),
            ...(csv(variantSizes) ? { sizes: csv(variantSizes) } : {}),
            ...(csv(variantColors) ? { colors: csv(variantColors) } : {}),
          }
        : {};

      const payload = {
        seller_id:        user.id,
        title:            title.trim(),
        description:      description.trim(),
        seller_price:     numericSellerPrice,
        commission_amount: commissionAmount,
        price:            displayPrice,
        category,
        size:             isFood ? "" : (showVariants ? csv(variantSizes).split(",")[0] ?? "" : size.trim()),
        condition:        isFood ? "Neuf" : condition,
        photos,
        status:           product?.id ? product.status || "pending" : "pending",
        stock_quantity:   Number(stock || 1),
        product_type:     isFood ? "food_package" : "standard",
        package_contents: isFood ? packageContents.trim() : "",
        ...(showVariants && Object.keys(variantExtra).length > 0 ? { extra_attributes: variantExtra } : {}),
        updated_at:       new Date().toISOString(),
      };

      if (product?.id) {
        const { error: updateError } = await supabase.from("products").update(payload).eq("id", product.id);
        if (updateError) throw updateError;
        setSuccess("Produit mis à jour avec succès ✓");
      } else {
        const { error: insertError } = await supabase.from("products").insert(payload);
        if (insertError) throw insertError;
        setSuccess("Produit envoyé en modération. Il sera visible après validation par notre équipe.");
      }

      await refreshProfile();
      router.refresh();
      if (!product?.id) {
        setTitle(""); setDescription(""); setSellerPrice("");
        setSize(""); setFiles([]); setExistingPhotos([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication impossible, réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">

      {/* ── Informations principales ──────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle>Informations</SectionTitle>

        <div className="space-y-2">
          <Label htmlFor="title">Titre de l&apos;annonce</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Robe longue fleurie taille M — neuve"
            required
            maxLength={90}
          />
          <p className="text-right text-[11px] text-slate-400">{title.length}/90</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décris ton produit : matière, origine, défauts éventuels..."
            required
            rows={4}
          />
        </div>
      </div>

      {/* ── Prix & Catégorie ─────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle>Prix & Catégorie</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price">Ton prix vendeur</Label>
            <Input
              id="price"
              value={sellerPrice}
              onChange={(e) => setSellerPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
            >
              {VENDOR_CATEGORIES.map((item) => (
                <option value={item.id} key={item.id}>{item.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Aperçu prix affiché */}
        {numericSellerPrice > 0 && (
          <div className="rounded-xl border border-[#B2DFDB] bg-[#E0F2F1] p-4">
            <p className="text-[12px] font-black text-[#009688]">Aperçu du prix affiché</p>
            <div className="mt-2 space-y-1 text-[12px] text-[#007168]">
              <div className="flex justify-between">
                <span>Ton prix</span>
                <span className="font-bold">{formatMoney(numericSellerPrice, country)}</span>
              </div>
              <div className="flex justify-between">
                <span>Commission Rivendy (~7%)</span>
                <span className="font-bold">+ {formatMoney(estimatedCommission, country)}</span>
              </div>
              <div className="flex justify-between border-t border-[#B2DFDB] pt-1">
                <span className="font-black">Prix acheteur estimé</span>
                <span className="font-black">{formatMoney(estimatedDisplay, country)}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[#009688]/70">
              * La commission exacte est calculée selon la catégorie et le pays.
            </p>
          </div>
        )}
      </div>

      {/* ── Détails produit ──────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle>Détails</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-3">
          {!isFood && (
            <>
              {showVariants ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sizes">Tailles disponibles</Label>
                    <Input
                      id="sizes"
                      value={variantSizes}
                      onChange={(e) => setVariantSizes(e.target.value)}
                      placeholder="S, M, L, XL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="colors">Couleurs disponibles</Label>
                    <Input
                      id="colors"
                      value={variantColors}
                      onChange={(e) => setVariantColors(e.target.value)}
                      placeholder="Noir, Blanc, Rouge"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="size">Taille / variante</Label>
                  <Input
                    id="size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="M, 42, Unique…"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="condition">État</Label>
                <Select
                  id="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                >
                  {CONDITION_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="stock">Quantité en stock</Label>
            <Input
              id="stock"
              type="number"
              min={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
        </div>

        {isFood && (
          <div className="space-y-2">
            <Label htmlFor="packageContents">Contenu du colis</Label>
            <Textarea
              id="packageContents"
              value={packageContents}
              onChange={(e) => setPackageContents(e.target.value)}
              placeholder="Détaille ce que contient la commande..."
              rows={3}
            />
          </div>
        )}
      </div>

      {/* ── Photos ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Photos</SectionTitle>
          <span className="text-[11px] font-bold text-slate-400">
            {totalPhotos}/{MAX_PHOTOS}
          </span>
        </div>

        {/* Boutons d'ajout */}
        {canAddMore && (
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#009688] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#00796B]">
              <ImagePlus className="h-4 w-4" />
              Galerie
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onFilesChange(e.target.files)}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <Camera className="h-4 w-4" />
              Caméra
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onFilesChange(e.target.files)}
              />
            </label>
          </div>
        )}

        {/* Grille de previews */}
        {(existingPhotos.length > 0 || previews.length > 0) && (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
            {existingPhotos.map((photo, i) => (
              <div key={photo} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                <Image src={photo} alt={`Photo ${i + 1}`} fill sizes="120px" className="object-cover" />
                {/* Badge première photo */}
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Principale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeExisting(photo)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Supprimer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {previews.map((src, i) => (
              <div key={src} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                <Image src={src} alt={`Aperçu ${i + 1}`} fill sizes="120px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeNew(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Supprimer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalPhotos === 0 && (
          <p className="text-xs font-medium text-slate-400">
            Minimum 1 photo requise · jusqu&apos;à {MAX_PHOTOS} photos acceptées
          </p>
        )}
      </div>

      {/* ── Messages retour ──────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-[#E0F2F1] px-4 py-3 text-sm font-semibold text-[#007168]">
          {success}
        </div>
      )}

      {/* ── Bouton soumettre ─────────────────────────────────────── */}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {product?.id ? "Mettre à jour le produit" : "Envoyer en modération"}
      </Button>
    </form>
  );
}
