"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Loader2,
  Plus,
  Store,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney } from "@/lib/utils/format";
import { uploadProductPhotos } from "@/services/image-upload";
import { CATEGORIES, type CategoryId } from "@/types/rivendy";

// ── Constantes ─────────────────────────────────────────────
const MIN_PRODUCTS = 6;
const MAX_PRODUCTS = 20;

const CONDITIONS = ["Comme neuf","Très bon état","Bon état","Satisfaisant","Neuf"];

// ── Calcul commission ───────────────────────────────────────
function calcCommission(price: number, _category: string) {
  const rate = 0.05; // 5% Rivendy
  const commission = price * rate;
  return {
    sellerPrice: price,
    commissionAmount: commission,
    displayPrice: price + commission,
    rateLabel: "5%",
  };
}

// ── Types ──────────────────────────────────────────────────
interface StoreProduct {
  file: File | null;
  preview: string | null;
  title: string;
  price: string;
  description: string;
  category: CategoryId;
  condition: string;
}

function emptyProduct(): StoreProduct {
  return {
    file: null,
    preview: null,
    title: "",
    price: "",
    description: "",
    category: "femme",
    condition: "Comme neuf",
  };
}

type Step = 0 | 1 | 2 | 3;

// ── Composant principal ─────────────────────────────────────
export function CreateStoreForm() {
  const { user } = useAuth();
  const country = useCountryOrDefault();
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [products, setProducts] = useState<StoreProduct[]>(
    Array.from({ length: MIN_PRODUCTS }, emptyProduct),
  );
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishDone, setPublishDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // ── Photo helpers ──────────────────────────────────────────
  const filledCount = products.filter((p) => p.file !== null).length;
  const canGoToStep1 = filledCount >= MIN_PRODUCTS;
  const productsWithPhoto = products.filter((p) => p.file !== null);
  const canGoToReview = productsWithPhoto.every(
    (p) => p.title.trim() && p.price.trim(),
  );

  function updateProduct(index: number, patch: Partial<StoreProduct>) {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleMultiFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    let fileIdx = 0;

    setProducts((prev) => {
      const next = [...prev];
      // 1. Remplir les slots vides
      for (let i = 0; i < next.length && fileIdx < arr.length; i++) {
        if (next[i].file === null) {
          const f = arr[fileIdx++];
          next[i] = { ...next[i], file: f, preview: URL.createObjectURL(f) };
        }
      }
      // 2. Créer de nouveaux slots
      while (fileIdx < arr.length && next.length < MAX_PRODUCTS) {
        const f = arr[fileIdx++];
        next.push({ ...emptyProduct(), file: f, preview: URL.createObjectURL(f) });
      }
      return next;
    });
  }

  function handleSlotFileSelect(index: number, file: File | null) {
    if (!file) return;
    updateProduct(index, { file, preview: URL.createObjectURL(file) });
  }

  function removePhoto(index: number) {
    if (products[index].preview) URL.revokeObjectURL(products[index].preview!);
    updateProduct(index, { file: null, preview: null });
  }

  // ── Publication ────────────────────────────────────────────
  async function publish() {
    if (!user) return;
    setPublishing(true);
    setPublishError(null);
    setPublishedCount(0);
    setStep(3);

    try {
      const withPhoto = productsWithPhoto;
      for (const p of withPhoto) {
        const urls = await uploadProductPhotos(user.id, [p.file!]);
        const rawPrice = parseFloat(p.price) || 0;
        const { commissionAmount, displayPrice } = calcCommission(rawPrice, p.category);

        await supabase.from("products").insert({
          seller_id: user.id,
          title: p.title.trim(),
          description: p.description.trim() || p.title.trim(),
          price: displayPrice,
          seller_price: rawPrice,
          commission_amount: commissionAmount,
          category: p.category,
          condition: ["restaurant", "alimentation"].includes(p.category) ? "Neuf" : p.condition,
          country_id: country.id,
          photos: urls,
          status: "active",
          stock_quantity: 1,
          product_type: "standard",
          size: "",
        });

        setPublishedCount((n) => n + 1);
      }
      setPublishDone(true);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Erreur lors de la publication.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Rendu étapes ───────────────────────────────────────────

  /* ─ ÉTAPE 0 : Photos ─ */
  function renderStep0() {
    return (
      <div className="flex flex-col gap-5">
        {/* Bouton multi-import */}
        <button
          type="button"
          onClick={() => multiFileInputRef.current?.click()}
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#6A5ACD] to-[#9C88E0] p-5 text-left text-white shadow-lg shadow-[#6A5ACD]/25 transition hover:opacity-90"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <CloudUpload className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black">Importer plusieurs photos</p>
            <p className="mt-0.5 text-xs text-white/80">
              Sélectionnez {MIN_PRODUCTS}+ photos en une seule fois depuis votre galerie
            </p>
          </div>
          <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-white/60" />
        </button>

        <input
          ref={multiFileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleMultiFileSelect(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            handleSlotFileSelect(currentProductIndex, f);
          }}
        />

        {/* Séparateur */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          ou ajoutez photo par photo
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Grille */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {products.map((product, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (!product.file) {
                  setCurrentProductIndex(i);
                  fileInputRef.current?.click();
                }
              }}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                product.file
                  ? "border-[#00C4B4]"
                  : "border-dashed border-slate-200 bg-white hover:border-[#6A5ACD]/50"
              }`}
            >
              {product.file && product.preview ? (
                <>
                  <Image src={product.preview} alt="" fill sizes="120px" className="object-cover" />
                  {/* Badge numéro */}
                  <span className="absolute left-1 top-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {i + 1}
                  </span>
                  {/* Supprimer */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <Plus className="h-6 w-6 text-slate-300" />
                  <span className="text-[10px] text-slate-300">Article {i + 1}</span>
                </div>
              )}
            </button>
          ))}

          {/* Bouton ajouter un slot */}
          {products.length < MAX_PRODUCTS && (
            <button
              type="button"
              onClick={() => setProducts((prev) => [...prev, emptyProduct()])}
              className="aspect-square rounded-xl border-2 border-dashed border-[#6A5ACD]/40 bg-white transition hover:border-[#6A5ACD]"
            >
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <Plus className="h-6 w-6 text-[#6A5ACD]/50" />
                <span className="text-[10px] text-[#6A5ACD]/60">Ajouter</span>
              </div>
            </button>
          )}
        </div>

        {/* Barre du bas */}
        <BottomBar
          label={`${filledCount} / ${MIN_PRODUCTS} photos minimum`}
          sub={
            filledCount < MIN_PRODUCTS
              ? `Encore ${MIN_PRODUCTS - filledCount} photo${MIN_PRODUCTS - filledCount > 1 ? "s" : ""} requise${MIN_PRODUCTS - filledCount > 1 ? "s" : ""}`
              : "✅ Vous pouvez continuer"
          }
          subOk={filledCount >= MIN_PRODUCTS}
          btnLabel="Renseigner les détails →"
          onAction={canGoToStep1 ? () => setStep(1) : undefined}
        />
      </div>
    );
  }

  /* ─ ÉTAPE 1 : Détails ─ */
  function renderStep1() {
    const wp = productsWithPhoto;
    const current = wp[currentProductIndex] ?? null;
    if (!current) return null;
    const globalIdx = products.indexOf(current);
    const commission = current.price ? calcCommission(parseFloat(current.price) || 0, current.category) : null;

    return (
      <div className="flex flex-col gap-5">
        {/* Indicateur article + navigation */}
        <div className="flex items-center justify-between">
          <span className="rounded-xl bg-[#6A5ACD]/10 px-3 py-1.5 text-xs font-black text-[#6A5ACD]">
            Article {currentProductIndex + 1} / {wp.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={currentProductIndex === 0}
              onClick={() => setCurrentProductIndex((i) => Math.max(0, i - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentProductIndex >= wp.length - 1}
              onClick={() => setCurrentProductIndex((i) => Math.min(wp.length - 1, i + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#00C4B4] text-[#00C4B4] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Aperçu image */}
        {current.preview && (
          <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-slate-100">
            <Image src={current.preview} alt="" fill sizes="100vw" className="object-cover" />
          </div>
        )}

        {/* Champs */}
        <FormField label="Titre de l'article *" required>
          <input
            value={current.title}
            onChange={(e) => updateProduct(globalIdx, { title: e.target.value })}
            placeholder="Ex : Robe longue fleurie"
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#007168] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <FormField label={`Votre prix (${country.currency_symbol}) *`} required>
          <input
            type="number"
            value={current.price}
            onChange={(e) => updateProduct(globalIdx, { price: e.target.value })}
            placeholder="Ex : 3500"
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#007168] focus:ring-2 focus:ring-[#009688]/20"
          />
          {commission && parseFloat(current.price) > 0 && (
            <div className="mt-2 rounded-xl border border-[#00C4B4]/30 bg-[#00C4B4]/5 p-3 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Votre prix vendeur</span>
                <span className="font-bold">{formatMoney(commission.sellerPrice, country)}</span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>+ Commission Rivendy ({commission.rateLabel})</span>
                <span className="font-bold">{formatMoney(commission.commissionAmount, country)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#00C4B4]/30 pt-2 font-black text-[#00C4B4]">
                <span>💰 Prix affiché aux clients</span>
                <span>{formatMoney(commission.displayPrice, country)}</span>
              </div>
            </div>
          )}
        </FormField>

        <FormField label="Catégorie">
          <select
            value={current.category}
            onChange={(e) => updateProduct(globalIdx, { category: e.target.value as CategoryId })}
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#007168] focus:ring-2 focus:ring-[#009688]/20"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </FormField>

        {!["restaurant", "alimentation"].includes(current.category) && (
          <FormField label="État">
            <select
              value={current.condition}
              onChange={(e) => updateProduct(globalIdx, { condition: e.target.value })}
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#007168] focus:ring-2 focus:ring-[#009688]/20"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label="Description (facultatif)">
          <textarea
            rows={3}
            value={current.description}
            onChange={(e) => updateProduct(globalIdx, { description: e.target.value })}
            placeholder="Décrivez votre article…"
            maxLength={300}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#1A1A1A] outline-none focus:border-[#007168] focus:ring-2 focus:ring-[#009688]/20"
          />
        </FormField>

        <BottomBar
          label="Remplissez les infos de chaque article"
          btnLabel="Voir le récapitulatif →"
          onAction={canGoToReview ? () => { setCurrentProductIndex(0); setStep(2); } : undefined}
        />
      </div>
    );
  }

  /* ─ ÉTAPE 2 : Récapitulatif ─ */
  function renderStep2() {
    const wp = productsWithPhoto;
    return (
      <div className="flex flex-col gap-4">
        {/* Info */}
        <div className="flex items-center gap-2 rounded-2xl bg-[#00C4B4]/10 px-4 py-3 text-sm font-bold text-[#00C4B4]">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {wp.length} article{wp.length > 1 ? "s" : ""} prêt{wp.length > 1 ? "s" : ""} à être publié{wp.length > 1 ? "s" : ""}
        </div>

        {/* Liste récap */}
        <div className="space-y-3">
          {wp.map((p, i) => {
            const commission = p.price ? calcCommission(parseFloat(p.price) || 0, p.category) : null;
            return (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                {p.preview && (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    <Image src={p.preview} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black text-[#1A1A1A]">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                  {commission && parseFloat(p.price) > 0 && (
                    <>
                      <p className="text-xs font-black text-[#00C4B4]">
                        {formatMoney(commission.displayPrice, country)} clients
                      </p>
                      <p className="text-xs text-slate-400">
                        Vous recevrez : {formatMoney(commission.sellerPrice, country)}
                      </p>
                    </>
                  )}
                </div>
                <span className="shrink-0 text-2xl font-black text-slate-200">{i + 1}</span>
              </div>
            );
          })}
        </div>

        <BottomBar
          label="Tout semble correct ?"
          btnLabel="🚀 Créer mon magasin"
          btnColor="bg-[#6A5ACD] hover:bg-[#5849b5]"
          onAction={publish}
        />
      </div>
    );
  }

  /* ─ ÉTAPE 3 : Publication ─ */
  function renderStep3() {
    const total = productsWithPhoto.length;

    if (publishDone) {
      return (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#6A5ACD]/10">
            <Store className="h-12 w-12 text-[#6A5ACD]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#1A1A1A]">Votre magasin est ouvert ! 🎉</h2>
            <p className="mt-2 text-sm text-slate-500">
              {publishedCount} article{publishedCount > 1 ? "s" : ""} mis en vente avec succès.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/store/${user?.id}`)}
            className="flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#6A5ACD] text-sm font-black text-white transition hover:bg-[#5849b5]"
          >
            <Store className="h-5 w-5" />
            Voir mon magasin
          </button>
        </div>
      );
    }

    if (publishError) {
      return (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <div className="text-5xl">❌</div>
          <h2 className="text-xl font-black text-[#1A1A1A]">Une erreur est survenue</h2>
          <p className="max-w-xs text-sm text-slate-500">{publishError}</p>
          <button
            type="button"
            onClick={() => { setStep(2); setPublishError(null); }}
            className="rounded-full bg-[#6A5ACD] px-6 py-3 text-sm font-black text-white transition hover:bg-[#5849b5]"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        <CloudUpload className="h-14 w-14 text-[#6A5ACD]" />
        <div>
          <h2 className="text-xl font-black text-[#1A1A1A]">Publication en cours…</h2>
          <p className="mt-1 text-sm text-slate-500">{publishedCount} / {total} articles publiés</p>
        </div>
        {/* Barre de progression */}
        <div className="w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-3 rounded-full bg-[#6A5ACD] transition-all duration-500"
            style={{ width: total > 0 ? `${(publishedCount / total) * 100}%` : "5%" }}
          />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-[#6A5ACD]" />
      </div>
    );
  }

  // ── Rendu principal ────────────────────────────────────────
  const stepTitles = ["Photos des produits","Détails des produits","Récapitulatif","Publication…"];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">
      {/* Header + progress */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          {step > 0 && step < 3 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#6A5ACD]">
              Étape {step + 1} / {step < 3 ? 3 : 4}
            </p>
            <h1 className="text-2xl font-black text-[#1A1A1A]">{stepTitles[step]}</h1>
          </div>
        </div>
        {step < 3 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-[#6A5ACD] transition-all duration-300"
              style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Contenu */}
      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}

// ── Helpers UI ─────────────────────────────────────────────
function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-slate-600">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function BottomBar({
  label,
  sub,
  subOk,
  btnLabel,
  onAction,
  btnColor = "bg-[#00C4B4] hover:bg-[#009a8e]",
}: {
  label: string;
  sub?: string;
  subOk?: boolean;
  btnLabel: string;
  onAction?: () => void;
  btnColor?: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-center text-sm font-semibold text-[#1A1A1A]">{label}</p>
      {sub && (
        <p className={`mt-0.5 text-center text-xs ${subOk ? "text-[#00C4B4]" : "text-red-500"}`}>
          {sub}
        </p>
      )}
      <button
        type="button"
        disabled={!onAction}
        onClick={onAction}
        className={`mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-sm font-black text-white transition ${
          onAction ? btnColor : "cursor-not-allowed bg-slate-200 text-slate-400"
        }`}
      >
        {btnLabel}
      </button>
    </div>
  );
}
