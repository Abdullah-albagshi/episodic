import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { ProgressBar, Poster } from "../ui";
import { backdropUrl } from "../../lib/tmdb";
import { STATUS_LABELS, type Show } from "../../lib/types";
import type { TmdbShowDetail } from "../../lib/tmdb";

export function ShowHero({
  show,
  detail,
  inLibrary,
  totalWatched,
  total,
  onOpenStatus,
}: {
  show: Show | null;
  detail: TmdbShowDetail | null | undefined;
  inLibrary: boolean;
  totalWatched: number;
  total: number;
  onOpenStatus: () => void;
}) {
  const backdrop = backdropUrl(detail?.backdrop_path ?? null);
  const year = show?.first_air_date?.slice(0, 4);
  const seasons = detail?.number_of_seasons;
  const seriesStatus = detail?.status;
  const vote =
    detail && detail.vote_count > 0
      ? `${detail.vote_average.toFixed(1)}/10 (${detail.vote_count})`
      : null;

  const meta = [year, seasons ? `${seasons} Seasons` : null, seriesStatus]
    .filter(Boolean)
    .join(" · ");

  return (
    <View>
      <View className="h-44 bg-surface2 overflow-hidden">
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : null}
        <View className="absolute inset-0 bg-black/40" />
      </View>

      <View className="px-4 -mt-16">
        <View className="flex-row">
          <Poster
            path={show?.poster_path ?? null}
            size="w342"
            title={show?.title}
            className="w-28 aspect-[2/3] rounded-xl border-2 border-bg"
          />
          <View className="flex-1 ml-3 justify-end pb-1">
            <Text className="text-text text-xl font-bold" numberOfLines={3}>
              {show?.title ?? "Show"}
            </Text>
            {meta ? (
              <Text className="text-muted text-xs mt-1" numberOfLines={2}>
                {meta}
              </Text>
            ) : null}
            {vote ? (
              <View className="flex-row items-center mt-1">
                <Ionicons name="star" size={12} color="#3ecf8e" />
                <Text className="text-success text-xs ml-1">{vote}</Text>
              </View>
            ) : null}
            {inLibrary && show?.source === "tvtime" ? (
              <View className="self-start mt-2 rounded-full bg-primary/20 px-2.5 py-0.5">
                <Text className="text-primary text-[11px] font-semibold">
                  From TV Time
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {inLibrary && total > 0 ? (
          <View className="mt-3">
            <Text className="text-muted text-xs mb-1">
              {totalWatched}/{total} episodes watched
            </Text>
            <ProgressBar value={totalWatched} total={total} />
          </View>
        ) : null}

        {inLibrary && show ? (
          <Pressable
            onPress={onOpenStatus}
            className="mt-4 flex-row items-center justify-center bg-surface rounded-full h-11 active:opacity-80"
          >
            <Ionicons name="play" size={16} color="#f2f2f7" />
            <Text className="text-text font-semibold mx-2">
              {STATUS_LABELS[show.status]}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9a9ab0" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
