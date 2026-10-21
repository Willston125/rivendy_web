import { supabase } from "@/lib/supabase/client";
import { EPISODE_COLUMNS, TITLE_COLUMNS, type PlayEpisode, type PlayTitle, type WatchProgress } from "./play-logic";

/**
 * Rivendy Play — lectures et écritures depuis le navigateur (Omnicanal lot C,
 * 2026-10-22). Les MÊMES tables et fonctions que l'app 1.4.9 : une position
 * enregistrée sur le site reprend dans l'app, et inversement.
 */

/** Catalogue d'un marché (jointure sur play_title_countries, comme l'app). */
export async function fetchCatalog(market: string | null, kind?: "film" | "serie" | "clip", limit = 300): Promise<PlayTitle[]> {
  if (!market) return [];
  let q = supabase.from("play_titles").select(`${TITLE_COLUMNS}, play_title_countries!inner(country_id)`)
    .eq("status", "published").eq("play_title_countries.country_id", market);
  q = kind ? q.eq("kind", kind) : q.neq("kind", "clip").neq("kind", "short");
  const { data } = await q.order("published_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as PlayTitle[];
}

export async function fetchTitlesByIds(ids: string[]): Promise<PlayTitle[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("play_titles").select(TITLE_COLUMNS).eq("status", "published").in("id", ids);
  const byId = new Map(((data ?? []) as unknown as PlayTitle[]).map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is PlayTitle => !!t);
}

export async function fetchTopWeek(market: string | null): Promise<string[]> {
  if (!market) return [];
  const { data } = await supabase.rpc("play_top_titles_week", { p_market: market, p_limit: 10 });
  return ((data ?? []) as Array<{ title_id: string }>).map((r) => r.title_id);
}

export async function fetchEpisodes(titleId: string): Promise<PlayEpisode[]> {
  const { data } = await supabase.from("play_episodes").select(EPISODE_COLUMNS).eq("title_id", titleId)
    .eq("status", "published").order("season").order("episode_number");
  return ((data ?? []) as unknown as PlayEpisode[]).filter((e) => e.video_status === "ready");
}

export async function fetchPreview(titleId: string): Promise<{ seconds: number } | null> {
  const { data } = await supabase.from("play_title_previews").select("seconds, status").eq("title_id", titleId).maybeSingle();
  const p = data as { seconds: number; status: string } | null;
  return p && p.status === "ready" ? { seconds: p.seconds } : null;
}

export async function fetchSubtitles(titleId: string, episodeId: string | null): Promise<Array<{ lang: string; url: string }>> {
  let q = supabase.from("play_subtitles").select("lang, url").eq("title_id", titleId);
  q = episodeId ? q.eq("episode_id", episodeId) : q.is("episode_id", null);
  const { data } = await q.order("lang");
  return ((data ?? []) as Array<{ lang: string; url: string }>).filter((s) => s.url.startsWith("https://"));
}

export async function searchTitles(market: string | null, query: string): Promise<PlayTitle[]> {
  const q = query.trim().replace(/[%,()*\\]/g, " ").slice(0, 60);
  if (!market || q.length < 2) return [];
  const { data } = await supabase.from("play_titles").select(`${TITLE_COLUMNS}, play_title_countries!inner(country_id)`)
    .eq("status", "published").eq("play_title_countries.country_id", market).neq("kind", "short")
    .or(`title.ilike.%${q}%,genre.ilike.%${q}%,artist.ilike.%${q}%`).order("published_at", { ascending: false }).limit(60);
  return (data ?? []) as unknown as PlayTitle[];
}

// ── Compte : progression, Ma liste, historique ─────────────────────────────

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function fetchProgress(): Promise<WatchProgress[]> {
  if (!(await uid())) return [];
  const { data } = await supabase.from("play_watch_progress")
    .select("title_id, episode_id, position_seconds, duration_seconds, updated_at")
    .order("updated_at", { ascending: false }).limit(100);
  return (data ?? []) as WatchProgress[];
}

export async function saveProgress(titleId: string, episodeId: string | null, position: number, duration: number): Promise<void> {
  if (!(duration > 0)) return;
  await supabase.rpc("play_save_progress", {
    p_title_id: titleId, p_episode_id: episodeId, p_position: Math.floor(position), p_duration: Math.round(duration),
  });
}

export async function forgetProgress(titleId: string): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { error } = await supabase.from("play_watch_progress").delete().eq("user_id", u).eq("title_id", titleId);
  return !error;
}

export async function fetchMyList(): Promise<string[]> {
  if (!(await uid())) return [];
  const { data } = await supabase.from("play_list").select("title_id").order("created_at", { ascending: false });
  return ((data ?? []) as Array<{ title_id: string }>).map((r) => r.title_id);
}

export async function setInMyList(titleId: string, on: boolean): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { error } = on
    ? await supabase.from("play_list").upsert({ user_id: u, title_id: titleId }, { onConflict: "user_id,title_id", ignoreDuplicates: true })
    : await supabase.from("play_list").delete().eq("user_id", u).eq("title_id", titleId);
  return !error;
}

