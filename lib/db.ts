import { Platform } from "react-native";
import type {
  ContinueItem,
  Episode,
  ExportBundle,
  ProfileStats,
  Show,
  ShowStatus,
} from "./types";

/**
 * Episodes don't carry a runtime, so watch time is estimated from a typical TV
 * episode length. This mirrors how other trackers approximate total time.
 */
export const AVG_EPISODE_MINUTES = 42;

/**
 * Storage layer for Episodic.
 *
 * Native (iOS/Android) uses expo-sqlite with real `shows` / `episodes` /
 * `settings` tables. Web uses a localStorage-backed store that implements the
 * exact same high-level API, because expo-sqlite on web needs COOP/COEP headers
 * that the Expo dev server does not set by default. The UI only ever calls the
 * high-level functions exported at the bottom of this file, so it does not care
 * which backend is active.
 */

interface Backend {
  init(): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getShows(status?: ShowStatus): Promise<Show[]>;
  getShow(id: number): Promise<Show | null>;
  upsertShow(show: Show): Promise<void>;
  setShowStatus(id: number, status: ShowStatus): Promise<void>;
  removeShow(id: number): Promise<void>;
  getEpisodes(showId: number): Promise<Episode[]>;
  upsertEpisodes(episodes: Episode[]): Promise<void>;
  setEpisodeWatched(
    showId: number,
    season: number,
    number: number,
    watched: boolean
  ): Promise<void>;
  setSeasonWatched(
    showId: number,
    season: number,
    watched: boolean
  ): Promise<void>;
  allEpisodes(): Promise<Episode[]>;
  clearAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Native SQLite backend
// ---------------------------------------------------------------------------

function createSqliteBackend(): Backend {
  // Lazy require so web bundles never touch expo-sqlite.
  const SQLite = require("expo-sqlite");
  let dbPromise: Promise<any> | null = null;

  async function db() {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync("episodic.db");
    }
    return dbPromise;
  }

