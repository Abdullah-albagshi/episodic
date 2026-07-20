import { getApiKey } from "./store";
import type { Episode } from "./types";

const BASE = "https://api.themoviedb.org/3";
export const IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(
  path: string | null,
  size: "w185" | "w342" | "w500" = "w342"
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

/** Build a URL for an episode still (thumbnail) image. */
export function stillUrl(
  path: string | null,
  size: "w92" | "w185" | "w300" = "w300"
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

/**
 * TMDB accepts either a v3 API key (as `api_key` query param) or a v4 read
 * access token (as a Bearer header). We detect which one the user pasted: v4
 * tokens are long JWTs, v3 keys are short hex strings.
 */
async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      "No TMDB API key set. Add one in Settings to search and load shows."
    );
  }

  const isV4Token = key.length > 60 || key.startsWith("eyJ");
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  if (!isV4Token) url.searchParams.set("api_key", key);

  const res = await fetch(url.toString(), {
    headers: isV4Token
      ? { Authorization: `Bearer ${key}`, accept: "application/json" }
      : { accept: "application/json" },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("TMDB rejected the API key (401). Check it in Settings.");
    }
    throw new Error(`TMDB request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export interface TmdbSearchResult {
  id: number;
  name: string;
  poster_path: string | null;
  overview: string | null;
  first_air_date: string | null;
  vote_average?: number;
}

export async function searchShows(query: string): Promise<TmdbSearchResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>("/search/tv", {
    query: query.trim(),
    include_adult: "false",
  });
  return data.results ?? [];
}

/**
 * Resolve a TV show by its TheTVDB series id (used by TV Time exports) via
 * TMDB's `/find` endpoint. Returns null if TMDB has no mapping for that id.
 */
export async function findShowByTvdbId(
  tvdbId: number
): Promise<TmdbSearchResult | null> {
  const data = await tmdbFetch<{ tv_results: TmdbSearchResult[] }>(
    `/find/${tvdbId}`,
    { external_source: "tvdb_id" }
  );
  return data.tv_results?.[0] ?? null;
}

interface TmdbSeasonSummary {
  season_number: number;
  episode_count: number;
}

interface TmdbShowDetail {
  id: number;
  name: string;
  poster_path: string | null;
  overview: string | null;
  first_air_date: string | null;
  seasons: TmdbSeasonSummary[];
}

interface TmdbSeasonDetail {
  episodes: {
    season_number: number;
    episode_number: number;
    name: string | null;
    air_date: string | null;
    still_path: string | null;
  }[];
}

export async function getShowDetail(id: number): Promise<TmdbShowDetail> {
  return tmdbFetch<TmdbShowDetail>(`/tv/${id}`);
}

/**
 * Fetch every episode for a show and return them as unwatched Episode rows
 * ready to be stored. Season 0 ("specials") is skipped unless `includeSpecials`
 * is set — used by the importer to recover watched specials.
 */
export async function getAllEpisodes(
  showId: number,
  includeSpecials = false
): Promise<Episode[]> {
  const detail = await getShowDetail(showId);
  const realSeasons = detail.seasons.filter(
    (s) =>
      (includeSpecials ? s.season_number >= 0 : s.season_number > 0) &&
      s.episode_count > 0
  );

  const episodes: Episode[] = [];
  for (const season of realSeasons) {
    const data = await tmdbFetch<TmdbSeasonDetail>(
      `/tv/${showId}/season/${season.season_number}`
    );
    for (const e of data.episodes ?? []) {
      episodes.push({
        show_id: showId,
        season: e.season_number,
        number: e.episode_number,
        title: e.name,
        air_date: e.air_date,
        watched_at: null,
        still_path: e.still_path ?? null,
      });
    }
  }
  return episodes;
}
