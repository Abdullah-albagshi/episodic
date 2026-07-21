import {
  SETTING_TVTIME_RUNTIME_SEC,
  setSetting,
  setShowStatus,
  syncShowCompletion,
  upsertEpisodes,
  upsertShow,
} from "../db";
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
  /** Fallback: latest watched episode, used only when no explicit rows exist.
   * `watchedAt` (epoch ms) comes from the blob's `watch_date` when present. */
  progress?: { season: number; number: number; watchedAt: number | null };
  /** Authoritative "episodes seen" from user_tv_show_data.csv, when available. */
  expectedSeen?: number;
  /** When the show was first followed/added (epoch ms), used for `added_at`. */
  followedAt?: number | null;
}

/**
 * The pieces of a TV Time GDPR export we can use. Only `tracking` is required;
 * the others (when supplied) improve status detection and validation.
 */
export interface TvTimeFiles {
  /** tracking-prod-records-v2.csv — the watch log (required). */
  tracking: string;
  /** user_tv_show_data.csv — per-show `nb_episodes_seen` + follow flags. */
  userShowData?: string;
  /** followed_tv_show.csv — active/archived status per show. */
  followed?: string;
  /** user_show_special_status.csv — e.g. for_later → plan. */
  specialStatus?: string;
  /** user_statistics.csv — aggregate totals when tracking-stats is missing. */
  userStatistics?: string;
}

/** One row of user_tv_show_data.csv. */
export interface UserShowDatum {
  tvdbId: number | null;
  name: string;
  seen: number;
  isFollowed: boolean;
}

/** One row of followed_tv_show.csv. */
export interface FollowedDatum {
  tvdbId: number | null;
  name: string;
  active: boolean;
  archived: boolean;
  /** When the show was first followed (epoch ms), if the export provides it. */
  followedAt: number | null;
}

/** One row of user_show_special_status.csv. */
export interface SpecialStatusDatum {
  tvdbId: number | null;
  name: string;
  /** Raw TV Time status string, e.g. "for_later". */
  status: string;
}

/** Safe CSV basenames we pull from a GDPR ZIP (everything else is ignored). */
const SAFE_ZIP_FILES = new Set([
  "tracking-prod-records-v2.csv",
  "tracking-prod-records.csv",
  "followed_tv_show.csv",
  "user_tv_show_data.csv",
  "user_show_special_status.csv",
  "user_statistics.csv",
]);

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
  /** Total real watch time from the export's `tracking-stats` row, if present. */
  totalRuntimeSeconds: number | null;
  /** Episodes TV Time recorded as watched (`ep_watch_count`), for validation. */
  episodeWatchCount: number | null;
}

