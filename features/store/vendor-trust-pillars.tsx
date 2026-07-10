import { MessageCircle, ShieldCheck, Verified, Zap } from "lucide-react";
import type { VendorPillars } from "@/services/public-data";

/**
 * Les 3 piliers de performance vendeur — réplique web de `vendor_trust_pillars.dart`.
 *   A. Préparation (délai commande → expédition)
 *   B. Conformité  (% livré sans signalement)
 *   C. Réponse     (% messages < 2h — bientôt)
 * Calculé sur les 100 dernières commandes (RPC get_vendor_pillars).
 */
export function VendorTrustPillars({ pillars }: { pillars: VendorPillars | null }) {
  if (!pillars || pillars.totalOrders <= 0) return null;

  const prep = prepCard(pillars.avgPreparationHours);
  const conf = conformityCard(pillars.conformityRate);
  const resp = responseCard(pillars.responseRate);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[#6A5ACD]" />
        <span className="text-xs font-bold text-slate-600">Performance vendeur</span>
        <span
          className="text-[10px] text-slate-400"
          title="Calculé automatiquement sur les 100 dernières commandes"
        >
          ⓘ
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PillarCard icon={<Zap className="h-3.5 w-3.5" />} label="Préparation" {...prep} />
        <PillarCard icon={<Verified className="h-3.5 w-3.5" />} label="Conformité" {...conf} />
        <PillarCard icon={<MessageCircle className="h-3.5 w-3.5" />} label="Réponse" {...resp} />
      </div>
    </div>
  );
}

type CardData = { value: string; sub: string; color: string; muted?: boolean; title?: string };

function PillarCard({
  icon,
  label,
  value,
  sub,
  color,
  muted,
  title,
}: CardData & { icon: React.ReactNode; label: string }) {
  return (
    <div
      title={title}
      className="rounded-xl border p-2.5"
      style={{ backgroundColor: `${color}12`, borderColor: `${color}33` }}
    >
      <div className="flex items-center gap-1" style={{ color }}>
        {icon}
        <span className="truncate text-[10px] font-semibold text-slate-500">{label}</span>
      </div>
      <p
        className="mt-1.5 text-lg font-black leading-none"
        style={{ color: muted ? "#9CA3AF" : color }}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[9px] font-semibold" style={{ color: muted ? "#9CA3AF" : color }}>
        {sub}
      </p>
    </div>
  );
}

const GREEN = "#4CAF50";
const ORANGE = "#FFA726";
const RED = "#F44336";
const GREY = "#9E9E9E";

function prepCard(hours: number | null): CardData {
  if (hours == null)
    return { value: "—", sub: "Bientôt", color: GREY, muted: true, title: "Délai moyen entre la commande et la remise au livreur" };
  const value = hours < 1 ? "< 1h" : `${Math.round(hours)}h`;
  let sub: string, color: string;
  if (hours < 2) { sub = "⚡ Très rapide"; color = GREEN; }
  else if (hours < 6) { sub = "✅ Rapide"; color = GREEN; }
  else if (hours < 24) { sub = "🕐 Correct"; color = ORANGE; }
  else { sub = "⏳ Lent"; color = RED; }
  return { value, sub, color, title: "Délai moyen entre la commande et la remise au livreur" };
}

function conformityCard(rate: number | null): CardData {
  const title = "Pourcentage de commandes livrées sans signalement de non-conformité";
  if (rate == null) return { value: "—", sub: "Bientôt", color: GREY, muted: true, title };
  const value = `${Math.round(rate)}%`;
  let sub: string, color: string;
  if (rate >= 95) { sub = "🌟 Excellent"; color = GREEN; }
  else if (rate >= 85) { sub = "✅ Bien"; color = GREEN; }
  else if (rate >= 70) { sub = "⚠️ Correct"; color = ORANGE; }
  else { sub = "🔴 À améliorer"; color = RED; }
  return { value, sub, color, title };
}

function responseCard(rate: number | null): CardData {
  const title = "Pourcentage de messages clients répondus en moins de 2 heures";
  if (rate == null)
    return { value: "—", sub: "< 2h", color: GREY, muted: true, title: "Disponible bientôt (nécessite la messagerie)" };
  const value = `${Math.round(rate)}%`;
  let color: string;
  if (rate >= 90) color = GREEN;
  else if (rate >= 70) color = ORANGE;
  else color = RED;
  return { value, sub: "< 2h", color, title };
}
