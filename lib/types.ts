export type ShowStatus = "watching" | "plan" | "completed" | "dropped";

export const SHOW_STATUSES: ShowStatus[] = [
  "watching",
  "plan",
  "completed",
  "dropped",
];

export const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: "Watching",
  plan: "Plan to watch",
  completed: "Completed",
  dropped: "Dropped",
};

export interface Show {
  id: number; // TMDB id
  title: string;
  poster_path: string | null;
  overview: string | null;
  first_air_date: string | null;
  status: ShowStatus;
  added_at: number;
}

export interface Episode {
  show_id: number;
  season: number;
  number: number;
  title: string | null;
  air_date: string | null;
  watched_at: number | null;
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
  /** Seasons where every episode has been watched. */
  seasonsCompleted: number;
  totalShows: number;
  showsByStatus: Record<ShowStatus, number>;
  watchTime: {
    months: number;
    days: number;
    hours: number;
    totalHours: number;
    totalMinutes: number;
  };
  /** Show with the most watched episodes, if any. */
  topShow: { title: string; poster_path: string | null; watched: number } | null;
  /** Earliest `added_at` across shows — i.e. tracking since. */
  memberSince: number | null;
}
