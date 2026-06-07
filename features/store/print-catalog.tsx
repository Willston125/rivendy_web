"use client";

import { Printer, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/utils/format";
import { type Country } from "@/types/rivendy";

interface PrintCatalogProps {
  seller: {
    id: string;
    store_name?: string | null;
    full_name?: string | null;
    store_description?: string | null;
    avatar_url?: string | null;
  };
  products: Array<{
    id: string;
    title: string;
    price: number;
    photos?: string[] | null;
    category?: string;
    condition?: string | null;
    stock_quantity?: number;
    status: string;
  }>;
  country: Country;
}

export function PrintCatalog({ seller, products, country }: PrintCatalogProps) {
  const [printing, setPrinting] = useState(false);

  const sellerName = seller.store_name || seller.full_name || "Boutique Rivendy";
  const activeProducts = products.filter(
    (p) => p.status === "active" || p.status === "boosted"
  );

  const handlePrint = () => {
    setPrinting(true);
    // Permettre au DOM de s'ajuster si nécessaire
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 500);
  };

  // URL de la boutique pour le QR Code
  const storeUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/store/${seller.id}`
    : `https://rivendy.com/store/${seller.id}`;
  
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(storeUrl)}`;

  return (
    <>
      {/* Bouton d'action sur le site (masqué lors de l'impression) */}
      <button
        onClick={handlePrint}
        disabled={printing || activeProducts.length === 0}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-[#009688] hover:bg-teal-50/20 hover:text-[#009688] disabled:opacity-50 disabled:cursor-not-allowed print:hidden cursor-pointer"
      >
        {printing ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#009688]" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        <span>Imprimer le catalogue</span>
      </button>

      {/* Style d'impression — dangerouslySetInnerHTML évite styled-jsx */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-catalog-container, #print-catalog-container * { visibility: visible; }
          #print-catalog-container { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; }
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
          .print-card-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      ` }} />

      {/* Conteneur masqué à l'écran, visible et structuré pour l'impression */}
      <div id="print-catalog-container" className="hidden print:block w-full text-slate-900 bg-white font-sans">
        {/* En-tête du catalogue */}
        <header className="border-b-4 border-[#009688] pb-6 mb-8 flex items-start justify-between">
          <div className="space-y-2 max-w-[70%]">
            <div className="flex items-center gap-3">
              {seller.avatar_url && (
                <img
                  src={seller.avatar_url}
                  alt={sellerName}
                  className="h-16 w-16 rounded-full object-cover border-2 border-[#E0F2F1]"
                />
              )}
              <div>
                <h1 className="text-3xl font-black text-slate-950 uppercase tracking-tight">{sellerName}</h1>
                <p className="text-xs font-bold text-[#009688] uppercase tracking-widest">Boutique Officielle Rivendy</p>
              </div>
            </div>
            {seller.store_description && (
              <p className="text-xs text-slate-600 leading-relaxed font-medium mt-2">
                {seller.store_description}
              </p>
            )}
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              Catalogue généré le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* QR Code de la boutique */}
          <div className="flex flex-col items-center text-center space-y-1.5 p-2 border border-slate-100 rounded-2xl bg-slate-50">
            <img
              src={qrCodeUrl}
              alt="Scan QR Code"
              className="h-28 w-28 object-contain"
            />
            <p className="text-[9px] font-black text-slate-800 uppercase tracking-wider">Scanner pour commander</p>
            <p className="text-[7px] text-slate-400 font-bold">rivendy.com</p>
          </div>
        </header>

        {/* Corps : Liste des produits */}
        <main>
          <div className="grid grid-cols-3 gap-x-6 gap-y-8">
            {activeProducts.map((product) => {
              const mainPhoto = Array.isArray(product.photos) && product.photos.length > 0
                ? product.photos[0]
                : null;
              
              return (
                <div
                  key={product.id}
                  className="print-card-avoid flex flex-col border border-slate-100 rounded-3xl overflow-hidden bg-white p-3 space-y-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                >
                  {/* Photo produit */}
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-100/50">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
                        <span className="text-xs font-bold">Sans Image</span>
                      </div>
                    )}
                  </div>

                  {/* Infos produit */}
                  <div className="flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <p className="text-[10px] font-bold text-[#009688] uppercase tracking-wider">
                        {product.category || "Général"}
                      </p>
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-2 mt-0.5 min-h-[32px] leading-tight">
                        {product.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">
                        <span>{product.condition || "Excellent état"}</span>
                        <span>•</span>
                        <span>Stock: {product.stock_quantity ?? 1}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                      <p className="text-sm font-black text-slate-950">
                        {formatMoney(product.price, country)}
                      </p>
                      <span className="text-[8px] font-black text-[#009688] bg-[#E0F2F1] px-2 py-0.5 rounded-full uppercase">
                        Disponible
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Pied de page du catalogue */}
        <footer className="mt-12 pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <p>© {new Date().getFullYear()} Rivendy Marketplace. Tous droits réservés.</p>
          <p>Achetez en toute sécurité sur notre site ou application mobile.</p>
        </footer>
      </div>
    </>
  );
}
