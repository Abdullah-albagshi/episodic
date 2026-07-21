import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import type { Episode, Show } from "../../lib/types";
import { EpisodeStill } from "./EpisodeStill";
import { Poster } from "./Poster";
import { ProgressBar } from "./Progress";

/** Zero-padded "S05 · E04" episode label. */
function episodeLabel(season: number, number: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `S${pad(season)} · E${pad(number)}`;
}

/**
 * A rich library/continue-watching row: poster, title, an inset "next episode"
 * chip and a progress bar. `next` is null when the show is caught up.
 */
export function EpisodeProgressCard({
  show,
  next,
  watchedCount,
  totalCount,
  onPress,
  onMarkWatched,
  marking = false,
}: {
  show: Show;
  next: Episode | null;
  watchedCount: number;
  totalCount: number;
  onPress: () => void;
  onMarkWatched?: () => void;
  marking?: boolean;
}) {
  const caughtUpLabel =
    show.status === "completed"
      ? "Completed"
      : totalCount > 0 && watchedCount >= totalCount
      ? "All caught up"
      : show.media_type === "movie"
      ? watchedCount > 0
        ? "Watched"
        : "Not watched yet"
      : "Nothing to watch yet";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row bg-surface rounded-2xl overflow-hidden active:opacity-90"
    >
      <Poster
        path={show.poster_path}
        size="w185"
        title={show.title}
        className="w-[84px] self-stretch min-h-[128px]"
      />
      <View className="flex-1 p-3 justify-between">
        <Text numberOfLines={1} className="text-text font-bold text-[15px]">
          {show.title}
        </Text>

        {next ? (
          <View className="flex-row items-center bg-surface2 rounded-xl mt-2 overflow-hidden">
            <EpisodeStill
              path={next.still_path}
              className="w-[104px] h-[60px]"
            />
            <View className="flex-1 px-3 py-2">
              <Text className="text-text font-semibold text-[13px]">
                {episodeLabel(next.season, next.number)}
              </Text>
              <Text numberOfLines={1} className="text-muted text-xs mt-0.5">
                {next.title ?? `Episode ${next.number}`}
              </Text>
            </View>
            {onMarkWatched ? (
              <Pressable
                onPress={marking ? undefined : onMarkWatched}
                disabled={marking}
                hitSlop={10}
                className="active:opacity-60 pr-3"
              >
                {marking ? (
                  <View className="w-7 h-7 items-center justify-center">
                    <ActivityIndicator color="#7c5cff" />
                  </View>
                ) : (
                  <View className="w-7 h-7 rounded-full border-2 border-muted" />
                )}
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className="flex-row items-center bg-surface2 rounded-xl px-3 py-2 mt-2">
            <Ionicons name="checkmark-done" size={16} color="#3ecf8e" />
            <Text className="text-success text-xs font-medium ml-2">
              {caughtUpLabel}
            </Text>
          </View>
        )}

        <View className="flex-row items-center mt-2">
          <View className="flex-1 mr-2">
            <ProgressBar value={watchedCount} total={totalCount} />
          </View>
          <Text className="text-muted text-xs">
            {watchedCount}/{totalCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
