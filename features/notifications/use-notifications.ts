"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  product_id?: string | null;
  product_image?: string | null;
  /** Écrit par le serveur — `step` = étape de la commande (parcours du 2026-10-02). */
  metadata?: Record<string, unknown> | null;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  /** Nombre RÉEL de non-lues (compté en base, pas sur les 30 affichées). */
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const COLUMNS = "id, type, title, body, is_read, created_at, product_id, product_image, metadata";

/**
 * Fournisseur UNIQUE des notifications, monté une fois dans `Providers`.
 *
 * Jusqu'au 2026-10-04, chaque composant appelait son propre hook : le header
 * (monté sur toutes les pages) et la page /notifications s'abonnaient au MÊME
 * canal temps réel `app_notifications:<uid>`. realtime-js renvoie alors le
 * canal déjà abonné, et y ajouter un écouteur `postgres_changes` lève
 * « cannot add postgres_changes callbacks after subscribe() » : la page
 * /notifications plantait pour tout utilisateur connecté.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (!error) setUnreadCount(count ?? 0);
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("app_notifications")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error && data) setNotifications(data as AppNotification[]);
    await refreshUnreadCount();
  }, [userId, refreshUnreadCount]);

  useEffect(() => {
    if (!userId) return;
    void load();

    const channel = supabase
      .channel(`app_notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => [row, ...prev.filter((n) => n.id !== row.id)].slice(0, 30));
          if (!row.is_read) setUnreadCount((c) => c + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
          void refreshUnreadCount();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load, refreshUnreadCount]);

  // Déconnexion : rien ne doit survivre du compte précédent.
  const visible = useMemo(() => (userId ? notifications : []), [userId, notifications]);
  const visibleUnread = userId ? unreadCount : 0;

  const markRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      if (!target || target.is_read) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      const { error } = await supabase.from("app_notifications").update({ is_read: true }).eq("id", id);
      if (error) await load(); // la base fait foi : on relit plutôt que d'afficher un faux état
    },
    [notifications, load],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    const { error } = await supabase
      .from("app_notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) await load();
  }, [userId, load]);

  /** Supprime en base ; en cas d'échec, la notification revient (comme l'app). */
  const deleteNotification = useCallback(
    async (id: string) => {
      const removed = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.is_read) setUnreadCount((c) => Math.max(0, c - 1));
      const { data, error } = await supabase.from("app_notifications").delete().eq("id", id).select("id");
      if (error || !data || data.length === 0) {
        await load();
        return false;
      }
      return true;
    },
    [notifications, load],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications: visible,
      unreadCount: visibleUnread,
      markAllRead,
      markRead,
      deleteNotification,
    }),
    [visible, visibleUnread, markAllRead, markRead, deleteNotification],
  );

  return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications doit être utilisé sous NotificationsProvider");
  return context;
}

/** Étape de commande écrite par le serveur dans `metadata.step`. */
export function notificationStep(n: AppNotification): string {
  const step = n.metadata && typeof n.metadata === "object" ? n.metadata["step"] : null;
  return typeof step === "string" ? step : "";
}

/**
 * Destination du clic — miroir de `_tapRoute` (notifications_screen.dart).
 * `null` = la notification ne mène nulle part (sécurité, types inconnus) :
 * l'interface ne doit alors pas la présenter comme cliquable.
 */
export function notificationDestination(n: AppNotification): string | null {
  switch (n.type) {
    case "new_order":
    case "payment": // vendeur payé après confirmation de réception (2026-10-02)
      return "/wallet";
    case "new_product":
    case "new_comment":
    case "product_approved":
      return n.product_id ? `/products/${n.product_id}` : null;
    case "product_rejected":
      // L'article refusé n'est pas publié : sa fiche renverrait une 404.
      // Le vendeur lit le motif dans son espace (comme « Mes ventes » de l'app).
      return "/seller/sales";
    case "review_request":
    case "order_placed":
    case "delivery_code":
      return "/orders";
    default:
      // "security", "delivery_assigned" (espace livreur : app uniquement)
      // et les types inconnus n'ont pas de destination sur le site.
      return null;
  }
}

/** Libellé du lien affiché sous une notification cliquable. */
export function notificationLinkLabel(destination: string): string {
  if (destination === "/wallet") return "Voir mon portefeuille";
  if (destination === "/orders") return "Voir ma commande";
  if (destination === "/seller/sales") return "Voir mes articles";
  return "Voir le produit";
}