/** Aggregate figures TV Time stores in the single `tracking-stats` row. */
export interface TvTimeStats {
  totalRuntimeSeconds: number | null;
  episodeWatchCount: number | null;
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

/**
 * Parse a TV Time timestamp into epoch ms, tolerating either the usual
 * "YYYY-MM-DD HH:MM:SS" UTC string or a raw epoch number. Epoch units are
 * disambiguated by magnitude (seconds / milliseconds / microseconds), matching
 * how TV Time renders values like `watch_date` as Go float64s.
 */
function parseTimestamp(value: string | undefined): number | null {
  const asDate = parseDate(value);
  if (asDate != null) return asDate;
  const n = parseScientific(value);
  if (n == null || n <= 0) return null;
  if (n >= 1e15) return Math.round(n / 1000); // microseconds
  if (n >= 1e12) return Math.round(n); // milliseconds
  if (n >= 1e9) return Math.round(n * 1000); // seconds
  return null;
}

/**
 * Parse a numeric token that may be printed in scientific notation. TV Time
 * stores several fields as Go float64s, so ids/timestamps come through like
 * "9.061384e+06" (= 9061384) or "1.652128521883752e+15". Returns null for
 * blank/non-finite values.
 */
function parseScientific(token: string | undefined): number | null {
  if (token == null) return null;
  const t = token.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * The `gsi` column on `watch-episode` rows encodes the watch time as
 * "watch-episode-<unix_seconds>" (e.g. watch-episode-1779114564). Convert the
 * trailing 10+ digit seconds timestamp to epoch ms. Requiring 10+ digits avoids
 * mistaking a shorter episode id for a timestamp.
 */
function parseGsiWatchDate(value: string | undefined): number | null {
  if (!value) return null;
  const m = /watch-episode-(\d{10,})/.exec(value);
  if (!m) return null;
  const secs = Number(m[1]);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

/**
 * Extract most-recent progress from TV Time's Go-map blob in
 * `most_recent_ep_watched`, e.g.
 *   map[ep_id:9.061384e+06 ep_no:5 s_no:1 uuid:... watch_date:1.652128521883752e+15]
 * `watch_date` is epoch microseconds (usually scientific notation); we convert
 * it to epoch ms so the progress fallback carries a real watch time.
 */
function parseProgress(value: string | undefined): {
  season: number;
  number: number;
  watchedAt: number | null;
} | null {
  if (!value) return null;
  const s = /s_no:(\d+)/.exec(value);
  const e = /ep_no:(\d+)/.exec(value);
  if (!s || !e) return null;
  const wd = /watch_date:([0-9eE.+\-]+)/.exec(value);
  const micros = wd ? parseScientific(wd[1]) : null;
  const watchedAt = micros != null ? Math.round(micros / 1000) : null;
  return { season: Number(s[1]), number: Number(e[1]), watchedAt };
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
  const gsiIdx = findColumn(headers, ["gsi"], true);
  const recentIdx = findColumn(headers, ["mostrecentepwatched"]);
  const forLaterIdx = findColumn(headers, ["isforlater"]);
  const archivedIdx = findColumn(headers, ["isarchived"]);

  // name -> "season:number" -> latest watched timestamp (or null if unknown)
  const watchedByShow = new Map<string, Map<string, number | null>>();
  const info = new Map<
    string,
    {
      status: ShowStatus;
      progress: {
        season: number;
        number: number;
        watchedAt: number | null;
      } | null;
      /** When the show was first followed (from the user-series row). */
      followedAt: number | null;
    }
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
    // Prefer the explicit created_at; fall back to the gsi-encoded watch time
    // (watch-episode-<unix_seconds>), then updated_at.
    const watchedAt =
      parseDate(cols[createdIdx]) ??
      parseGsiWatchDate(gsiIdx >= 0 ? cols[gsiIdx] : undefined) ??
      parseDate(cols[updatedIdx]);

    if (keyIdx >= 0) {
      if (key.startsWith("watch-episode")) {
        if (season != null && number != null)
          addWatched(name, season, number, watchedAt);
      } else if (key.startsWith("user-series")) {
        let status: ShowStatus = "watching";
        if (isTrue(cols[forLaterIdx])) status = "plan";
        else if (isTrue(cols[archivedIdx])) status = "completed";
        // The user-series row's created_at is when the show was first followed.
        info.set(name, {
          status,
          progress: parseProgress(cols[recentIdx]),
          followedAt: parseTimestamp(cols[createdIdx]),
        });
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
      followedAt: meta?.followedAt ?? null,
    });
  }
  return result;
}

/**
 * Read the single `tracking-stats` row, which carries TV Time's own aggregate
 * totals — notably `total_series_runtime` (seconds), the exact watch time the
 * app displayed. This is far more accurate than estimating per-episode.
 */
export function parseTvTimeStats(text: string): TvTimeStats | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const headers = rows[0];
  const keyIdx = findColumn(headers, ["key"], true);
  if (keyIdx === -1) return null;
  const runtimeIdx = findColumn(headers, ["totalseriesruntime"]);
  const epCountIdx = findColumn(headers, ["epwatchcount"]);
  for (let r = 1; r < rows.length; r++) {
    if ((rows[r][keyIdx] ?? "") === "tracking-stats") {
      return {
        totalRuntimeSeconds: runtimeIdx >= 0 ? toInt(rows[r][runtimeIdx]) : null,
        episodeWatchCount: epCountIdx >= 0 ? toInt(rows[r][epCountIdx]) : null,
      };
    }
  }
  return null;
}

const truthy = (v: string | undefined) => {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true";
};

/**
 * Parse user_tv_show_data.csv: authoritative per-show `nb_episodes_seen` plus
 * follow flags, keyed by TheTVDB `tv_show_id`.
 */
export function parseUserShowData(text: string): UserShowDatum[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const h = rows[0];
  const nameIdx = findColumn(h, ["tvshowname", "seriesname", "showname", "title"]);
  const idIdx = findColumn(h, ["tvshowid", "showid", "seriesid"]);
  const seenIdx = findColumn(h, ["nbepisodesseen", "episodesseen"]);
  const followedIdx = findColumn(h, ["isfollowed"]);
  if (nameIdx === -1 && idIdx === -1) return [];
  const out: UserShowDatum[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const name = (c[nameIdx] ?? "").trim();
    const tvdbId = idIdx >= 0 ? toInt(c[idIdx]) : null;
    if (!name && tvdbId == null) continue;
    out.push({
      tvdbId,
      name,
      seen: (seenIdx >= 0 ? toInt(c[seenIdx]) : null) ?? 0,
      isFollowed: followedIdx >= 0 ? truthy(c[followedIdx]) : true,
    });
  }
  return out;
}

/**
 * Parse followed_tv_show.csv: `active` / `archived` flags per show, used for
 * more reliable status than the flags on the tracking log's `user-series` rows.
 */
export function parseFollowedShows(text: string): FollowedDatum[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const h = rows[0];
  const nameIdx = findColumn(h, ["tvshowname", "seriesname", "showname", "title"]);
  const idIdx = findColumn(h, ["tvshowid", "showid", "seriesid"]);
  const activeIdx = findColumn(h, ["active"], true);
  const archivedIdx = findColumn(h, ["archived"], true);
  const followedAtIdx = findColumn(h, ["followedat", "createdat"]);
  if (nameIdx === -1 && idIdx === -1) return [];
  const out: FollowedDatum[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const name = (c[nameIdx] ?? "").trim();
    const tvdbId = idIdx >= 0 ? toInt(c[idIdx]) : null;
    if (!name && tvdbId == null) continue;
    out.push({
      tvdbId,
      name,
      active: activeIdx >= 0 ? truthy(c[activeIdx]) : true,
      archived: archivedIdx >= 0 ? truthy(c[archivedIdx]) : false,
      followedAt: followedAtIdx >= 0 ? parseTimestamp(c[followedAtIdx]) : null,
    });
  }
  return out;
}

/**
 * Parse user_show_special_status.csv. The useful value for Episodic is
 * `for_later`, which maps to plan-to-watch.
 */
export function parseSpecialStatus(text: string): SpecialStatusDatum[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const h = rows[0];
  const nameIdx = findColumn(h, ["tvshowname", "seriesname", "showname", "title"]);
  const idIdx = findColumn(h, ["tvshowid", "showid", "seriesid"]);
  const statusIdx = findColumn(h, ["status"], true);
  if ((nameIdx === -1 && idIdx === -1) || statusIdx === -1) return [];
  const out: SpecialStatusDatum[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const name = (c[nameIdx] ?? "").trim();
    const tvdbId = idIdx >= 0 ? toInt(c[idIdx]) : null;
    const status = (c[statusIdx] ?? "").trim().toLowerCase();
    if ((!name && tvdbId == null) || !status) continue;
    out.push({ tvdbId, name, status });
  }
  return out;
}

/**
 * Parse user_statistics.csv for aggregate totals used when the tracking log
 * has no `tracking-stats` row. `time_spent` is treated as seconds.
 */
export function parseUserStatistics(text: string): TvTimeStats | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const h = rows[0];
  const epIdx = findColumn(h, ["nbepisodeswatched", "episodeswatched"]);
  const timeIdx = findColumn(h, ["timespent"]);
  if (epIdx === -1 && timeIdx === -1) return null;
  // Prefer the first data row that has at least one usable value.
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const episodeWatchCount = epIdx >= 0 ? toInt(c[epIdx]) : null;
    const totalRuntimeSeconds = timeIdx >= 0 ? toInt(c[timeIdx]) : null;
    if (episodeWatchCount != null || totalRuntimeSeconds != null) {
      return { episodeWatchCount, totalRuntimeSeconds };
    }
  }
  return null;
}

