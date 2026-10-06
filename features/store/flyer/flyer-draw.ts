import qrcode from "qrcode-generator";
import type { Product } from "@/types/rivendy";
import {
  FLYER_THEMES,
  factPills,
  proChecklist,
  rentSpecs,
  type FlyerSelection,
  type FlyerThemeId,
  type FlyerType,
} from "@/features/store/flyer/flyer-model";

/**
 * Rendu Canvas 2D du flyer — 1080×1920 (statut WhatsApp 9:16), dessiné dans
 * un repère logique 360×640 mis à l'échelle ×3, comme la capture
 * `pixelRatio: 3` de l'app.
 *
 * Canvas plutôt qu'une capture HTML : aucune dépendance, pas de police
 * distante à embarquer. Les images sont chargées en `crossOrigin="anonymous"`
 * (Supabase Storage répond avec CORS) : une image refusée est simplement
 * remplacée par un aplat, le canvas n'est donc jamais « contaminé » et
 * l'export PNG reste possible.
 */

export const FLYER_W = 1080;
export const FLYER_H = 1920;
const S = 3; // échelle logique → pixels
const W = FLYER_W / S; // 360
const H = FLYER_H / S; // 640
const PAD = 20;
const FONT = `"Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`;

export interface FlyerDrawInput {
  type: FlyerType;
  themeId: FlyerThemeId;
  sellerName: string;
  isCertified: boolean;
  rating: number;
  reviews: number;
  storeUrl: string;
  selection: FlyerSelection;
  formatPrice: (value: number) => string;
  /** url → image chargée (absente = aplat de repli). */
  images: Map<string, HTMLImageElement>;
  avatarUrl: string;
}

/** Charge une image pour le canvas ; résout `null` si refusée ou en erreur. */
export function loadFlyerImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function productPhoto(p: Product | null | undefined): string {
  return (p?.photos ?? []).find((u) => typeof u === "string" && u.trim() !== "") ?? "";
}

