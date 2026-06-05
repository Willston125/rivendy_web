"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Trash2,
  Check,
  ShoppingBag,
  Truck,
  MessageCircle,
  ChevronRight,
  Pin,
  Clock,
} from "lucide-react";
import { useNotifications } from "@/features/notifications/use-notifications";
import type { AppNotification } from "@/features/notifications/use-notifications";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function NotificationsView() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markRead, deleteNotification } =
    useNotifications();

  // Extraction du code à 6 chiffres
  const extractCode = (body: string | null) => {
    if (!body) return null;
    const match = body.match(/\b(\d{6})\b/);
    return match ? match[1] : null;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diff / (60 * 1000));
    const diffHours = Math.floor(diff / (60 * 60 * 1000));
    const diffDays = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString("fr-FR");
  };

  const handleNotificationTap = async (n: AppNotification) => {
    await markRead(n.id);
    const isDeliveryCode = n.type === "delivery_code";
    const isOrderPlaced = n.type === "order_placed";

    if (isDeliveryCode || isOrderPlaced) {
      router.push("/orders");
    } else if (n.type === "new_comment" && n.product_id) {
      router.push(`/products/${n.product_id}`);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      {/* En-tête */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E0F2F1] text-[#009688]">
              <Bell className="h-5 w-5" />
            </span>
            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">Notifications</h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {unreadCount > 0
              ? `Vous avez ${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
              : "Toutes vos notifications ont été lues"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            <Check className="h-3.5 w-3.5" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Liste */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
            <Bell className="h-9 w-9" />
          </span>
          <h2 className="mt-5 text-lg font-black text-slate-900">Aucune notification</h2>
          <p className="mt-1.5 max-w-xs text-xs text-slate-500 leading-relaxed">
            Codes de livraison, commentaires, nouveaux messages — tout apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isDeliveryCode = n.type === "delivery_code";
            const isOrderPlaced = n.type === "order_placed";
            const isComment = n.type === "new_comment";
            const code = extractCode(n.body);

            return (
              <div
                key={n.id}
                onClick={() => handleNotificationTap(n)}
                className={cn(
                  "relative flex cursor-pointer gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md",
                  !n.is_read
                    ? isDeliveryCode
                      ? "border-amber-200 bg-amber-50/20"
                      : isOrderPlaced
                      ? "border-green-200 bg-green-50/20"
                      : "border-[#009688]/20 bg-[#009688]/5"
                    : "border-slate-100"
                )}
              >
                {/* Icône à gauche */}
                <div className="shrink-0">
                  {isDeliveryCode ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                      <Truck className="h-5.5 w-5.5" />
                    </span>
                  ) : isOrderPlaced ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-600">
                      <ShoppingBag className="h-5.5 w-5.5" />
                    </span>
                  ) : isComment ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E0F2F1] text-[#009688]">
                      <MessageCircle className="h-5.5 w-5.5" />
                    </span>
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Bell className="h-5.5 w-5.5" />
                    </span>
                  )}
                </div>

                {/* Contenu textuel */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-black",
                        isDeliveryCode
                          ? "text-amber-700"
                          : isOrderPlaced
                          ? "text-green-700"
                          : "text-slate-900"
                      )}
                    >
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isDeliveryCode ? "bg-amber-500" : isOrderPlaced ? "bg-green-500" : "bg-[#009688]"
                        )}
                      />
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600">{n.body}</p>

                  {/* Rendu spécifique pour les codes de livraison */}
                  {isDeliveryCode && code && (
                    <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-1.5 font-bold text-amber-700">
                      <Pin className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs uppercase tracking-wider">Code :</span>
                      <span className="font-mono text-xl tracking-[0.25em]">{code}</span>
                    </div>
                  )}

                  {/* Heure et lien */}
                  <div className="flex items-center gap-2.5 text-[10px] font-semibold text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(n.created_at)}
                    </span>
                    {(isDeliveryCode || isOrderPlaced) && (
                      <span className="flex items-center text-[#009688]">
                        Voir ma commande
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                    {isComment && (
                      <span className="flex items-center text-[#009688]">
                        Voir le produit
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Bouton de suppression */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(n.id);
                  }}
                  className="self-start rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  aria-label="Supprimer la notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