/** Basename of a path, lowercased (ZIP entries may include folders). */
function csvBasename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return (parts[parts.length - 1] ?? path).toLowerCase();
}

/**
 * Map named CSV texts (from a ZIP or multi-file picker) onto TvTimeFiles.
 * Throws if no tracking log is present.
 */
export function collectTvTimeFiles(
  entries: { name: string; text: string }[]
): TvTimeFiles {
  let tracking: string | undefined;
  let trackingV1: string | undefined;
  let userShowData: string | undefined;
  let followed: string | undefined;
  let specialStatus: string | undefined;
  let userStatistics: string | undefined;
  const unclassified: string[] = [];

  for (const entry of entries) {
    const name = csvBasename(entry.name);
    const text = entry.text;
    if (name.includes("records-v2")) tracking = text;
    else if (name.includes("tracking-prod-records")) trackingV1 = text;
    else if (name.includes("user_tv_show_data")) userShowData = text;
    else if (name.includes("followed_tv_show")) followed = text;
    else if (name.includes("user_show_special_status")) specialStatus = text;
    else if (name.includes("user_statistics")) userStatistics = text;
    else if (name.endsWith(".csv")) unclassified.push(text);
  }

  if (!tracking) tracking = trackingV1;
  if (!tracking && unclassified.length === 1) tracking = unclassified[0];

  if (!tracking) {
    throw new Error(
      "Couldn't find tracking-prod-records-v2.csv in the selected export."
    );
  }
  return { tracking, userShowData, followed, specialStatus, userStatistics };
}

