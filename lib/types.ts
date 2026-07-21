export type ShowStatus =
  | "watching"
  | "plan"
  | "paused"
  | "completed"
  | "dropped";

export const SHOW_STATUSES: ShowStatus[] = [
  "watching",
  "plan",
  "paused",
  "completed",
  "dropped",
];

export const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: "Watching",
  plan: "Plan to watch",
  paused: "Paused",
  completed: "Completed",
  dropped: "Dropped",
};

export type MediaSource = "manual" | "tvtime";

export interface Show {
  id: number; // TMDB id
  title: string;
  poster_path: string | null;
  overview: string | null;
  first_air_date: string | null;
  status: ShowStatus;
  added_at: number;
  /** How the show entered the library. Defaults to manual for older rows. */
  source: MediaSource;
}

export interface Episode {
  show_id: number;
  season: number;
  number: number;
  title: string | null;
  air_date: string | null;
  watched_at: number | null;
  /** TMDB still image path (episode thumbnail), if available. */
  still_path: string | null;
}

/** A library row with progress + the next unwatched episode (null when caught up). */
export interface LibraryEntry {
  show: Show;
  next: Episode | null;
  watchedCount: number;
  totalCount: number;
}

export interface ContinueItem {
  show: Show;
  next: Episode;
  watchedCount: number;
  totalCount: number;
  /** Most recent watch activity for the show, falling back to when it was added. */
  lastActivityAt: number;
}

export interface ExportBundle {
  app: "episodic";
  version: 1;
  exported_at: number;
  shows: Show[];
  episodes: Episode[];
}

export interface ProfileStats {
  /** Aired episodes marked as watched. */
  episodesWatched: number;
  /** Every episode stored across the library. */
  totalEpisodes: number;
  /** Seasons (excluding specials) where every episode has been watched. */
  seasonsCompleted: number;
  totalShows: number;
  showsByStatus: Record<ShowStatus, number>;
  watchTime: {
    months: number;
    days: number;
    hours: number;
    totalHours: number;
    totalMinutes: number;
    /** True when derived from a per-episode estimate rather than real runtimes. */
    estimated: boolean;
  };
  /** Show with the most watched episodes, if any. */
  topShow: { title: string; poster_path: string | null; watched: number } | null;
  /** Earliest `added_at` across shows — i.e. tracking since. */
  memberSince: number | null;
}
