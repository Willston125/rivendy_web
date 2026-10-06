import type { Product } from "@/types/rivendy";
import { isBoosted } from "@/lib/utils/format";

/**
 * Flyer WhatsApp (format statut 9:16) — modèle du site, miroir de
 * rivendy_app/lib/features/store/flyer/ : 3 compositions × 7 univers,
 * univers résolu par la règle des 60 % (FlyerThemeResolver), produit vedette
 * choisi comme FlyerDataMapper.
 *
 * Écarts VOLONTAIRES avec l'app (audit de parité du 2026-10-06) : le flyer
 * n'affiche que des faits réels de la boutique.
 * - pas de « -20 % AUJOURD'HUI SEULEMENT » (Restauration), ni de
 *   « +100 projets / 98 % clients satisfaits » (Services), ni de
 *   caractéristiques véhicule inventées quand l'annonce n'en a pas ;
 * - pastilles = faits vérifiables (certification, note réelle, livraison
 *   déclarée), pas des slogans (« Assurance incluse », « Travail garanti »…) ;
 * - appel à l'action vers Rivendy (QR + rivendy.com), jamais vers le vendeur :
 *   tout contact passe par Rivendy.
 */

export type FlyerType = "arrival" | "promo" | "featured";
export type FlyerThemeId = "standard" | "fashion" | "food" | "stay" | "rent" | "pro" | "creator";

export const FLYER_TYPES: { id: FlyerType; label: string; subtitle: string }[] = [
  { id: "arrival", label: "Arrivage", subtitle: "Nouveautés" },
  { id: "promo", label: "Promo", subtitle: "Offres spéciales" },
  { id: "featured", label: "Vedette", subtitle: "Sélection premium" },
];

export interface FlyerTheme {
  id: FlyerThemeId;
  label: string;
  emoji: string;
  featuredTitle: string;
  arrivalTitle: string;
  promoTitle: string;
  cta: string;
  slogan: string;
  primary: string;
  bgTop: string;
  bgBottom: string;
  ctaBg: string;
  ctaText: string;
  dark: boolean;
  subtitles: Record<FlyerType, string>;
}

/** Libellés et couleurs repris de flyer_theme_type.dart et des thèmes. */
export const FLYER_THEMES: Record<FlyerThemeId, FlyerTheme> = {
  standard: {
    id: "standard", label: "Standard — E-Commerce", emoji: "🛍️",
    featuredTitle: "ARTICLE VEDETTE", arrivalTitle: "NOUVEAUX ARRIVAGES", promoTitle: "OFFRES SPÉCIALES",
    cta: "COMMANDER SUR RIVENDY", slogan: "Commande et livraison via Rivendy",
    primary: "#009688", bgTop: "#0F172A", bgBottom: "#020617", ctaBg: "#009688", ctaText: "#FFFFFF", dark: true,
    subtitles: {
      arrival: "Découvrez nos derniers arrivages",
      promo: "Profitez de nos offres du moment",
      featured: "Notre sélection du moment",
    },
  },
  fashion: {
    id: "fashion", label: "Mode — Lookbook Éditorial", emoji: "👗",
    featuredTitle: "PIÈCE MAÎTRESSE", arrivalTitle: "NOUVELLE COLLECTION", promoTitle: "VENTES PRIVÉES",
    cta: "DÉCOUVRIR SUR RIVENDY", slogan: "Commande et livraison via Rivendy",
    primary: "#D4A373", bgTop: "#FAF6F0", bgBottom: "#EBE2D5", ctaBg: "#D4A373", ctaText: "#1E1410", dark: false,
    subtitles: {
      arrival: "Sélection tendance & nouveautés",
      promo: "Remises sur la collection",
      featured: "La pièce emblématique de la saison",
    },
  },
  food: {
    id: "food", label: "Restauration — Affiche Gourmande", emoji: "🍽️",
    featuredTitle: "LE PLAT DU CHEF", arrivalTitle: "NOUVELLE CARTE", promoTitle: "LE CHEF VOUS GÂTE",
    cta: "COMMANDER SUR RIVENDY", slogan: "Commande via Rivendy",
    primary: "#F59E0B", bgTop: "#160E08", bgBottom: "#0B0704", ctaBg: "#009688", ctaText: "#FFFFFF", dark: true,
    subtitles: {
      arrival: "Fraîchement préparé avec passion",
      promo: "Un plat d'exception à prix doux",
      featured: "La spécialité de la maison",
    },
  },
  stay: {
    id: "stay", label: "Séjour — Prestige Hôtelier", emoji: "🏨",
    featuredTitle: "SÉJOUR D'EXCEPTION", arrivalTitle: "NOUVELLES DISPONIBILITÉS", promoTitle: "OFFRE ESCAPADE",
    cta: "RÉSERVER SUR RIVENDY", slogan: "Réservation via Rivendy",
    primary: "#C69214", bgTop: "#08182B", bgBottom: "#030A12", ctaBg: "#009688", ctaText: "#FFFFFF", dark: true,
    subtitles: {
      arrival: "Disponibilités pour vos prochains séjours",
      promo: "Offre spéciale séjour",
      featured: "Le confort pour votre séjour",
    },
  },
  rent: {
    id: "rent", label: "Location — Dynamisme & Mobilité", emoji: "🚗",
    featuredTitle: "VÉHICULE VEDETTE", arrivalTitle: "NOUVEAUTÉS DU PARC", promoTitle: "OFFRE DU MOMENT",
    cta: "RÉSERVER SUR RIVENDY", slogan: "Réservation via Rivendy",
    primary: "#00A8E8", bgTop: "#091422", bgBottom: "#040A12", ctaBg: "#009688", ctaText: "#FFFFFF", dark: true,
    subtitles: {
      arrival: "Nouveaux véhicules disponibles",
      promo: "Tarif préférentiel du moment",
      featured: "Notre véhicule vedette",
    },
  },
  pro: {
    id: "pro", label: "Services Pro — Confiance & BTP", emoji: "🛠️",
    featuredTitle: "SERVICE VEDETTE", arrivalTitle: "NOUVELLES PRESTATIONS", promoTitle: "OFFRE SUR-MESURE",
    cta: "DEMANDER SUR RIVENDY", slogan: "Demande et suivi via Rivendy",
    primary: "#10B981", bgTop: "#F8FAF9", bgBottom: "#E8EEEC", ctaBg: "#064E3B", ctaText: "#FFFFFF", dark: false,
    subtitles: {
      arrival: "Nos nouvelles prestations",
      promo: "Tarif avantageux du moment",
      featured: "Notre prestation phare",
    },
  },
  creator: {
    id: "creator", label: "Artisanat — Créations & Fait Main", emoji: "🧵",
    featuredTitle: "CRÉATION SIGNATURE", arrivalTitle: "NOUVELLES CRÉATIONS", promoTitle: "SÉLECTION PRIVILÈGE",
    cta: "COMMANDER SUR RIVENDY", slogan: "Commande et livraison via Rivendy",
    primary: "#D97706", bgTop: "#FAF5EE", bgBottom: "#E8DDD0", ctaBg: "#9C5A48", ctaText: "#FFFFFF", dark: false,
    subtitles: {
      arrival: "Créations faites avec cœur",
      promo: "Prix doux sur nos pièces",
      featured: "Une réalisation d'exception",
    },
  },
};

