"use client";

import { ShareButton } from "@/components/ui/share-button";

export function StoreNavTabs({
  showFeatured,
  sellerName,
}: {
  showFeatured: boolean;
  sellerName: string;
}) {
  const tabs = [
    { id: "hero", label: "Accueil" },
    { id: "produits", label: "Tous les produits" },
    ...(showFeatured ? [{ id: "nouveautes", label: "Nouveautés" }] : []),
    { id: "avis", label: "Avis" },
    { id: "a-propos", label: "À propos" },
  ];

  const go = (id: string) => {
    if (id === "hero") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="sticky top-[110px] z-20 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur md:top-16">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {t.label}
          </button>
        ))}
      </div>
      <ShareButton
        title={sellerName}
        text={`Découvrez la boutique ${sellerName} sur Rivendy !`}
        className="h-9 w-9 shrink-0"
      />
    </nav>
  );
}
