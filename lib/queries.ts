import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as db from "./db";
import { exportBackup, restoreBackup } from "./export";
import {
  runTvTimeImport,
  type ImportProgress,
  type ImportSummary,
  type TvTimeFiles,
} from "./import/tvtime";
import { getAllEpisodes, getMovieDetail, getShowDetail, searchMovies, searchShows } from "./tmdb";
import type { Episode, MediaType, Show, ShowStatus } from "./types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Central registry of query keys so invalidation stays consistent. */
export const qk = {
  shows: (status?: ShowStatus) => ["shows", status ?? "all"] as const,
  show: (id: number, mediaType: string = "tv") =>
    ["show", mediaType, id] as const,
  episodes: (id: number) => ["episodes", id] as const,
  continueWatching: ["continue-watching"] as const,
  libraryOverview: ["library-overview"] as const,
  upcoming: ["upcoming"] as const,
  stats: ["stats"] as const,
  watchHistory: ["watch-history"] as const,
  tmdbSearch: (query: string, mediaType: string = "tv") =>
    ["tmdb", "search", mediaType, query] as const,
  tmdbShow: (id: number) => ["tmdb", "show", id] as const,
  tmdbMovie: (id: number) => ["tmdb", "movie", id] as const,
  tmdbEpisodes: (id: number) => ["tmdb", "episodes", id] as const,
};

/** Artificial delay so fast local mutations still show a loading state. */
const FAKE_LOADING_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Invalidate everything derived from the library/watch state. */
function invalidateLibrary(client: QueryClient, showId?: number) {
  client.invalidateQueries({ queryKey: ["shows"] });
  client.invalidateQueries({ queryKey: qk.continueWatching });
  client.invalidateQueries({ queryKey: qk.libraryOverview });
  client.invalidateQueries({ queryKey: qk.upcoming });
  client.invalidateQueries({ queryKey: qk.stats });
  client.invalidateQueries({ queryKey: qk.watchHistory });
  if (showId != null) {
    client.invalidateQueries({ queryKey: qk.show(showId) });
    client.invalidateQueries({ queryKey: qk.episodes(showId) });
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useShows(status?: ShowStatus) {
  return useQuery({
    queryKey: qk.shows(status),
    queryFn: () => db.getShows(status),
  });
}

export function useShow(id: number, mediaType: MediaType = "tv") {
  return useQuery({
    queryKey: qk.show(id, mediaType),
    queryFn: () => db.getShow(id, mediaType),
  });
}

export function useEpisodes(id: number, enabled = true) {
  return useQuery({
    queryKey: qk.episodes(id),
    queryFn: () => db.getEpisodes(id),
    enabled,
  });
}

export function useContinueWatching() {
  return useQuery({
    queryKey: qk.continueWatching,
    queryFn: db.getContinueWatching,
  });
}

export function useLibraryOverview() {
  return useQuery({
    queryKey: qk.libraryOverview,
    queryFn: db.getLibraryOverview,
  });
}

export function useUpcoming() {
  return useQuery({
    queryKey: qk.upcoming,
    queryFn: db.getUpcoming,
  });
}

export function useStats() {
  return useQuery({
    queryKey: qk.stats,
    queryFn: db.getProfileStats,
  });
}

export function useWatchHistory() {
  return useQuery({
    queryKey: qk.watchHistory,
    queryFn: db.getWatchHistory,
  });
}

export function useTmdbSearch(
  query: string,
  enabled: boolean,
  mediaType: MediaType = "tv"
) {
  return useQuery({
    queryKey: qk.tmdbSearch(query, mediaType),
    queryFn: () =>
      mediaType === "movie" ? searchMovies(query) : searchShows(query),
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useTmdbShowDetail(id: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.tmdbShow(id),
    queryFn: () => getShowDetail(id),
    enabled,
    staleTime: 30 * 60_000,
  });
}

export function useTmdbMovieDetail(id: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.tmdbMovie(id),
    queryFn: () => getMovieDetail(id),
    enabled,
    staleTime: 30 * 60_000,
  });
}

export function useTmdbEpisodes(id: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.tmdbEpisodes(id),
    queryFn: () => getAllEpisodes(id),
    enabled,
    staleTime: 30 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Add a show to the library, fetching its episodes from TMDB if not supplied. */
export function useAddShow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      show,
      episodes,
    }: {
      show: Show;
      episodes?: Episode[];
    }) => {
      const mediaType = show.media_type ?? "tv";
      await db.upsertShow({
        ...show,
        media_type: mediaType,
        status: show.status ?? "watching",
        added_at: Date.now(),
        source: show.source ?? "manual",
        watched_at: show.watched_at ?? null,
      });
      if (mediaType === "tv") {
        const eps = episodes ?? (await getAllEpisodes(show.id));
        await db.upsertEpisodes(eps);
      }
      return { id: show.id, mediaType };
    },
    onSuccess: ({ id, mediaType }) => {
      invalidateLibrary(client, id);
      client.invalidateQueries({ queryKey: qk.show(id, mediaType) });
    },
  });
}