export const FLYER_THEME_IDS = Object.keys(FLYER_THEMES) as FlyerThemeId[];

/** Univers d'un article — miroir de FlyerThemeResolver.mapProductToTheme. */
export function themeForProduct(p: Pick<Product, "category" | "business_type">): FlyerThemeId {
  if (p.business_type === "restaurant") return "food";
  if (p.business_type === "hotel") return "stay";
  switch (p.category) {
    case "femme":
    case "homme":
    case "bebeEnfants":
    case "beauteParfums":
      return "fashion";
    case "alimentation":
    case "restaurant":
      return "food";
    case "hotel":
      return "stay";
    case "location":
      return "rent";
    case "materiauxConstruction":
    case "personnels":
      return "pro";
    case "artisanatLocal":
    case "mariage":
      return "creator";
    default:
      return "standard";
  }
}

/** Règle des 60 % : un univers spécifique s'impose s'il couvre ≥ 60 % du catalogue. */
export function resolveFlyerTheme(products: Pick<Product, "category" | "business_type">[]): FlyerThemeId {
  if (products.length === 0) return "standard";
  const counts = new Map<FlyerThemeId, number>();
  for (const p of products) {
    const t = themeForProduct(p);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const [theme, n] of counts) {
    if (theme !== "standard" && n / products.length >= 0.6) return theme;
  }
  return "standard";
}

export interface FlyerSelection {
  hero: Product | null;
  secondary: Product[];
}

/** Produit vedette + secondaires — miroir de FlyerDataMapper.map. */
export function selectFlyerProducts(products: Product[], type: FlyerType, heroId?: string | null): FlyerSelection {
  if (products.length === 0) return { hero: null, secondary: [] };
  let hero = heroId ? products.find((p) => p.id === heroId) ?? null : null;
  if (!hero) {
    if (type === "promo") hero = products.find((p) => isBoosted(p)) ?? products[0];
    else hero = products[0];
  }
  const others = products.filter((p) => p.id !== hero!.id);
  const secondary = type === "arrival" ? others.slice(0, 3) : type === "promo" ? others.slice(0, 2) : [];
  return { hero, secondary };
}

function attr(p: Product | null, key: string): string {
  return String(p?.extra_attributes?.[key] ?? "").trim();
}

/** Caractéristiques RÉELLES d'un véhicule (vide si l'annonce n'en donne pas). */
export function rentSpecs(hero: Product | null): string[] {
  const specs: string[] = [];
  const places = attr(hero, "places");
  if (places) specs.push(/^\d+$/.test(places) ? `${places} places` : places);
  for (const k of ["carburant", "transmission"]) {
    const v = attr(hero, k);
    if (v) specs.push(v);
  }
  const clim = attr(hero, "climatisation").toLowerCase();
  if (clim === "oui" || clim === "true") specs.push("Climatisation");
  return specs.slice(0, 4);
}

/** Points forts tirés de la DESCRIPTION de la prestation (sinon rien). */
export function proChecklist(hero: Product | null): string[] {
  const lines = (hero?.description ?? "")
    .split(/[\n\r•\-]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 40)
    .slice(0, 3);
  return lines.length >= 2 ? lines : [];
}

/** Pastilles factuelles (certification, note réelle, livraison déclarée). */
export function factPills(opts: {
  isCertified: boolean;
  rating: number;
  reviews: number;
  hero: Product | null;
}): string[] {
  const pills: string[] = [];
  if (opts.isCertified) pills.push("✓ Vendeur certifié");
  if (opts.rating > 0 && opts.reviews > 0) {
    pills.push(`★ ${opts.rating.toFixed(1)} · ${opts.reviews} avis`);
  }
  if (attr(opts.hero, "livraison").toLowerCase().startsWith("oui")) pills.push("Livraison disponible");
  return pills;
}
