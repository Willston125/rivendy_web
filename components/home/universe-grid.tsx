"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Un « univers » = une tuile de l'accueil. Miroir de kUniverses (Flutter,
 * universe_grid.dart) : catégorie directe (href) ou groupe (sous-liens). */
type Universe =
  | { label: string; image: string; bg: string; accent: string; href: string; group?: undefined }
  | {
      label: string;
      image: string;
      bg: string;
      accent: string;
      href?: undefined;
      group: { label: string; href: string }[];
    };

function buildUniverses(countryId: string, q?: string): Universe[] {
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const catHref = (id: string) => `/?country=${countryId}&category=${id}${qs}`;

  return [
    { label: "Restaurant", image: "/categories/restaurant.png", bg: "#FFE8E1", accent: "#FF8A65", href: catHref("restaurant") },
    { label: "Supermarché", image: "/categories/supermarche.png", bg: "#EAF8EE", accent: "#66BB6A", href: catHref("alimentation") },
    { label: "Pharmacie", image: "/categories/pharmacie.png", bg: "#E7F8F7", accent: "#26A69A", href: catHref("pharmacie") },
    {
      label: "Mode",
      image: "/categories/mode.png",
      bg: "#FCEBF2",
      accent: "#EC407A",
      group: [
        { label: "Femme", href: catHref("femme") },
        { label: "Homme", href: catHref("homme") },
        { label: "Bébé & Enfants", href: catHref("bebeEnfants") },
      ],
    },
    { label: "Beauté", image: "/categories/beaute.png", bg: "#F4EAFB", accent: "#AB6FD4", href: catHref("beauteParfums") },
    { label: "Maison", image: "/categories/maison.png", bg: "#FFF4E5", accent: "#F0A63E", href: catHref("maison") },
    { label: "Électronique", image: "/categories/electronique.png", bg: "#EAF2FF", accent: "#5B8DEF", href: catHref("electronique") },
    {
      label: "Services",
      image: "/categories/services.png",
      bg: "#EEF1FF",
      accent: "#7C86E0",
      group: [
        { label: "Location", href: catHref("location") },
        { label: "Mariage", href: catHref("mariage") },
        { label: "Hôtels", href: catHref("hotel") },
        { label: "Personnels", href: catHref("personnels") },
        { label: "Construction", href: catHref("materiauxConstruction") },
        { label: "Artisanat", href: catHref("artisanatLocal") },
        { label: "Sur commande", href: "/preorders" },
      ],
    },
  ];
}

/** Grille de 8 tuiles d'univers (accueil web). Tuiles directes → lien ;
 * tuiles groupe (Mode, Services) → menu déroulant de sous-choix. */
export function UniverseGrid({ countryId, q }: { countryId: string; q?: string }) {
  const universes = buildUniverses(countryId, q);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openIndex]);

  return (
    <div ref={containerRef} className="grid grid-cols-4 gap-2.5 sm:gap-3 md:grid-cols-8">
      {universes.map((u, i) => {
        const tile = (
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="flex h-16 w-full items-center justify-center rounded-2xl border transition-transform group-hover:-translate-y-0.5 sm:h-[72px]"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${u.bg} 55%, white), ${u.bg})`,
                borderColor: `color-mix(in srgb, ${u.accent} 22%, transparent)`,
                boxShadow: `0 3px 9px 0 color-mix(in srgb, ${u.accent} 12%, transparent)`,
              }}
            >
              <Image src={u.image} alt={u.label} width={44} height={44} className="h-9 w-9 object-contain sm:h-11 sm:w-11" />
            </div>
            <span className="line-clamp-1 text-center text-[11px] font-bold text-slate-700 sm:text-[12px]">{u.label}</span>
          </div>
        );

        if (u.group) {
          const isOpen = openIndex === i;
          return (
            <div key={u.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="group block w-full"
                aria-expanded={isOpen}
              >
                {tile}
              </button>
              {isOpen && (
                <div className="absolute left-1/2 top-full z-20 mt-2 w-48 -translate-x-1/2 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg">
                  {u.group.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpenIndex(null)}
                      className="block rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-[#009688]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link key={u.label} href={u.href} className="group block">
            {tile}
          </Link>
        );
      })}
    </div>
  );
}
