import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const compact = (source) => source.replace(/\s+/g, "");
const failures = [];

const productForm = read("features/products/product-form.tsx");
const bulkForm = read("features/seller/create-store-form.tsx");
const comments = read("features/products/product-comments.tsx");
const productPage = read("app/products/[id]/page.tsx");

if (!productForm.includes('"seller_update_product_price"')) {
  failures.push("La modification d'un prix vendeur doit passer par seller_update_product_price.");
}

if (!/status:\s*product\?\.id\s*\?[^:]+:\s*["']pending["']/.test(productForm)) {
  failures.push("Un nouveau produit vendeur doit être envoyé en modération.");
}

if ((bulkForm.match(/\.from\("products"\)\.insert\(/g) ?? []).length !== 1) {
  failures.push("La création en lot doit effectuer une seule insertion atomique de produits.");
}

if (!bulkForm.includes('status: "pending"') || /status:\s*["']active["']/.test(bulkForm)) {
  failures.push("La création en lot ne doit jamais publier directement un produit.");
}

const compactComments = compact(comments);
if (compactComments.includes('.from("product_comments").update(')) {
  failures.push("Le client ne doit pas modifier directement les commentaires.");
}

for (const rpc of ["get_product_comment_likes", "set_product_comment_like", "report_product_comment"]) {
  if (!comments.includes(`"${rpc}"`)) {
    failures.push(`Le flux commentaires doit appeler la RPC ${rpc}.`);
  }
}

if (!productPage.includes("isProductPublished(product)")) {
  failures.push("La fiche produit doit rester accessible quand le stock atteint zéro.");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("✓ Contrats de sécurité web conformes (prix, modération, commentaires, stock). ");
