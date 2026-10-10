"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Film, ImagePlus, Loader2, Lock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { uploadProductPhotos } from "@/services/image-upload";
import {
  CATEGORIES,
  SUBCATEGORIES,
  VENDOR_CATEGORIES,
  isRivendyManagedCategory,
  type CategoryId,
  type Product,
} from "@/types/rivendy";
import { formatMoney } from "@/lib/utils/format";
import { breakdown, getCommissionRate, referenceRate } from "@/lib/utils/commission";
import {
  CONDITION_OPTIONS,
  CONSTRUCTION_CATEGORY_ID,
  CONSTRUCTION_SUBCATEGORIES,
  DEFAULT_CONDITION,
  FASHION_SIZE_OPTIONS,
  MAX_PRODUCT_PHOTOS,
  constructionDescription,
  findConstructionSubcategory,
  findPhaseBListing,
  isFashionCategory,
  isPhaseBCategory,
  phaseBCategoryFor,
} from "@/lib/listings";
import { MAX_VIDEO_SECONDS, readVideoDuration, uploadProductVideo } from "@/lib/video/video-service";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry, useCountryOrDefault } from "@/features/country/country-provider";
import {
  PublishMarketDialog,
  fetchHomeMarketId,
  needsHomeMarketReminder,
} from "@/features/products/publish-market-dialog";
import { cn } from "@/lib/utils/cn";
import { PREORDER_DELAY_OPTIONS, isPreorderEligible, saleModeEditFields, saleModeFields } from "@/lib/utils/preorder-mode";

type EditableProduct = Partial<Product> & {
  id?: string;
  country_id?: string | null;
  listing_type?: string | null;
};

