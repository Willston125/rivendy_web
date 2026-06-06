import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Fil d'Ariane — convention de navigation des sites web.
 * Composant serveur (liens statiques). Le dernier élément (sans href) est la
 * page courante (non cliquable).
 */
export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 flex items-center gap-1 text-xs text-slate-400">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link href={item.href} className="font-semibold transition-colors hover:text-[#009688]">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-bold text-slate-600" : "font-semibold"}>{item.label}</span>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
          </span>
        );
      })}
    </nav>
  );
}
