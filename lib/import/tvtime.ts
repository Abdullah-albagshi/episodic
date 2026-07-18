import { setShowStatus, upsertEpisodes, upsertShow } from "../db";
import {
  findShowByTvdbId,
  getAllEpisodes,
  posterUrl,
  searchShows,
  type TmdbSearchResult,
} from "../tmdb";
import type { Episode, Show, ShowStatus } from "../types";

/**
 * TV Time GDPR export importer.
 *
 * The official export is `tracking-prod-records-v2.csv`. Its real shape is a
 * flat log keyed by a `key` column:
 *   - `watch-episode-...` rows  = one watched episode (series_name + season/episode)
 *   - `user-series-...` rows    = a followed show (status flags + most-recent progress)
 *   - `tracking-stats` / other  = ignored
 *
 * We drive parsing off the `key` prefix. If a future/older export lacks a `key`
 * column we fall back to a generic "any row with a name + numeric season/episode
 * is a watched episode" heuristic so the importer stays tolerant.
 */

export interface ParsedEpisode {
  season: number;
  number: number;
  /** When the episode was marked watched (from `created_at`), if known. */
  watchedAt: number | null;
}

export interface ParsedShow {
  name: string;
  /** TheTVDB series id from the export, used to match TMDB precisely. */
  tvdbId: number | null;
  status: ShowStatus;
  /** Explicitly-watched episodes (from `watch-episode` rows). */
  episodes: ParsedEpisode[];
  /** Fallback: latest watched episode, used only when no explicit rows exist. */
  progress?: { season: number; number: number };
}

export interface ImportProgress {
  current: number;
  total: number;
  label: string;
}

export interface ImportSummary {
  matched: {
    name: string;
    matchedTitle: string;
    /** Episodes actually marked watched on the matched TMDB show. */
    watched: number;
    /** Episodes the export said were watched (for validation). */
    expected: number;
  }[];
  unmatched: string[];
  failed: { name: string; error: string }[];
}

// --- CSV parsing (RFC-4180-ish: quotes, escaped quotes, newlines in fields) ---

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function findColumn(
  headers: string[],
  keywords: string[],
  exact = false
): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const kw of keywords) {
    const idx = norm.findIndex((h) => (exact ? h === kw : h.includes(kw)));
    if (idx !== -1) return idx;
  }
  return -1;
}

