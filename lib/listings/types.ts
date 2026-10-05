/**
 * Types des référentiels « annonces métier », miroirs des modèles Dart
 * `PhaseBCategory` / `PhaseBListing` / `PhaseBField` (phase_b_listings.dart)
 * et `ConstructionSubcategory` (construction_subcategory.dart).
 *
 * Stockage en base (identique dans l'app) :
 *  - Phase B : `typeKey` → products.subcategory, `listingType` →
 *    products.listing_type, `businessType` → products.business_type,
 *    champs → products.extra_attributes ;
 *  - Construction : `key` → products.subcategory, champs concaténés dans
 *    la description (« Label: valeur »).
 */

export type PhaseBInputType = "text" | "number" | "dropdown";

export type PhaseBField = {
  key: string;
  label: string;
  hint: string;
  inputType: PhaseBInputType;
  options: string[];
};

export type PhaseBListing = {
  typeKey: string;
  label: string;
  emoji: string;
  listingType: string;
  businessType: string;
  fields: PhaseBField[];
};

export type PhaseBCategory = {
  categoryKey: string;
  label: string;
  emoji: string;
  listings: PhaseBListing[];
};

export type ConstructionField = {
  key: string;
  label: string;
  hint: string;
  inputType: "text" | "number";
};

export type ConstructionSubcategory = {
  key: string;
  label: string;
  emoji: string;
  fields: ConstructionField[];
};