/* ── Primitives ─────────────────────────────────────────────────── */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`;
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing : Chrome 99+, Safari 17+ ; ignoré ailleurs (sans gravité).
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

/** Tronque `text` avec « … » pour tenir dans `max` px. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Image en mode « cover » dans le rectangle courant (clip déjà posé). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const r = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > r) sw = sh * r;
  else sh = sw / r;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Photo arrondie (ou aplat + emoji de l'univers si absente/refusée). */
function photoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number, y: number, w: number, h: number, r: number,
  primary: string, emoji: string,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  if (img) {
    drawCover(ctx, img, x, y, w, h);
  } else {
    ctx.fillStyle = hexAlpha(primary, 0.22);
    ctx.fillRect(x, y, w, h);
    ctx.font = font(400, Math.min(w, h) * 0.32);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function pricePill(ctx: CanvasRenderingContext2D, text: string, right: number, bottom: number, primary: string, size = 13) {
  ctx.font = font(800, size);
  setSpacing(ctx, 0);
  const tw = ctx.measureText(text).width;
  const w = tw + 20;
  const h = size + 13;
  roundRect(ctx, right - w, bottom - h, w, h, h / 2);
  ctx.fillStyle = primary;
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, right - w / 2, bottom - h / 2 + 0.5);
  return w;
}

function pillsRow(ctx: CanvasRenderingContext2D, pills: string[], y: number, dark: boolean, primary: string) {
  if (pills.length === 0) return;
  ctx.font = font(700, 10);
  setSpacing(ctx, 0);
  const widths = pills.map((p) => ctx.measureText(p).width + 18);
  const gap = 6;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
  let x = (W - total) / 2;
  pills.forEach((p, i) => {
    roundRect(ctx, x, y, widths[i], 22, 11);
    ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = hexAlpha(primary, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = dark ? "#FFFFFF" : "#0F172A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p, x + widths[i] / 2, y + 11.5);
    x += widths[i] + gap;
  });
}

/* ── Composition ────────────────────────────────────────────────── */

export function drawFlyer(canvas: HTMLCanvasElement, input: FlyerDrawInput) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = FLYER_W;
  canvas.height = FLYER_H;
  ctx.setTransform(S, 0, 0, S, 0, 0);

  const t = FLYER_THEMES[input.themeId];
  const text = t.dark ? "#FFFFFF" : "#0F172A";
  const sub = t.dark ? "rgba(255,255,255,0.72)" : "#64748B";
  const { hero, secondary } = input.selection;
  const img = (url: string) => (url ? input.images.get(url) : undefined);

  // 1. Fond : dégradé vertical + halo de la couleur de l'univers.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, t.bgTop);
  bg.addColorStop(1, t.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 40, 0, W * 0.85, 40, 260);
  glow.addColorStop(0, hexAlpha(t.primary, 0.28));
  glow.addColorStop(1, hexAlpha(t.primary, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 2. Identité boutique + sceau Rivendy.
  const avatar = img(input.avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(PAD + 20, 42, 20, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    drawCover(ctx, avatar, PAD, 22, 40, 40);
  } else {
    ctx.fillStyle = t.primary;
    ctx.fillRect(PAD, 22, 40, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font(800, 18);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((input.sellerName.trim()[0] ?? "R").toUpperCase(), PAD + 20, 43);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(PAD + 20, 42, 20, 0, Math.PI * 2);
  ctx.strokeStyle = hexAlpha(t.primary, 0.8);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Sceau « RIVENDY » à droite.
  ctx.font = font(900, 9);
  setSpacing(ctx, 1.5);
  const sealW = ctx.measureText("RIVENDY").width + 16;
  roundRect(ctx, W - PAD - sealW, 32, sealW, 20, 10);
  ctx.fillStyle = "#009688";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RIVENDY", W - PAD - sealW / 2 + 0.75, 42.5);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setSpacing(ctx, 0);
  ctx.font = font(800, 15);
  ctx.fillStyle = text;
  const nameMax = W - PAD * 2 - 50 - sealW - 22;
  const name = fit(ctx, input.sellerName, nameMax);
  ctx.fillText(name, PAD + 50, 40);
  if (input.isCertified) {
    const nx = PAD + 50 + ctx.measureText(name).width + 10;
    ctx.beginPath();
    ctx.arc(nx, 35, 6, 0, Math.PI * 2);
    ctx.fillStyle = t.primary;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font(900, 8);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✓", nx, 35.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.font = font(500, 10.5);
  ctx.fillStyle = sub;
  ctx.fillText(
    input.rating > 0 && input.reviews > 0
      ? `★ ${input.rating.toFixed(1)} · ${input.reviews} avis`
      : "Boutique sur Rivendy",
    PAD + 50,
    55,
  );

  // 3. Titre + sous-titre.
  const headline = input.type === "arrival" ? t.arrivalTitle : input.type === "promo" ? t.promoTitle : t.featuredTitle;
  ctx.textAlign = "center";
  ctx.font = font(900, 21);
  setSpacing(ctx, 2);
  ctx.fillStyle = input.type === "featured" ? t.primary : text;
  ctx.fillText(fit(ctx, headline, W - PAD * 2), W / 2, 98);
  setSpacing(ctx, 0.3);
  ctx.font = font(500, 11);
  ctx.fillStyle = sub;
  ctx.fillText(fit(ctx, t.subtitles[input.type], W - PAD * 2), W / 2, 116);
  setSpacing(ctx, 0);

  // 4. Visuel principal : il occupe toute la hauteur que les sections du
  // dessous (secondaires, pastilles) ne prennent pas.
  const ctaY = H - 106;
  const showSecondary = secondary.length > 0 && input.type !== "featured";
  const cardH = input.type === "arrival" ? 122 : 92;
  const specific = showSecondary
    ? []
    : input.themeId === "rent" ? rentSpecs(hero) : input.themeId === "pro" ? proChecklist(hero) : [];
  const facts = factPills({ isCertified: input.isCertified, rating: input.rating, reviews: input.reviews, hero });
  const below =
    (showSecondary ? cardH + 12 : 0) + (specific.length > 0 ? 30 : 0) + (facts.length > 0 ? 30 : 0);
  const heroTop = 130;
  const heroH = Math.max(200, ctaY - 14 - heroTop - below);
  const heroW = W - PAD * 2;
  if (hero) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, PAD, heroTop, heroW, heroH, 18);
    ctx.fillStyle = t.bgBottom;
    ctx.fill();
    ctx.restore();
    photoBox(ctx, img(productPhoto(hero)), PAD, heroTop, heroW, heroH, 18, t.primary, t.emoji);

    // Dégradé bas pour la lisibilité.
    ctx.save();
    roundRect(ctx, PAD, heroTop, heroW, heroH, 18);
    ctx.clip();
    const shade = ctx.createLinearGradient(0, heroTop + heroH - 100, 0, heroTop + heroH);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = shade;
    ctx.fillRect(PAD, heroTop + heroH - 100, heroW, 100);
    ctx.restore();

    // Badge PROMO (composition Promo uniquement — aucun pourcentage inventé).
    if (input.type === "promo") {
      ctx.font = font(900, 12);
      setSpacing(ctx, 1.5);
      const bw = ctx.measureText("PROMO").width + 22;
      roundRect(ctx, PAD + 12, heroTop + 12, bw, 26, 13);
      ctx.fillStyle = "#FF6B35";
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PROMO", PAD + 12 + bw / 2 + 0.75, heroTop + 25.5);
      setSpacing(ctx, 0);
    }

    // Prix (préfixe/suffixe Location et Séjour sur la Vedette, comme l'app).
    let price = input.formatPrice(hero.price);
    if (input.type === "featured" && input.themeId === "rent") price = `${price} / jour`;
    if (input.type === "featured" && input.themeId === "stay") price = `Dès ${price} / nuit`;
    const pillW = pricePill(ctx, price, PAD + heroW - 12, heroTop + heroH - 12, t.primary, input.type === "arrival" ? 12 : 14);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = font(800, input.type === "arrival" ? 15 : 17);
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6;
    ctx.fillText(fit(ctx, hero.title, heroW - pillW - 36), PAD + 14, heroTop + heroH - 18);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  } else {
    roundRect(ctx, PAD, heroTop, heroW, heroH, 18);
    ctx.fillStyle = hexAlpha(t.primary, 0.12);
    ctx.fill();
    ctx.font = font(600, 13);
    ctx.fillStyle = sub;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Aucun article disponible", W / 2, heroTop + heroH / 2);
  }

  // 5. Secondaires (Arrivage/Promo) ou section factuelle.
  let y = heroTop + heroH + 12;
  if (showSecondary) {
    const n = secondary.length;
    const gap = 8;
    const cw = (W - PAD * 2 - gap * (n - 1)) / n;
    const ch = cardH;
    secondary.forEach((p, i) => {
      const x = PAD + i * (cw + gap);
      roundRect(ctx, x, y, cw, ch, 12);
      ctx.fillStyle = t.dark ? "rgba(255,255,255,0.07)" : "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = t.dark ? "rgba(255,255,255,0.12)" : "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.stroke();
      const ih = ch - 38;
      photoBox(ctx, img(productPhoto(p)), x + 4, y + 4, cw - 8, ih - 4, 9, t.primary, t.emoji);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = font(600, 10);
      ctx.fillStyle = text;
      ctx.fillText(fit(ctx, p.title, cw - 14), x + 7, y + ih + 13);
      ctx.font = font(800, 11);
      ctx.fillStyle = t.primary;
      ctx.fillText(fit(ctx, input.formatPrice(p.price), cw - 14), x + 7, y + ih + 28);
    });
    y += ch + 12;
  }
  if (specific.length > 0) {
    pillsRow(ctx, specific, y, t.dark, t.primary);
    y += 30;
  }
  // Seulement s'il reste la place au-dessus de l'appel à l'action.
  if (facts.length > 0 && y + 22 <= ctaY - 8) pillsRow(ctx, facts, y, t.dark, t.primary);

  // 6. Appel à l'action (vers Rivendy) + QR de la boutique.
  const qrSize = 74;
  const ctaW = W - PAD * 2 - qrSize - 12;
  roundRect(ctx, PAD, ctaY, ctaW, 44, 22);
  ctx.fillStyle = t.ctaBg;
  ctx.fill();
  ctx.font = font(900, 12);
  setSpacing(ctx, 1);
  ctx.fillStyle = t.ctaText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fit(ctx, t.cta, ctaW - 24), PAD + ctaW / 2, ctaY + 22.5);
  setSpacing(ctx, 0);

  ctx.font = font(500, 10.5);
  ctx.fillStyle = sub;
  ctx.fillText(fit(ctx, t.slogan, ctaW), PAD + ctaW / 2, ctaY + 60);
  ctx.font = font(800, 11);
  ctx.fillStyle = text;
  ctx.fillText("www.rivendy.com", PAD + ctaW / 2, ctaY + 78);

  drawQr(ctx, input.storeUrl, W - PAD - qrSize, ctaY - 6, qrSize);
}

/** QR code de la boutique, dessiné module par module (fond blanc). */
function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  roundRect(ctx, x, y, size, size, 10);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  const inner = size - 10;
  const cell = inner / count;
  ctx.fillStyle = "#0F172A";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(x + 5 + c * cell, y + 5 + r * cell, cell + 0.05, cell + 0.05);
      }
    }
  }
}