/**
 * Read a TV Time GDPR ZIP and return only the safe CSVs we import.
 * Sensitive auth/device/identity files are never loaded into memory as text.
 */
export async function collectTvTimeFilesFromZip(
  data: ArrayBuffer
): Promise<TvTimeFiles> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);
  const entries: { name: string; text: string }[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const base = csvBasename(path);
    if (!base.endsWith(".csv") || !SAFE_ZIP_FILES.has(base)) continue;
    entries.push({ name: base, text: await file.async("string") });
  }

  if (entries.length === 0) {
    throw new Error(
      "No usable TV Time CSVs found in this ZIP. Make sure you selected the official GDPR export."
    );
  }
  return collectTvTimeFiles(entries);
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
 *      count): map the export's episode number onto TMDB's aired order.
 *
 * When the export lists a single season we compute both mappings and keep
 * whichever resolves more episodes, so partially-absolute shows aren't lost.
 */
function resolveWatched(
  entry: ParsedShow,
  episodes: Episode[],
  now: number
): Map<string, number> {
  const add = (map: Map<string, number>, key: string, at: number) => {
    const prev = map.get(key);
    if (prev == null || at > prev) map.set(key, at);
  };

  if (entry.episodes.length > 0) {
    const tmdbKeys = new Set(episodes.map((e) => `${e.season}:${e.number}`));

    // Strategy A: seasonal (season + episode number must exist on TMDB).
    const seasonal = new Map<string, number>();
    for (const e of entry.episodes) {
      const key = `${e.season}:${e.number}`;
      if (tmdbKeys.has(key)) add(seasonal, key, e.watchedAt ?? now);
    }

    // Strategy B: absolute — only meaningful when the export uses one season.
    const csvSeasons = new Set(entry.episodes.map((e) => e.season));
    let absolute: Map<string, number> | null = null;
    if (csvSeasons.size === 1) {
      const flat = [...episodes].sort(
        (a, b) => a.season - b.season || a.number - b.number
      );
      absolute = new Map();
      for (const e of entry.episodes) {
        const target = flat[e.number - 1];
        if (target) {
          add(absolute, `${target.season}:${target.number}`, e.watchedAt ?? now);
        }
      }
    }

    // Keep whichever recovered more episodes (ties favour seasonal).
    return absolute && absolute.size > seasonal.size ? absolute : seasonal;
  }

  const watched = new Map<string, number>();
  if (entry.progress) {
    const { season: pS, number: pE, watchedAt } = entry.progress;
    // Only the most-recent episode's real watch time is known; use it for the
    // whole caught-up range as a better estimate than import time.
    const at = watchedAt ?? now;
    for (const ep of episodes) {
      if (ep.season < pS || (ep.season === pS && ep.number <= pE)) {
        add(watched, `${ep.season}:${ep.number}`, at);
      }
    }
  }
  return watched;
}