export function useRemoveShow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mediaType = "tv",
    }: {
      id: number;
      mediaType?: MediaType;
    }) => db.removeShow(id, mediaType),
    onSuccess: (_r, { id, mediaType = "tv" }) => {
      invalidateLibrary(client, id);
      client.invalidateQueries({ queryKey: qk.show(id, mediaType) });
    },
  });
}

export function useSetShowStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      mediaType = "tv",
    }: {
      id: number;
      status: ShowStatus;
      mediaType?: MediaType;
    }) => db.setShowStatus(id, status, mediaType),
    onSuccess: (_r, { id, mediaType = "tv" }) => {
      invalidateLibrary(client, id);
      client.invalidateQueries({ queryKey: qk.show(id, mediaType) });
    },
  });
}

export function useToggleMovieWatched() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, watched }: { id: number; watched: boolean }) =>
      db.setMovieWatched(id, watched),
    onSuccess: (_r, { id }) => {
      invalidateLibrary(client, id);
      client.invalidateQueries({ queryKey: qk.show(id, "movie") });
    },
  });
}

export function useToggleEpisode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      showId,
      season,
      number,
      watched,
    }: {
      showId: number;
      season: number;
      number: number;
      watched: boolean;
    }) => {
      await Promise.all([
        db.setEpisodeWatched(showId, season, number, watched),
        sleep(FAKE_LOADING_MS),
      ]);
    },
    onSuccess: (_r, { showId }) => invalidateLibrary(client, showId),
  });
}

/** Mark one or more episodes watched (e.g. current + skipped priors). */
export function useMarkEpisodesWatched() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      showId,
      episodes,
    }: {
      showId: number;
      episodes: { season: number; number: number }[];
    }) => {
      await Promise.all([
        db.setEpisodesWatched(showId, episodes),
        sleep(FAKE_LOADING_MS),
      ]);
    },
    onSuccess: (_r, { showId }) => invalidateLibrary(client, showId),
  });
}

export function useToggleSeason() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      showId,
      season,
      watched,
    }: {
      showId: number;
      season: number;
      watched: boolean;
    }) => {
      await Promise.all([
        db.setSeasonWatched(showId, season, watched),
        sleep(FAKE_LOADING_MS),
      ]);
    },
    onSuccess: (_r, { showId }) => invalidateLibrary(client, showId),
  });
}

export function useImportTvTime() {
  const client = useQueryClient();
  return useMutation<
    ImportSummary,
    Error,
    { files: TvTimeFiles; onProgress?: (p: ImportProgress) => void }
  >({
    mutationFn: ({ files, onProgress }) => runTvTimeImport(files, onProgress),
    onSuccess: () => invalidateLibrary(client),
  });
}

export function useExportBackup() {
  return useMutation({ mutationFn: () => exportBackup() });
}

export function useRestoreBackup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (json: string) => restoreBackup(json),
    onSuccess: () => invalidateLibrary(client),
  });
}

export function useClearAll() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => db.clearAll(),
    onSuccess: () => invalidateLibrary(client),
  });
}
