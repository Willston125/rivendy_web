"use client";

import { useCallback, useEffect, useState } from "react";
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
};

type UseNotificationsResult = {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
};

export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  /* ── Chargement initial ──────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("app_notifications")
      .select("id, type, title, body, is_read, created_at, product_id, product_image")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) return;
    setNotifications(data as AppNotification[]);
  }, [user]);

  /* ── Realtime : nouvelles notifications ──────────────────────── */
  useEffect(() => {
    load();
    if (!user) return;

    const channel = supabase
      .channel(`app_notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? (payload.new as AppNotification) : n)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  /* ── Actions ─────────────────────────────────────────────────── */
  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    await supabase
      .from("app_notifications")
      .update({ is_read: true })
      .eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("app_notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("app_notifications").delete().eq("id", id);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, markAllRead, markRead, deleteNotification };
}