/** Enrich parsed shows with authoritative status + expected-seen from the
 * companion CSVs, matching on TVDB id first, then normalized title.
 * Also adds companion-only shows (e.g. for_later with no watch rows). */
function enrichEntries(
  parsed: ParsedShow[],
  userData: UserShowDatum[],
  followed: FollowedDatum[],
  specialStatus: SpecialStatusDatum[]
) {
  const seenByTvdb = new Map<number, number>();
  const seenByName = new Map<string, number>();
  for (const u of userData) {
    if (u.tvdbId != null) seenByTvdb.set(u.tvdbId, u.seen);
    if (u.name) seenByName.set(normalizeTitle(u.name), u.seen);
  }

  // followed_tv_show.csv's `followed_at` is the authoritative "date added".
  const followedAtByTvdb = new Map<number, number>();
  const followedAtByName = new Map<string, number>();
  for (const f of followed) {
    if (f.followedAt == null) continue;
    if (f.tvdbId != null) followedAtByTvdb.set(f.tvdbId, f.followedAt);
    if (f.name) followedAtByName.set(normalizeTitle(f.name), f.followedAt);
  }

  // Priority: archived → completed, for_later → plan, actively followed →
  // watching. Leave ambiguous rows to the tracking log's own flags.
  const statusByTvdb = new Map<number, ShowStatus>();
  const statusByName = new Map<string, ShowStatus>();
  const setStatus = (tvdbId: number | null, name: string, status: ShowStatus) => {
    if (tvdbId != null) statusByTvdb.set(tvdbId, status);
    if (name) statusByName.set(normalizeTitle(name), status);
  };

  for (const f of followed) {
    if (f.archived) setStatus(f.tvdbId, f.name, "completed");
    else if (f.active) setStatus(f.tvdbId, f.name, "watching");
  }

  for (const s of specialStatus) {
    if (s.status !== "for_later") continue;
    // Don't demote an archived/completed show back to plan.
    const existing =
      (s.tvdbId != null ? statusByTvdb.get(s.tvdbId) : undefined) ??
      (s.name ? statusByName.get(normalizeTitle(s.name)) : undefined);
    if (existing === "completed") continue;
    setStatus(s.tvdbId, s.name, "plan");
  }

  const hasShow = (tvdbId: number | null, name: string) => {
    const nt = name ? normalizeTitle(name) : "";
    return parsed.some(
      (p) =>
        (tvdbId != null && p.tvdbId === tvdbId) ||
        (nt && normalizeTitle(p.name) === nt)
    );
  };

  const addMissing = (
    tvdbId: number | null,
    name: string,
    status: ShowStatus
  ) => {
    if ((!name && tvdbId == null) || hasShow(tvdbId, name)) return;
    parsed.push({
      name: name || `Show ${tvdbId}`,
      tvdbId,
      status,
      episodes: [],
      expectedSeen:
        (tvdbId != null ? seenByTvdb.get(tvdbId) : undefined) ??
        (name ? seenByName.get(normalizeTitle(name)) : undefined),
      followedAt:
        (tvdbId != null ? followedAtByTvdb.get(tvdbId) : undefined) ??
        (name ? followedAtByName.get(normalizeTitle(name)) : undefined) ??
        null,
    });
  };

  // Plan-to-watch / followed shows that never appear in the tracking log.
  for (const s of specialStatus) {
    if (s.status === "for_later") addMissing(s.tvdbId, s.name, "plan");
  }
  for (const f of followed) {
    if (f.archived) addMissing(f.tvdbId, f.name, "completed");
    else if (f.active) addMissing(f.tvdbId, f.name, "watching");
  }

  for (const entry of parsed) {
    const nt = normalizeTitle(entry.name);
    const seen =
      (entry.tvdbId != null ? seenByTvdb.get(entry.tvdbId) : undefined) ??
      seenByName.get(nt);
    if (seen != null) entry.expectedSeen = seen;

    const status =
      (entry.tvdbId != null ? statusByTvdb.get(entry.tvdbId) : undefined) ??
      statusByName.get(nt);
    if (status) entry.status = status;

    // Prefer the explicit followed_at; keep the tracking-log created_at as a
    // fallback so shows missing from followed_tv_show.csv still get a real date.
    const followedAt =
      (entry.tvdbId != null ? followedAtByTvdb.get(entry.tvdbId) : undefined) ??
      followedAtByName.get(nt);
    if (followedAt != null) entry.followedAt = followedAt;
  }
}