/* ── Séparateur de section ───────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-slate-100 pb-2 text-[13px] font-black uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

const csvList = (v: string | undefined | null) =>
  (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Comparaison stable (tableaux, objets JSON) pour l'édition différentielle. */
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Formulaire de publication / édition — miroir de `sell_screen.dart` et
 * `edit_product_screen.dart` (app). Remis à parité le 2026-10-04 :
 *  - sous-catégorie obligatoire (Femme, Homme, Bébé, Électronique, Maison) ;
 *  - type d'annonce + champs métier (Location, Mariage, Restaurant,
 *    Personnels) et sous-catégorie Construction — sans eux, les annonces
 *    publiées depuis le site échappaient aux filtres de ces univers ;
 *  - mêmes états, tailles et limites que l'app (3 photos) ;
 *  - l'édition n'envoie QUE ce qui a changé (« un formulaire n'écrit que ce
 *    qu'il a édité ») ;
 *  - la publication ne réécrit plus le profil du vendeur (nom, numéro).
 */
export function ProductForm({ product }: { product?: EditableProduct }) {
  const router = useRouter();
  const { user } = useAuth();
  const country = useCountryOrDefault();
  const { countries, setCountryId } = useCountry();
  const isEdit = !!product?.id;

  // Article Rivendy (alimentation, hôtel, pharmacie) : reste ÉDITABLE, sa
  // catégorie s'affiche en lecture seule (§1.10, comme edit_product_screen).
  const lockedCategory = isEdit && isRivendyManagedCategory(String(product?.category ?? ""));

  const initialPhaseB = findPhaseBListing(product?.subcategory);
  const initialConstruction = findConstructionSubcategory(product?.subcategory);
  const initialAttrs = product?.extra_attributes ?? {};

  const [title, setTitle]               = useState(product?.title ?? "");
  const [description, setDescription]   = useState(product?.description ?? "");
  const [sellerPrice, setSellerPrice]   = useState(String(product?.seller_price || product?.price || ""));
  const [category, setCategory]         = useState<CategoryId>(
    (product?.category as CategoryId) || (VENDOR_CATEGORIES[0]?.id as CategoryId) || "femme",
  );
  const [subcategory, setSubcategory]   = useState(
    initialPhaseB || initialConstruction ? "" : (product?.subcategory ?? ""),
  );
  const [phaseBTypeKey, setPhaseBTypeKey] = useState(initialPhaseB?.typeKey ?? "");
  const [phaseBValues, setPhaseBValues] = useState<Record<string, string>>(() => {
    if (!initialPhaseB) return {};
    const out: Record<string, string> = {};
    for (const f of initialPhaseB.fields) if (initialAttrs[f.key]) out[f.key] = String(initialAttrs[f.key]);
    return out;
  });
  const [constructionKey, setConstructionKey] = useState(initialConstruction?.key ?? "");
  const [constructionValues, setConstructionValues] = useState<Record<string, string>>({});
  const [size, setSize]                 = useState(product?.size ?? "");
  const [variantSizes, setVariantSizes] = useState<string[]>(csvList(initialAttrs.sizes));
  const [variantColors, setVariantColors] = useState(initialAttrs.colors ?? "");
  const [condition, setCondition]       = useState(product?.condition ?? DEFAULT_CONDITION);
  const [stock, setStock]               = useState(String(product?.stock_quantity ?? 1));
  // 📦 Mode de vente (2026-10-10) : achat direct ou « Sur commande » —
  // règle et catégories éligibles dans lib/utils/preorder-mode.ts.
  const [preorder, setPreorder]         = useState(product?.product_type === "preorder");
  const [preorderDays, setPreorderDays] = useState<number | null>(product?.delivery_days ?? null);
  const [files, setFiles]               = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(product?.photos ?? []);
  const [video, setVideo]               = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const [notice, setNotice]             = useState("");
  // Rappel du marché d'origine (2026-10-03) : fenêtre ouverte quand le
  // vendeur publie hors du marché de création de son compte.
  const [marketReminder, setMarketReminder] = useState<{ homeId: string; homeName: string } | null>(null);
  // Édition depuis un autre marché que celui de l'article (2026-10-03) :
  // l'enregistrement est refusé et ce marché est proposé.
  const [articleMarket, setArticleMarket] = useState<{ id: string; name: string } | null>(null);
  // Montants enregistrés de l'article (2026-10-03). Même règle que l'app : la
  // RPC de prix ne repasse que si le prix vendeur (au centime près) ou la
  // catégorie changent (PROTECTED_ZONES §1.4).
  const [savedPricing, setSavedPricing] = useState(() => ({
    sellerPrice: Number(product?.seller_price || product?.price || 0),
    category:    product?.category ?? "",
    commission:  Number(product?.commission_amount ?? 0),
    price:       Number(product?.price ?? 0),
  }));

  const previews           = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  const numericSellerPrice = Number(String(sellerPrice).replace(/\s/g, "").replace(",", ".") || 0);
  const isFood             = category === "alimentation";
  const isPhaseB           = isPhaseBCategory(category);
  const isConstruction     = category === CONSTRUCTION_CATEGORY_ID;
  const isFashion          = isFashionCategory(category);
  const subcategoryOptions = !isPhaseB && !isConstruction ? SUBCATEGORIES[category] ?? [] : [];
  const phaseBCategory     = phaseBCategoryFor(category);
  const phaseBListing      = phaseBCategory?.listings.find((l) => l.typeKey === phaseBTypeKey) ?? null;
  const constructionSub    = findConstructionSubcategory(constructionKey);
  // Taille : saisie pour tout sauf alimentation, Phase B et construction (app).
  const showSize           = !isFood && !isPhaseB && !isConstruction;
  const showCondition      = !isFood && !isPhaseB && !isConstruction;
  // Le mode se choisit à la publication et se change à la modification
  // (mêmes règles en base : guard_product_insert / guard_product_privileges).
  // Jamais pour un colis alimentaire.
  const editableType       = !isEdit || ["standard", "preorder"].includes(String(product?.product_type ?? "standard"));
  const canChooseSaleMode  = editableType && isPreorderEligible(category);
  const publishesPreorder  = canChooseSaleMode && preorder;
  const totalPhotos        = existingPhotos.length + files.length;
  const canAddMore         = totalPhotos < MAX_PRODUCT_PHOTOS;
  const pricingChanged     =
    Math.round(numericSellerPrice * 100) !== Math.round(savedPricing.sellerPrice * 100)
    || category !== savedPricing.category;
  const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label ?? category;

  /* ── Aperçu commission ────────────────────────────────────────── */
  const [dbRate, setDbRate] = useState<number | null>(null);
  const effectiveRate = dbRate ?? referenceRate(category);

  useEffect(() => {
    let cancelled = false;
    getCommissionRate(category, country?.id)
      .then((rate) => { if (!cancelled) setDbRate(rate); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [category, country?.id]);

  const preview = isEdit && !pricingChanged
    ? {
        commission:    savedPricing.commission,
        displayPrice:  savedPricing.price,
        effectiveRate: savedPricing.sellerPrice > 0 ? savedPricing.commission / savedPricing.sellerPrice : 0,
      }
    : breakdown(numericSellerPrice, isFood ? 0 : effectiveRate, country?.id);
  const estimatedCommission = preview.commission;
  const estimatedDisplay    = preview.displayPrice;
  const rateLabel = estimatedCommission > 0
    ? `${(preview.effectiveRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
    : effectiveRate > 0 ? "6 à 10 %" : "0 %";

  function changeCategory(next: CategoryId) {
    setCategory(next);
    setDbRate(null);
    // Mêmes remises à zéro que l'app : un sous-type d'une autre catégorie
    // n'a plus de sens.
    setSubcategory("");
    setPhaseBTypeKey("");
    setPhaseBValues({});
    setConstructionKey("");
    setConstructionValues({});
  }

  function onFilesChange(nextFiles: FileList | null) {
    if (!nextFiles) return;
    setFiles((current) => [...current, ...Array.from(nextFiles)].slice(0, MAX_PRODUCT_PHOTOS - existingPhotos.length));
  }

  async function onVideoChange(file: File | null) {
    setVideo(null);
    if (!file) return;
    try {
      const duration = await readVideoDuration(file);
      if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS + 0.5) {
        setError(`Vidéo de ${MAX_VIDEO_SECONDS} secondes maximum : raccourcissez-la avant de l'envoyer.`);
        return;
      }
      setError("");
      setVideo(file);
    } catch {
      setError("Ce fichier vidéo ne peut pas être lu.");
    }
  }

  function toggleSize(value: string) {
    setVariantSizes((current) =>
      current.includes(value) ? current.filter((s) => s !== value) : [...current, value],
    );
  }

  /* ── Validation (mêmes règles que sell_screen) ─────────────────── */
  function validationError(): string | null {
    if (!lockedCategory && isRivendyManagedCategory(category)) {
      return "Cette catégorie est réservée à Rivendy et ne peut pas être publiée depuis ce formulaire.";
    }
    if (!country?.id) return "Sélectionnez votre marché avant de publier.";
    if (!title.trim()) return "Le titre est requis.";
    if (!Number.isFinite(numericSellerPrice) || numericSellerPrice <= 0) {
      return "Saisissez un prix vendeur strictement positif.";
    }
    if (subcategoryOptions.length > 0 && !subcategory) return "Sous-catégorie requise.";
    if (isPhaseB && !phaseBTypeKey) return "Précisez le type d'annonce.";
    if (isConstruction && !constructionKey && !isEdit) return "Précisez la sous-catégorie Construction.";
    // Taille exigée à la publication (sell_screen) ; l'édition ne l'impose pas.
    if (!isEdit && showSize && !size.trim()) return "La taille est requise (« Unique » si elle ne s'applique pas).";
    const stockValue = Number(stock);
    if (!Number.isInteger(stockValue) || stockValue < 1) return "La quantité en stock doit être d'au moins 1.";
    return null;
  }

  /* ── Soumission ─────────────────────────────────────────────────── */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || loading) return;
    setArticleMarket(null);
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!country?.id) return;

    // 🌍 Un article se modifie depuis SON marché (policy products_update_own).
    const articleCountryId = isEdit ? (product?.country_id ?? null) : null;
    if (articleCountryId && articleCountryId !== country.id) {
      const articleCountry = countries.find((c) => c.id === articleCountryId);
      setSuccess("");
      setNotice("");
      setError(`Cet article est publié sur le marché ${articleCountry?.name ?? articleCountryId}. Passe sur ce marché pour le modifier.`);
      setArticleMarket(articleCountry ? { id: articleCountry.id, name: articleCountry.name } : null);
      return;
    }

    // 🌍 Hors de son marché d'origine, publier doit être un CHOIX.
    if (!isEdit) {
      setLoading(true);
      const homeId = await fetchHomeMarketId(supabase, user.id);
      setLoading(false);
      if (homeId && needsHomeMarketReminder(homeId, country.id)) {
        setMarketReminder({
          homeId,
          homeName: countries.find((c) => c.id === homeId)?.name ?? homeId,
        });
        return;
      }
    }
    await publish();
  }

  async function switchToHomeMarket() {
    const reminder = marketReminder;
    setMarketReminder(null);
    if (!reminder) return;
    await setCountryId(reminder.homeId);
    setError("");
    setSuccess("");
    setNotice(`Marché ${reminder.homeName} sélectionné : vérifiez votre prix dans sa monnaie, puis publiez.`);
  }

  async function switchToArticleMarket() {
    const target = articleMarket;
    setArticleMarket(null);
    if (!target) return;
    await setCountryId(target.id);
    setError("");
    setSuccess("");
    setNotice(`Marché ${target.name} sélectionné : vérifiez votre prix dans sa monnaie, puis mettez à jour le produit.`);
  }

  /** extra_attributes : champs Phase B + variantes mode (`_buildExtraAttributes`). */
  function buildExtraAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (isPhaseB) {
      for (const [k, v] of Object.entries(phaseBValues)) if (v.trim()) attrs[k] = v.trim();
    }
    if (isFashion) {
      const sizes = FASHION_SIZE_OPTIONS.filter((s) => variantSizes.includes(s));
      if (sizes.length) attrs.sizes = sizes.join(",");
      if (variantColors.trim()) attrs.colors = variantColors.trim();
    }
    return attrs;
  }

  async function publish() {
    if (!user || !country?.id) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setNotice("");

    try {
      const uploaded = files.length ? await uploadProductPhotos(user.id, files) : [];
      const photos   = [...existingPhotos, ...uploaded].filter(Boolean).slice(0, MAX_PRODUCT_PHOTOS);
      if (!photos.length) throw new Error("Ajoutez au moins une photo du produit.");

      const rate = isFood ? 0 : await getCommissionRate(category, country.id);
      const { commission: commissionAmount, displayPrice } = breakdown(numericSellerPrice, rate, country.id);

      // Marché actif persisté AVANT l'insertion : current_publish_market()
      // le lit. On n'écrit QUE cette colonne — jusqu'au 2026-10-04 la
      // publication réécrivait aussi le nom et le numéro WhatsApp du vendeur
      // avec les valeurs chargées en début de session (destination des
      // retraits comprise).
      if (!isEdit) {
        const { error: marketError } = await supabase
          .from("profiles")
          .update({ active_market_country_id: country.id })
          .eq("id", user.id);
        if (marketError) throw marketError;
      }

      const extraAttributes = buildExtraAttributes();
      const subcategoryValue = isPhaseB
        ? phaseBTypeKey
        : isConstruction
          ? (constructionKey || product?.subcategory || "")
          : subcategory;
      const finalDescription = isConstruction && !isEdit
        ? constructionDescription(description.trim(), constructionSub, constructionValues)
        : description.trim();

      // Valeurs du formulaire, sur le modèle de l'insert de sell_screen.
      const formValues: Record<string, unknown> = {
        title:          title.trim(),
        description:    finalDescription,
        category,
        subcategory:    subcategoryValue,
        size:           showSize ? size.trim() : "",
        condition:      isFood || isPhaseB ? "Neuf" : condition,
        photos,
        stock_quantity: Number(stock),
        ...(isPhaseB && phaseBListing
          ? { listing_type: phaseBListing.listingType, business_type: phaseBListing.businessType }
          : {}),
      };

      if (isEdit && product?.id) {
        // N'envoyer QUE ce qui a changé. Jamais seller_id, country_id ni
        // package_contents : l'ancienne version les renvoyait, et un article
        // validé entre-temps repassait en attente. product_type et
        // delivery_days ne partent que si le vendeur change le mode de vente.
        const patch: Record<string, unknown> = {};
        const original: Record<string, unknown> = {
          title: product.title ?? "",
          description: product.description ?? "",
          category: product.category ?? "",
          subcategory: product.subcategory ?? "",
          size: product.size ?? "",
          condition: product.condition ?? "",
          photos: product.photos ?? [],
          stock_quantity: Number(product.stock_quantity ?? 1),
          listing_type: product.listing_type ?? null,
          business_type: product.business_type ?? null,
        };
        for (const [key, value] of Object.entries(formValues)) {
          if (!same(value, original[key])) patch[key] = value;
        }
        // extra_attributes : on REMPLACE les clés gérées par ce formulaire
        // (une variante retirée doit disparaître) et on garde les autres.
        const managedKeys = new Set<string>([
          ...(isFashion ? ["sizes", "colors"] : []),
          ...(phaseBListing ? phaseBListing.fields.map((f) => f.key) : []),
        ]);
        const mergedAttrs: Record<string, string> = {};
        for (const [k, v] of Object.entries(initialAttrs)) if (!managedKeys.has(k)) mergedAttrs[k] = v;
        Object.assign(mergedAttrs, extraAttributes);
        if (!same(mergedAttrs, initialAttrs)) patch.extra_attributes = mergedAttrs;

        // Mode de vente (2026-10-10) — vide si rien ne change.
        Object.assign(patch, saleModeEditFields({
          currentType:     String(product.product_type ?? "standard"),
          currentDays:     product.delivery_days ?? null,
          initialCategory: String(product.category ?? ""),
          category,
          preorder,
          deliveryDays:    preorderDays,
        }));

        // Annonce refusée : la modifier la RENVOIE en modération (comme l'app).
        const resubmit = product.status === "rejected";
        if (resubmit) {
          patch.status = "pending";
          patch.reject_reason = null;
        }

        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString();
          // Un UPDATE refusé par la RLS ne modifie AUCUNE ligne, sans erreur :
          // on vérifie qu'une ligne a réellement été modifiée.
          const { data: updated, error: updateError } = await supabase
            .from("products")
            .update(patch)
            .eq("id", product.id)
            .select("id");
          if (updateError) throw updateError;
          if (!updated?.length) {
            throw new Error("Modification non enregistrée : vérifiez que vous êtes sur le marché où l'article est publié, puis réessayez.");
          }
        }
        setExistingPhotos(photos);
        setFiles([]);

        if (pricingChanged) {
          const { data: priceResult, error: priceError } = await supabase.rpc(
            "seller_update_product_price",
            { p_product_id: product.id, p_seller_price: numericSellerPrice },
          );
          const result = priceResult as
            { success?: boolean; error?: string; commission_amount?: number; price?: number } | null;
          if (priceError || !result || !result.success) {
            const cause = priceError?.message || result?.error;
            throw new Error(`Modifications enregistrées${resubmit ? " et annonce renvoyée en validation" : ""}, mais le prix n'a pas pu être mis à jour${cause ? ` (${cause})` : ""}. Réessayez.`);
          }
          setSavedPricing({
            sellerPrice: numericSellerPrice,
            category,
            commission:  Number(result.commission_amount ?? commissionAmount),
            price:       Number(result.price ?? displayPrice),
          });
        }

        if (Object.keys(patch).length === 0 && !pricingChanged) {
          setNotice("Aucune modification à enregistrer.");
        } else {
          setSuccess(resubmit
            ? "Annonce modifiée et renvoyée en validation. Elle sera visible après validation par notre équipe."
            : "Produit mis à jour avec succès ✓");
        }
      } else {
        // La base force status 'pending', is_story false, show_in_catalog
        // false, n'admet que 'standard' ou 'preorder' (catégories article)
        // et recalcule la commission (guard_product_insert) : les montants
        // client ne servent qu'à la compatibilité.
        const { data: inserted, error: insertError } = await supabase
          .from("products")
          .insert({
            ...formValues,
            seller_id: user.id,
            country_id: country.id,
            status: "pending",
            // Mode de vente : achat direct, sur commande (+ délai) ou colis.
            ...saleModeFields({
              category,
              preorder: publishesPreorder,
              deliveryDays: preorderDays,
              foodPackage: isFood,
            }),
            ...(Object.keys(extraAttributes).length > 0 ? { extra_attributes: extraAttributes } : {}),
            seller_price: numericSellerPrice,
            commission_amount: commissionAmount,
            price: displayPrice,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        // 🎬 Vidéo : jamais bloquante (§1.9) — l'article photo est déjà créé.
        let videoWarning: string | null = null;
        const newId = (inserted as { id?: string } | null)?.id;
        if (video && newId) {
          setVideoProgress(0);
          videoWarning = await uploadProductVideo(video, newId, (r) => setVideoProgress(r));
          setVideoProgress(null);
        }
        setSuccess(publishesPreorder
          ? "Produit envoyé en modération. Une fois validé, il apparaîtra dans l'onglet « Sur commande », avec son délai."
          : "Produit envoyé en modération. Il sera visible après validation par notre équipe.");
        if (videoWarning) setNotice(videoWarning);

        setTitle(""); setDescription(""); setSellerPrice("");
        setSize(""); setFiles([]); setExistingPhotos([]); setVideo(null);
        setSubcategory(""); setPhaseBTypeKey(""); setPhaseBValues({});
        setConstructionKey(""); setConstructionValues({});
        setVariantSizes([]); setVariantColors(""); setStock("1");
        setPreorder(false); setPreorderDays(null);
      }

      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Publication impossible, réessayez.";
      setError(msg);
    } finally {
      setLoading(false);
      setVideoProgress(null);
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
            placeholder="Décrivez votre produit : matière, origine, défauts éventuels..."
            required
            rows={4}
          />
        </div>
      </div>

      {/* ── Catégorie ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle>Catégorie</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            {lockedCategory ? (
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                <Lock className="h-4 w-4 text-slate-400" />
                {categoryLabel} — gérée par Rivendy
              </div>
            ) : (
              <Select id="category" value={category} onChange={(e) => changeCategory(e.target.value as CategoryId)}>
                {VENDOR_CATEGORIES.map((item) => (
                  <option value={item.id} key={item.id}>{item.label}</option>
                ))}
              </Select>
            )}
          </div>

          {subcategoryOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subcategory">Sous-catégorie</Label>
              <Select id="subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required>
                <option value="">Précisez le type</option>
                {subcategoryOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          )}

          {isPhaseB && phaseBCategory && (
            <div className="space-y-2">
              <Label htmlFor="phaseBType">Type d&apos;annonce</Label>
              <Select
                id="phaseBType"
                value={phaseBTypeKey}
                onChange={(e) => {
                  setPhaseBTypeKey(e.target.value);
                  setPhaseBValues({});
                }}
                required
              >
                <option value="">Précisez le type</option>
                {phaseBCategory.listings.map((l) => (
                  <option key={l.typeKey} value={l.typeKey}>{l.emoji}  {l.label}</option>
                ))}
              </Select>
            </div>
          )}

          {isConstruction && !isEdit && (
            <div className="space-y-2">
              <Label htmlFor="constructionSub">Sous-catégorie Construction</Label>
              <Select
                id="constructionSub"
                value={constructionKey}
                onChange={(e) => {
                  setConstructionKey(e.target.value);
                  setConstructionValues({});
                }}
                required
              >
                <option value="">Précisez la sous-catégorie</option>
                {CONSTRUCTION_SUBCATEGORIES.map((s) => (
                  <option key={s.key} value={s.key}>{s.emoji}  {s.label}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Champs métier — optionnels, ils améliorent la visibilité (app) */}
        {isPhaseB && phaseBListing && phaseBListing.fields.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">
              {phaseBListing.emoji} Détails {phaseBListing.label} (optionnel — améliore la visibilité)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {phaseBListing.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`pb-${f.key}`}>{f.label}</Label>
                  {f.inputType === "dropdown" && f.options.length > 0 ? (
                    <Select
                      id={`pb-${f.key}`}
                      value={phaseBValues[f.key] ?? ""}
                      onChange={(e) => setPhaseBValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    >
                      <option value="">{f.hint || "—"}</option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={`pb-${f.key}`}
                      value={phaseBValues[f.key] ?? ""}
                      inputMode={f.inputType === "number" ? "numeric" : undefined}
                      placeholder={f.hint}
                      onChange={(e) => setPhaseBValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isConstruction && !isEdit && constructionSub && constructionSub.fields.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">
              {constructionSub.emoji} Détails {constructionSub.label} (ajoutés à la description)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {constructionSub.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`cs-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`cs-${f.key}`}
                    value={constructionValues[f.key] ?? ""}
                    inputMode={f.inputType === "number" ? "numeric" : undefined}
                    placeholder={f.hint}
                    onChange={(e) => setConstructionValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Prix ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle>Prix</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price">{isPhaseB || isConstruction ? "Prix / Tarif" : "Votre prix vendeur"}</Label>
            <Input
              id="price"
              value={sellerPrice}
              onChange={(e) => setSellerPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              required
            />
          </div>
          {showSize && (
            <div className="space-y-2">
              <Label htmlFor="size">Taille</Label>
              <Input
                id="size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="M, 42, Unique…"
                required={!isEdit}
              />
            </div>
          )}
        </div>

        {numericSellerPrice > 0 && (
          <div className="rounded-xl border border-[#B2DFDB] bg-[#E0F2F1] p-4">
            <p className="text-[12px] font-black text-[#009688]">Aperçu du prix affiché</p>
            <div className="mt-2 space-y-1 text-[12px] text-[#007168]">
              <div className="flex justify-between">
                <span>Votre prix</span>
                <span className="font-bold">{formatMoney(numericSellerPrice, country)}</span>
              </div>
              <div className="flex justify-between">
                <span>Commission Rivendy ({isFood ? "incluse" : rateLabel})</span>
                <span className="font-bold">+ {formatMoney(estimatedCommission, country)}</span>
              </div>
              <div className="flex justify-between border-t border-[#B2DFDB] pt-1">
                <span className="font-black">Prix acheteur</span>
                <span className="font-black">{formatMoney(estimatedDisplay, country)}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[#009688]/70">
              {estimatedCommission > 0
                ? `Vous encaissez exactement ${formatMoney(numericSellerPrice, country)}. La commission s'ajoute par-dessus.`
                : "Aucune commission sur cette catégorie : vous encaissez 100 % de votre prix."}
            </p>
          </div>
        )}
      </div>

      {/* ── Détails produit ──────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle>Détails</SectionTitle>

        {isFashion && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tailles proposées à l&apos;acheteur</Label>
              <div className="flex flex-wrap gap-2">
                {FASHION_SIZE_OPTIONS.map((s) => {
                  const on = variantSizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      aria-pressed={on}
                      className={cn(
                        "min-w-11 rounded-lg border px-3 py-1.5 text-sm font-bold transition",
                        on ? "border-[#009688] bg-[#009688] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-[#009688]/40",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
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
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {showCondition && (
            <div className="space-y-2">
              <Label htmlFor="condition">État de l&apos;article</Label>
              <Select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {/* Valeur historique (« Correct »…) conservée pour ne pas la perdre à l'édition */}
                {!(CONDITION_OPTIONS as readonly string[]).includes(condition) && (
                  <option value={condition}>{condition}</option>
                )}
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="stock">Quantité en stock</Label>
            <Input
              id="stock"
              type="number"
              min={1}
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Mode de vente — sans ce choix, un article préparé ou commandé
            après l'achat passait pour disponible tout de suite. */}
        {canChooseSaleMode && (
          <div className="space-y-3">
            <Label>Mode de vente</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { on: !preorder, value: false, title: "Achat direct", text: "L'article est prêt, livré dès la commande" },
                { on: preorder, value: true, title: "Sur commande", text: "Préparé ou commandé après l'achat" },
              ] as const).map((m) => (
                <button
                  key={m.title}
                  type="button"
                  onClick={() => setPreorder(m.value)}
                  aria-pressed={m.on}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition",
                    m.on ? "border-[#009688] bg-[#009688]/5" : "border-slate-200 bg-white hover:border-[#009688]/40",
                  )}
                >
                  <span className={cn("block text-sm font-black", m.on ? "text-[#007168]" : "text-[#1A1A1A]")}>{m.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{m.text}</span>
                </button>
              ))}
            </div>
            {preorder && (
              <div className="space-y-2">
                <Label>Délai de livraison annoncé à l&apos;acheteur</Label>
                <div className="flex flex-wrap gap-2">
                  {PREORDER_DELAY_OPTIONS.map((o) => {
                    const on = preorderDays === o.days;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        onClick={() => setPreorderDays(o.days)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-bold transition",
                          on ? "border-[#009688] bg-[#009688] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-[#009688]/40",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <p className="rounded-xl bg-[#FFF4E5] px-3 py-2.5 text-xs leading-5 text-[#8A5A00]">
                  Votre article ira dans l&apos;onglet « Sur commande », avec ce délai. Il n&apos;apparaîtra pas
                  dans l&apos;accueil : l&apos;acheteur sait ainsi qu&apos;il commande un article à préparer.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Photos ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Photos</SectionTitle>
          <span className="text-[11px] font-bold text-slate-400">
            {totalPhotos}/{MAX_PRODUCT_PHOTOS}
          </span>
        </div>

        {canAddMore && (
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#009688] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#00796B]">
              <ImagePlus className="h-4 w-4" />
              Galerie
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFilesChange(e.target.files)} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <Camera className="h-4 w-4" />
              Caméra
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFilesChange(e.target.files)} />
            </label>
          </div>
        )}

        {(existingPhotos.length > 0 || previews.length > 0) && (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {existingPhotos.map((photo, i) => (
              <div key={photo} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                <Image src={photo} alt={`Photo ${i + 1}`} fill sizes="120px" className="object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Principale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setExistingPhotos((current) => current.filter((p) => p !== photo))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
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
                  onClick={() => setFiles((current) => current.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Supprimer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Les 3 photos de l'app : au-delà, l'édition depuis l'app supprimait
            en silence les photos 4 à 8 d'une annonce créée sur le site. */}
        <p className="text-xs font-medium text-slate-400">
          {totalPhotos === 0 ? "Minimum 1 photo requise · " : ""}jusqu&apos;à {MAX_PRODUCT_PHOTOS} photos
        </p>
      </div>

      {/* ── Vidéo (création seulement, comme l'app) ──────────────── */}
      {!isEdit && (
        <div className="space-y-3">
          <SectionTitle>Vidéo (facultative)</SectionTitle>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <Film className="h-4 w-4" />
            {video ? "Changer de vidéo" : "Ajouter une vidéo"}
            <input type="file" accept="video/*" className="hidden" onChange={(e) => void onVideoChange(e.target.files?.[0] ?? null)} />
          </label>
          {video && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="truncate">{video.name}</span>
              <button type="button" onClick={() => setVideo(null)} className="text-xs font-bold text-red-500 hover:underline">
                Retirer
              </button>
            </div>
          )}
          {videoProgress != null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[#009688] transition-all" style={{ width: `${Math.round(videoProgress * 100)}%` }} />
            </div>
          )}
          <p className="text-xs text-slate-400">
            {MAX_VIDEO_SECONDS} secondes maximum. Selon votre formule (Gratuit 3, Certifié 15, Pro illimité par mois).
            Si l&apos;envoi échoue, l&apos;article est publié avec ses photos.
          </p>
        </div>
      )}

      {/* ── Messages retour ──────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <p>{error}</p>
          {articleMarket && (
            <Button type="button" className="mt-3" onClick={() => void switchToArticleMarket()}>
              Passer sur {articleMarket.name}
            </Button>
          )}
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-[#E0F2F1] px-4 py-3 text-sm font-semibold text-[#007168]">
          {success}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          {notice}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Mettre à jour le produit" : "Envoyer en modération"}
      </Button>

      {marketReminder && country && (
        <PublishMarketDialog
          active={country}
          homeName={marketReminder.homeName}
          onPublishHere={() => {
            setMarketReminder(null);
            void publish();
          }}
          onSwitchHome={() => void switchToHomeMarket()}
          onClose={() => setMarketReminder(null)}
        />
      )}
    </form>
  );
}
