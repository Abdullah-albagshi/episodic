import { useRouter } from "expo-router";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, SectionList, Text, View } from "react-native";
import {
  EmptyState,
  EpisodeStill,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
} from "../ui";
import {
  formatDateYmd,
  formatHistoryDay,
  historyDayOffset,
} from "../../lib/dates";
import { useWatchHistory } from "../../lib/queries";
import type { WatchHistoryItem } from "../../lib/types";

/** Ignore taps that were actually a horizontal swipe across the row. */
function useTapGuard(threshold = 12) {
  const start = useRef({ x: 0, y: 0 });
  return {
    onPressIn: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
      start.current = {
        x: e.nativeEvent.pageX,
        y: e.nativeEvent.pageY,
      };
    },
    wasTap: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
      const dx = Math.abs(e.nativeEvent.pageX - start.current.x);
      const dy = Math.abs(e.nativeEvent.pageY - start.current.y);
      return dx < threshold && dy < threshold;
    },
  };
}

export function YouHistoryTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const tap = useTapGuard();
  const { data, isLoading, isError, error, refetch } = useWatchHistory();

  const sections = useMemo(() => {
    if (!data?.length) return [];
    const map = new Map<string, WatchHistoryItem[]>();
    for (const item of data) {
      const key = formatDateYmd(item.watched_at);
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].map(([key, rows]) => {
      const offset = historyDayOffset(rows[0].watched_at);
      const title =
        offset === 0
          ? t("you.today")
          : offset === 1
            ? t("you.yesterday")
            : formatHistoryDay(rows[0].watched_at);
      return { title, key, data: rows };
    });
  }, [data, t]);

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <ErrorState
        title={t("you.historyError")}
        message={errorMessage(error)}
        onRetry={() => refetch()}
        retryLabel={t("common.tryAgain")}
      />
    );
  }
  if (!data?.length) {
    return (
      <EmptyState
        icon="time-outline"
        title={t("you.historyEmptyTitle")}
        subtitle={t("you.historyEmptySubtitle")}
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) =>
        item.media_type === "movie"
          ? `movie:${item.show.id}:${item.watched_at}`
          : `tv:${item.show.id}:${item.episode!.season}:${item.episode!.number}:${item.watched_at}`
      }
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 8 }}
      renderSectionHeader={({ section }) => (
        <Text className="text-muted font-semibold uppercase text-xs tracking-wide mt-3 mb-1">
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => {
        const isMovie = item.media_type === "movie";
        const ep = item.episode;
        return (
          <Pressable
            onPressIn={tap.onPressIn}
            onPress={(e) => {
              if (!tap.wasTap(e)) return;
              router.push(
                isMovie ? `/movie/${item.show.id}` : `/show/${item.show.id}`
              );
            }}
            className="flex-row items-center bg-surface rounded-2xl overflow-hidden active:opacity-80"
          >
            {isMovie || !ep?.still_path ? (
              <Poster
                path={item.show.poster_path}
                size="w185"
                title={item.show.title}
                className="w-14 h-20"
              />
            ) : (
              <EpisodeStill path={ep.still_path} className="w-24 h-14" />
            )}
            <View className="flex-1 p-3">
              <Text numberOfLines={1} className="text-text font-semibold">
                {item.show.title}
              </Text>
              <Text className="text-primary text-sm mt-0.5" numberOfLines={1}>
                {isMovie
                  ? t("you.historyMovie")
                  : `S${ep!.season} · E${ep!.number}${
                      ep!.title ? ` — ${ep!.title}` : ""
                    }`}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