export async function fetchTitleHistory(): Promise<Array<{ title: PlayTitle; viewed_at: string }>> {
  if (!(await uid())) return [];
  const { data } = await supabase.from("play_view_history").select("target_kind, target_id, viewed_at")
    .eq("target_kind", "title").order("viewed_at", { ascending: false }).limit(120);
  const rows = (data ?? []) as Array<{ target_id: string; viewed_at: string }>;
  const titles = await fetchTitlesByIds(rows.map((r) => r.target_id));
  const byId = new Map(titles.map((t) => [t.id, t]));
  return rows.map((r) => ({ title: byId.get(r.target_id), viewed_at: r.viewed_at }))
    .filter((r): r is { title: PlayTitle; viewed_at: string } => !!r.title);
}

export async function clearTitleHistory(): Promise<boolean> {
  const u = await uid();
  if (!u) return false;
  const { error } = await supabase.from("play_view_history").delete().eq("user_id", u).eq("target_kind", "title");
  return !error;
}

// ── Lecture : jeton, vues, écrans ──────────────────────────────────────────

export type PlaybackGrant = {
  hls_url: string; expires_at: string; premium: boolean; preview: boolean; preview_seconds: number | null;
  playback_session_id: string | null; heartbeat_seconds: number | null;
};
export type PlaybackResult = { ok: true; grant: PlaybackGrant } | { ok: false; error: string };

export async function fetchPlayback(titleId: string, episodeId: string | null, deviceId: string, takeOver = false): Promise<PlaybackResult> {
  const { data, error } = await supabase.functions.invoke("play-playback-token", {
    body: { title_id: titleId, ...(episodeId ? { episode_id: episodeId } : {}), device_id: deviceId, ...(takeOver ? { take_over: true } : {}) },
  });
  if (error) {
    // Jamais journaliser l'erreur : elle peut porter l'adresse signée.
    const ctx = (error as { context?: Response }).context;
    let code = "network";
    if (ctx && typeof ctx.json === "function") {
      try { code = ((await ctx.json()) as { error?: string })?.error ?? code; } catch { /* corps illisible */ }
    }
    return { ok: false, error: code };
  }
  const g = data as PlaybackGrant | null;
  if (!g?.hls_url || !g.hls_url.startsWith("https://")) return { ok: false, error: "bad_response" };
  return { ok: true, grant: g };
}

/** Une vue par jour et par compte (Top 10, historique), comme l'app. */
export async function recordView(titleId: string): Promise<void> {
  await supabase.rpc("play_record_short_event", { p_kind: "title", p_id: titleId, p_action: "view" });
}

export async function viewStart(kind: "title" | "episode", id: string): Promise<number | null> {
  const { data } = await supabase.rpc("play_view_start", { p_kind: kind, p_id: id });
  const r = data as { ok?: boolean; wait_seconds?: number } | null;
  return r?.ok ? Number(r.wait_seconds ?? 30) : null;
}

/** Vue qualifiée : « reason » dit pourquoi elle n'a pas compté (too_early = réessayer). */
export async function viewQualify(kind: "title" | "episode", id: string): Promise<{ counted: boolean; reason: string | null }> {
  const { data, error } = await supabase.rpc("play_view_qualify", { p_kind: kind, p_id: id });
  if (error) return { counted: false, reason: "network" };
  const r = data as { counted?: boolean; reason?: string } | null;
  return { counted: r?.counted === true, reason: r?.reason ?? null };
}

export async function viewProgress(kind: "title" | "episode", id: string, watched: number): Promise<void> {
  await supabase.rpc("play_view_progress", { p_kind: kind, p_id: id, p_watched: Math.round(watched) });
}

export async function playbackPing(sessionId: string): Promise<string | null> {
  const { data } = await supabase.rpc("playback_ping", { p_session: sessionId });
  return ((data as { status?: string } | null)?.status) ?? null;
}

export async function playbackClose(sessionId: string): Promise<void> {
  await supabase.rpc("playback_close", { p_session: sessionId });
}

export async function fetchEpisode(id: string): Promise<PlayEpisode | null> {
  const { data } = await supabase.from("play_episodes").select(EPISODE_COLUMNS).eq("id", id).eq("status", "published").maybeSingle();
  return (data as unknown as PlayEpisode | null) ?? null;
}

/**
 * Dernier envoi à la fermeture de l'onglet (§7.4) : requête `keepalive`, qui
 * part même si la page se décharge. Le jeton d'accès est lu à l'avance (la
 * fermeture ne laisse pas le temps d'attendre une promesse).
 */
export function rpcOnExit(fn: "play_save_progress" | "play_view_progress" | "playback_close", args: Record<string, unknown>, accessToken: string | null): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !accessToken) return;
  try {
    void fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "x-client-info": "supabase-js-web/keepalive" },
      body: JSON.stringify(args),
    }).catch(() => undefined);
  } catch { /* page déjà fermée */ }
}