  return {
    async init() {
      const d = await db();
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS shows (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          poster_path TEXT,
          overview TEXT,
          first_air_date TEXT,
          status TEXT NOT NULL DEFAULT 'watching',
          added_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS episodes (
          show_id INTEGER NOT NULL,
          season INTEGER NOT NULL,
          number INTEGER NOT NULL,
          title TEXT,
          air_date TEXT,
          watched_at INTEGER,
          PRIMARY KEY (show_id, season, number)
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
    },

    async getSetting(key) {
      const d = await db();
      const row = await d.getFirstAsync(
        "SELECT value FROM settings WHERE key = ?",
        [key]
      );
      return row ? (row.value as string) : null;
    },

    async setSetting(key, value) {
      const d = await db();
      await d.runAsync(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value]
      );
    },

    async getShows(status) {
      const d = await db();
      if (status) {
        return d.getAllAsync(
          "SELECT * FROM shows WHERE status = ? ORDER BY added_at DESC",
          [status]
        );
      }
      return d.getAllAsync("SELECT * FROM shows ORDER BY added_at DESC");
    },

    async getShow(id) {
      const d = await db();
      const row = await d.getFirstAsync("SELECT * FROM shows WHERE id = ?", [
        id,
      ]);
      return (row as Show) ?? null;
    },

    async upsertShow(show) {
      const d = await db();
      await d.runAsync(
        `INSERT INTO shows (id, title, poster_path, overview, first_air_date, status, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           poster_path = excluded.poster_path,
           overview = excluded.overview,
           first_air_date = excluded.first_air_date`,
        [
          show.id,
          show.title,
          show.poster_path,
          show.overview,
          show.first_air_date,
          show.status,
          show.added_at,
        ]
      );
    },

    async setShowStatus(id, status) {
      const d = await db();
      await d.runAsync("UPDATE shows SET status = ? WHERE id = ?", [
        status,
        id,
      ]);
    },

    async removeShow(id) {
      const d = await db();
      await d.runAsync("DELETE FROM episodes WHERE show_id = ?", [id]);
      await d.runAsync("DELETE FROM shows WHERE id = ?", [id]);
    },

    async getEpisodes(showId) {
      const d = await db();
      return d.getAllAsync(
        "SELECT * FROM episodes WHERE show_id = ? ORDER BY season, number",
        [showId]
      );
    },

    async upsertEpisodes(episodes) {
      if (episodes.length === 0) return;
      const d = await db();
      await d.withTransactionAsync(async () => {
        for (const e of episodes) {
          await d.runAsync(
            `INSERT INTO episodes (show_id, season, number, title, air_date, watched_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(show_id, season, number) DO UPDATE SET
               title = excluded.title,
               air_date = excluded.air_date`,
            [e.show_id, e.season, e.number, e.title, e.air_date, e.watched_at]
          );
        }
      });
    },

    async setEpisodeWatched(showId, season, number, watched) {
      const d = await db();
      await d.runAsync(
        "UPDATE episodes SET watched_at = ? WHERE show_id = ? AND season = ? AND number = ?",
        [watched ? Date.now() : null, showId, season, number]
      );
    },

    async setSeasonWatched(showId, season, watched) {
      const d = await db();
      await d.runAsync(
        "UPDATE episodes SET watched_at = ? WHERE show_id = ? AND season = ?",
        [watched ? Date.now() : null, showId, season]
      );
    },

    async allEpisodes() {
      const d = await db();
      return d.getAllAsync("SELECT * FROM episodes ORDER BY show_id, season, number");
    },

    async clearAll() {
      const d = await db();
      await d.execAsync(
        "DELETE FROM episodes; DELETE FROM shows; DELETE FROM settings;"
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Web (localStorage) backend
// ---------------------------------------------------------------------------

function createWebBackend(): Backend {
  const KEY = "episodic.store.v1";

  interface Snapshot {
    shows: Show[];
    episodes: Episode[];
    settings: Record<string, string>;
  }

  function read(): Snapshot {
    try {
      const raw =
        typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) return JSON.parse(raw) as Snapshot;
    } catch {
      // ignore corrupt storage
    }
    return { shows: [], episodes: [], settings: {} };
  }

  function write(snap: Snapshot) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(snap));
    }
  }

  const epKey = (e: { show_id: number; season: number; number: number }) =>
    `${e.show_id}:${e.season}:${e.number}`;

  return {
    async init() {
      read();
    },

    async getSetting(key) {
      return read().settings[key] ?? null;
    },

    async setSetting(key, value) {
      const s = read();
      s.settings[key] = value;
      write(s);
    },

    async getShows(status) {
      const s = read();
      const list = status
        ? s.shows.filter((x) => x.status === status)
        : s.shows;
      return [...list].sort((a, b) => b.added_at - a.added_at);
    },

    async getShow(id) {
      return read().shows.find((x) => x.id === id) ?? null;
    },

    async upsertShow(show) {
      const s = read();
      const existing = s.shows.find((x) => x.id === show.id);
      if (existing) {
        existing.title = show.title;
        existing.poster_path = show.poster_path;
        existing.overview = show.overview;
        existing.first_air_date = show.first_air_date;
      } else {
        s.shows.push(show);
      }
      write(s);
    },

    async setShowStatus(id, status) {
      const s = read();
      const show = s.shows.find((x) => x.id === id);
      if (show) show.status = status;
      write(s);
    },

    async removeShow(id) {
      const s = read();
      s.shows = s.shows.filter((x) => x.id !== id);
      s.episodes = s.episodes.filter((e) => e.show_id !== id);
      write(s);
    },

    async getEpisodes(showId) {
      return read()
        .episodes.filter((e) => e.show_id === showId)
        .sort((a, b) => a.season - b.season || a.number - b.number);
    },

    async upsertEpisodes(episodes) {
      const s = read();
      const map = new Map(s.episodes.map((e) => [epKey(e), e]));
      for (const e of episodes) {
        const found = map.get(epKey(e));
        if (found) {
          found.title = e.title;
          found.air_date = e.air_date;
        } else {
          map.set(epKey(e), { ...e });
        }
      }
      s.episodes = [...map.values()];
      write(s);
    },

    async setEpisodeWatched(showId, season, number, watched) {
      const s = read();
      const e = s.episodes.find(
        (x) => x.show_id === showId && x.season === season && x.number === number
      );
      if (e) e.watched_at = watched ? Date.now() : null;
      write(s);
    },

    async setSeasonWatched(showId, season, watched) {
      const s = read();
      const now = Date.now();
      for (const e of s.episodes) {
        if (e.show_id === showId && e.season === season) {
          e.watched_at = watched ? now : null;
        }
      }
      write(s);
    },

    async allEpisodes() {
      return [...read().episodes].sort(
        (a, b) =>
          a.show_id - b.show_id || a.season - b.season || a.number - b.number
      );
    },

    async clearAll() {
      write({ shows: [], episodes: [], settings: {} });
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const backend: Backend =
  Platform.OS === "web" ? createWebBackend() : createSqliteBackend();

let initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!initPromise) initPromise = backend.init();
  return initPromise;
}

export const getSetting = (key: string) => backend.getSetting(key);
export const setSetting = (key: string, value: string) =>
  backend.setSetting(key, value);

export const getShows = (status?: ShowStatus) => backend.getShows(status);
export const getShow = (id: number) => backend.getShow(id);
export const upsertShow = (show: Show) => backend.upsertShow(show);
export const setShowStatus = (id: number, status: ShowStatus) =>
  backend.setShowStatus(id, status);
export const removeShow = (id: number) => backend.removeShow(id);

export const getEpisodes = (showId: number) => backend.getEpisodes(showId);
export const upsertEpisodes = (episodes: Episode[]) =>
  backend.upsertEpisodes(episodes);
export const setEpisodeWatched = (
  showId: number,
  season: number,
  number: number,
  watched: boolean
) => backend.setEpisodeWatched(showId, season, number, watched);
export const setSeasonWatched = (
  showId: number,
  season: number,
  watched: boolean
) => backend.setSeasonWatched(showId, season, watched);

/** Next unwatched episode per "watching" show, plus progress counts. */
export async function getContinueWatching(): Promise<ContinueItem[]> {
  const shows = await backend.getShows("watching");
  const items: ContinueItem[] = [];
  for (const show of shows) {
    const eps = await backend.getEpisodes(show.id);
    const aired = eps.filter((e) => isReleased(e.air_date));
    const totalCount = eps.length;
    const watchedCount = eps.filter((e) => e.watched_at != null).length;
    const next = aired.find((e) => e.watched_at == null);
    if (next) {
      const lastWatchedAt = eps.reduce(
        (max, e) => (e.watched_at != null && e.watched_at > max ? e.watched_at : max),
        0
      );
      const lastActivityAt = lastWatchedAt || show.added_at;
      items.push({ show, next, watchedCount, totalCount, lastActivityAt });
    }
  }
  return items;
}

/** Aired-in-the-future episodes for tracked (non-dropped) shows, soonest first. */
export async function getUpcoming(): Promise<
  { show: Show; episode: Episode }[]
> {
  const shows = (await backend.getShows()).filter((s) => s.status !== "dropped");
  const now = Date.now();
  const out: { show: Show; episode: Episode }[] = [];
  for (const show of shows) {
    const eps = await backend.getEpisodes(show.id);
    for (const e of eps) {
      if (e.air_date) {
        const t = Date.parse(e.air_date);
        if (!Number.isNaN(t) && t >= now) out.push({ show, episode: e });
      }
    }
  }
  out.sort(
    (a, b) => Date.parse(a.episode.air_date!) - Date.parse(b.episode.air_date!)
  );
  return out;
}

/** Aggregate library-wide stats for the profile screen. */
export async function getProfileStats(): Promise<ProfileStats> {
  const shows = await backend.getShows();
  const episodes = await backend.allEpisodes();

  const showsByStatus: Record<ShowStatus, number> = {
    watching: 0,
    plan: 0,
    completed: 0,
    dropped: 0,
  };
  const showById = new Map<number, Show>();
  let memberSince: number | null = null;
  for (const s of shows) {
    showsByStatus[s.status] += 1;
    showById.set(s.id, s);
    if (memberSince == null || s.added_at < memberSince) memberSince = s.added_at;
  }

  let episodesWatched = 0;
  const watchedByShow = new Map<number, number>();
  const seasonTotal = new Map<string, number>();
  const seasonWatched = new Map<string, number>();
  for (const e of episodes) {
    const sk = `${e.show_id}:${e.season}`;
    seasonTotal.set(sk, (seasonTotal.get(sk) ?? 0) + 1);
    if (e.watched_at != null) {
      episodesWatched += 1;
      watchedByShow.set(e.show_id, (watchedByShow.get(e.show_id) ?? 0) + 1);
      seasonWatched.set(sk, (seasonWatched.get(sk) ?? 0) + 1);
    }
  }

  let seasonsCompleted = 0;
  for (const [sk, total] of seasonTotal) {
    if (total > 0 && seasonWatched.get(sk) === total) seasonsCompleted += 1;
  }

  let topShow: ProfileStats["topShow"] = null;
  for (const [id, watched] of watchedByShow) {
    if (!topShow || watched > topShow.watched) {
      const s = showById.get(id);
      if (s) topShow = { title: s.title, poster_path: s.poster_path, watched };
    }
  }

  const totalMinutes = episodesWatched * AVG_EPISODE_MINUTES;
  const totalHours = Math.floor(totalMinutes / 60);
  const months = Math.floor(totalHours / (24 * 30));
  const afterMonths = totalHours - months * 24 * 30;
  const days = Math.floor(afterMonths / 24);
  const hours = afterMonths % 24;

  return {
    episodesWatched,
    totalEpisodes: episodes.length,
    seasonsCompleted,
    totalShows: shows.length,
    showsByStatus,
    watchTime: { months, days, hours, totalHours, totalMinutes },
    topShow,
    memberSince,
  };
}

export async function exportAll(): Promise<ExportBundle> {
  const shows = await backend.getShows();
  const episodes = await backend.allEpisodes();
  return {
    app: "episodic",
    version: 1,
    exported_at: Date.now(),
    shows,
    episodes,
  };
}

export async function importAll(bundle: ExportBundle): Promise<void> {
  if (bundle.app !== "episodic") throw new Error("Not an Episodic backup file");
  for (const show of bundle.shows) await backend.upsertShow(show);
  await backend.upsertEpisodes(bundle.episodes);
  // Restore watched flags explicitly (upsert only touches title/air_date).
  for (const e of bundle.episodes) {
    if (e.watched_at != null) {
      await backend.setEpisodeWatched(e.show_id, e.season, e.number, true);
    }
  }
}

export const clearAll = () => backend.clearAll();

function isReleased(airDate: string | null): boolean {
  if (!airDate) return true; // unknown air date: treat as available
  const t = Date.parse(airDate);
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}
