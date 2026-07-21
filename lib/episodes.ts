import type { Episode } from "./types";

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** True when the episode has aired (or has no usable future air date). */
export function isEpisodeReleased(
  episode: Pick<Episode, "air_date">,
  now = new Date()
): boolean {
  if (!episode.air_date) return false;
  const day = startOfLocalDay(new Date(episode.air_date + "T00:00:00"));
  if (Number.isNaN(day)) return false;
  return day <= startOfLocalDay(now);
}

export function unreleasedInSeason(
  episodes: Episode[],
  season: number
): Episode[] {
  return episodes.filter(
    (e) => e.season === season && !isEpisodeReleased(e)
  );
}

/** Earlier episodes in the same season that are released but not yet watched. */
export function skippedPriorInSeason(
  episodes: Episode[],
  target: Pick<Episode, "season" | "number">
): Episode[] {
  return episodes
    .filter(
      (e) =>
        e.season === target.season &&
        e.number < target.number &&
        e.watched_at == null &&
        isEpisodeReleased(e)
    )
    .sort((a, b) => a.number - b.number);
}

export function episodesInSeason(
  episodes: Episode[],
  season: number
): Episode[] {
  return episodes.filter((e) => e.season === season);
}