function toInt(value: string | undefined): number | null {
  if (value == null) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Parse a TV Time timestamp ("YYYY-MM-DD HH:MM:SS", UTC) into epoch ms. */
function parseDate(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Space-separated timestamps are UTC; normalize to ISO so they parse as UTC
  // instead of the device's local zone.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : trimmed;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Extract `s_no` / `ep_no` from TV Time's Go-map blob in most_recent_ep_watched. */
function parseProgress(value: string | undefined): {
  season: number;
  number: number;
} | null {
  if (!value) return null;
  const s = /s_no:(\d+)/.exec(value);
  const e = /ep_no:(\d+)/.exec(value);
  if (s && e) return { season: Number(s[1]), number: Number(e[1]) };
  return null;
}

export function parseTvTimeCsv(text: string): ParsedShow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const nameIdx = findColumn(headers, [
    "seriesname",
    "showname",
    "title",
    "series",
    "show",
  ]);
  if (nameIdx === -1) {
    throw new Error(
      "Could not recognize this CSV as a TV Time export (no series name column)."
    );
  }

  const keyIdx = findColumn(headers, ["key"], true);
  const seasonIdx = findColumn(headers, ["seasonnumber"]);
  const episodeIdx = findColumn(headers, ["episodenumber"]);
  const sNoIdx = findColumn(headers, ["sno"], true);
  const epNoIdx = findColumn(headers, ["epno"], true);
  const sIdIdx = findColumn(headers, ["sid"], true); // TheTVDB series id
  const createdIdx = findColumn(headers, ["createdat"]);
  const updatedIdx = findColumn(headers, ["updatedat"]);
  const recentIdx = findColumn(headers, ["mostrecentepwatched"]);
  const forLaterIdx = findColumn(headers, ["isforlater"]);
  const archivedIdx = findColumn(headers, ["isarchived"]);

  // name -> "season:number" -> latest watched timestamp (or null if unknown)
  const watchedByShow = new Map<string, Map<string, number | null>>();
  const info = new Map<
    string,
    { status: ShowStatus; progress: { season: number; number: number } | null }
  >();
  const tvdbByShow = new Map<string, number>();

  const addWatched = (
    name: string,
    season: number,
    number: number,
    watchedAt: number | null
  ) => {
    let eps = watchedByShow.get(name);
    if (!eps) {
      eps = new Map();
      watchedByShow.set(name, eps);
    }
    const key = `${season}:${number}`;
    const prev = eps.get(key);
    // Keep the most recent watch date across rewatches.
    if (prev == null || (watchedAt != null && watchedAt > prev)) {
      eps.set(key, watchedAt);
    }
  };

  const isTrue = (v: string | undefined) =>
    (v ?? "").trim().toLowerCase() === "true";

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const name = (cols[nameIdx] ?? "").trim();
    if (!name) continue;

    const key = keyIdx >= 0 ? cols[keyIdx] ?? "" : "";

    const season = toInt(cols[seasonIdx]) ?? toInt(cols[sNoIdx]);
    const number = toInt(cols[episodeIdx]) ?? toInt(cols[epNoIdx]);
    const tvdbId = sIdIdx >= 0 ? toInt(cols[sIdIdx]) : null;
    if (tvdbId != null && !tvdbByShow.has(name)) tvdbByShow.set(name, tvdbId);
    const watchedAt =
      parseDate(cols[createdIdx]) ?? parseDate(cols[updatedIdx]);

    if (keyIdx >= 0) {
      if (key.startsWith("watch-episode")) {
        if (season != null && number != null)
          addWatched(name, season, number, watchedAt);
      } else if (key.startsWith("user-series")) {
        let status: ShowStatus = "watching";
        if (isTrue(cols[forLaterIdx])) status = "plan";
        else if (isTrue(cols[archivedIdx])) status = "completed";
        info.set(name, { status, progress: parseProgress(cols[recentIdx]) });
      }
      // other key types (tracking-stats, movies, etc.) are ignored
    } else if (season != null && number != null) {
      // Generic fallback for exports without a `key` column.
      addWatched(name, season, number, watchedAt);
    }
  }

  const names = new Set<string>([...watchedByShow.keys(), ...info.keys()]);
  const result: ParsedShow[] = [];
  for (const name of names) {
    const watched = watchedByShow.get(name);
    const meta = info.get(name);
    result.push({
      name,
      tvdbId: tvdbByShow.get(name) ?? null,
      status: meta?.status ?? "watching",
      episodes: watched
        ? [...watched.entries()].map(([k, watchedAt]) => {
            const [s, n] = k.split(":").map(Number);
            return { season: s, number: n, watchedAt };
          })
        : [],
      progress: !watched && meta?.progress ? meta.progress : undefined,
    });
  }
  return result;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Prefer an exact (normalized) title match, else fall back to TMDB's top hit. */
function pickBestMatch(
  results: TmdbSearchResult[],
  name: string
): TmdbSearchResult | null {
  if (results.length === 0) return null;
  const target = normalizeTitle(name);
  return results.find((r) => normalizeTitle(r.name) === target) ?? results[0];
}

/**
 * Decide which TMDB episodes each exported watch maps to, returning
 * "season:number" -> watched_at (ms). Handles two shapes:
 *   1. Seasonal numbering (the normal case): match on season + episode.
 *   2. Absolute numbering (long anime like One Piece tracked as one ascending
 *      count): when the show is a single season in the export but TMDB splits
 *      it into many seasons and seasonal matching mostly fails, map the export's
 *      episode number onto TMDB's aired order instead.
 */
function resolveWatched(
  entry: ParsedShow,
  episodes: Episode[],
  now: number
): Map<string, number> {
  const watched = new Map<string, number>();
  const set = (key: string, at: number) => {
    const prev = watched.get(key);
    if (prev == null || at > prev) watched.set(key, at);
  };

  if (entry.episodes.length > 0) {
    const tmdbKeys = new Set(episodes.map((e) => `${e.season}:${e.number}`));
    const seasonalMatched = entry.episodes.filter((e) =>
      tmdbKeys.has(`${e.season}:${e.number}`)
    ).length;

    const csvSeasons = new Set(entry.episodes.map((e) => e.season));
    const tmdbSeasons = new Set(episodes.map((e) => e.season));
    const looksAbsolute =
      csvSeasons.size === 1 &&
      tmdbSeasons.size > 1 &&
      seasonalMatched < entry.episodes.length * 0.5;

    if (looksAbsolute) {
      const flat = [...episodes].sort(
        (a, b) => a.season - b.season || a.number - b.number
      );
      for (const e of entry.episodes) {
        const target = flat[e.number - 1];
        if (target) set(`${target.season}:${target.number}`, e.watchedAt ?? now);
      }
    } else {
      for (const e of entry.episodes) {
        const key = `${e.season}:${e.number}`;
        if (tmdbKeys.has(key)) set(key, e.watchedAt ?? now);
      }
    }
  } else if (entry.progress) {
    const { season: pS, number: pE } = entry.progress;
    for (const ep of episodes) {
      if (ep.season < pS || (ep.season === pS && ep.number <= pE)) {
        set(`${ep.season}:${ep.number}`, now);
      }
    }
  }

  return watched;
}

export async function runTvTimeImport(
  text: string,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  const parsed = parseTvTimeCsv(text);
  const summary: ImportSummary = { matched: [], unmatched: [], failed: [] };

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    onProgress?.({ current: i + 1, total: parsed.length, label: entry.name });

    try {
      // Resolve the exact show via its TVDB id when available; that avoids the
      // wrong-match problems of name search (e.g. remakes, movies, spin-offs).
      let best: TmdbSearchResult | null = null;
      if (entry.tvdbId != null) {
        best = await findShowByTvdbId(entry.tvdbId);
      }
      if (!best) {
        best = pickBestMatch(await searchShows(entry.name), entry.name);
      }
      if (!best) {
        summary.unmatched.push(entry.name);
        continue;
      }

      const show: Show = {
        id: best.id,
        title: best.name,
        poster_path: best.poster_path,
        overview: best.overview,
        first_air_date: best.first_air_date,
        status: entry.status,
        added_at: Date.now(),
      };
      await upsertShow(show);
      await setShowStatus(best.id, entry.status);

      const episodes = await getAllEpisodes(best.id);
      const now = Date.now();
      const watchedMap = resolveWatched(entry, episodes, now);

      const withWatched: Episode[] = episodes.map((ep) => ({
        ...ep,
        watched_at: watchedMap.get(`${ep.season}:${ep.number}`) ?? null,
      }));
      await upsertEpisodes(withWatched);

      summary.matched.push({
        name: entry.name,
        matchedTitle: best.name,
        watched: watchedMap.size,
        expected: entry.episodes.length || watchedMap.size,
      });
    } catch (err: any) {
      summary.failed.push({
        name: entry.name,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return summary;
}

export { posterUrl };