export async function runTvTimeImport(
  files: TvTimeFiles,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  const parsed = parseTvTimeCsv(files.tracking);
  let stats = parseTvTimeStats(files.tracking);
  // Fill gaps from user_statistics.csv when tracking-stats is incomplete.
  if (files.userStatistics) {
    const fallback = parseUserStatistics(files.userStatistics);
    if (fallback) {
      stats = {
        totalRuntimeSeconds:
          stats?.totalRuntimeSeconds ?? fallback.totalRuntimeSeconds,
        episodeWatchCount:
          stats?.episodeWatchCount ?? fallback.episodeWatchCount,
      };
    }
  }
  const userData = files.userShowData
    ? parseUserShowData(files.userShowData)
    : [];
  const followed = files.followed ? parseFollowedShows(files.followed) : [];
  const specialStatus = files.specialStatus
    ? parseSpecialStatus(files.specialStatus)
    : [];
  enrichEntries(parsed, userData, followed, specialStatus);

  const summary: ImportSummary = {
    matched: [],
    unmatched: [],
    failed: [],
    totalRuntimeSeconds: stats?.totalRuntimeSeconds ?? null,
    episodeWatchCount: stats?.episodeWatchCount ?? null,
  };

  // Persist TV Time's exact total watch time so the profile can show it
  // instead of a per-episode estimate.
  if (stats?.totalRuntimeSeconds != null && stats.totalRuntimeSeconds > 0) {
    await setSetting(
      SETTING_TVTIME_RUNTIME_SEC,
      String(stats.totalRuntimeSeconds)
    );
  }

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
        added_at: entry.followedAt ?? Date.now(),
        source: "tvtime",
      };
      await upsertShow(show);
      await setShowStatus(best.id, entry.status);

      // Fetch specials only when the export recorded watched specials, so we
      // recover them without cluttering every show with unwatched extras.
      const needsSpecials = entry.episodes.some((e) => e.season === 0);
      const episodes = await getAllEpisodes(best.id, needsSpecials);
      const now = Date.now();
      const watchedMap = resolveWatched(entry, episodes, now);

      const withWatched: Episode[] = episodes.map((ep) => ({
        ...ep,
        watched_at: watchedMap.get(`${ep.season}:${ep.number}`) ?? null,
      }));
      await upsertEpisodes(withWatched);
      // Promote to completed when every main season is watched (specials ignored).
      // Don't demote TV Time archived shows that didn't match 100% on TMDB.
      await syncShowCompletion(best.id, { demote: false });

      summary.matched.push({
        name: entry.name,
        matchedTitle: best.name,
        watched: watchedMap.size,
        expected:
          entry.expectedSeen ?? (entry.episodes.length || watchedMap.size),
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
