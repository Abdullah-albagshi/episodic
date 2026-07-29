import type { ReactElement } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  Text,
  View,
} from "react-native";
import { formatDateYmd } from "../../lib/dates";
import { useTapGuard } from "../../lib/tapGuard";
import type { Episode } from "../../lib/types";
import {
  EmptyState,
  EpisodeStill,
  ErrorState,
  errorMessage,
  Loading,
} from "../ui";

export interface EpisodeSection {
  season: number;
  data: Episode[];
  watched: number;
  total: number;
  collapsed: boolean;
}

export function ShowEpisodesTab({
  sections,
  episodes,
  inLibrary,
  episodesLoading,
  episodesError,
  episodesErr,
  onRetryEpisodes,
  onToggleCollapse,
  onToggleSeason,
  onToggleEpisode,
  seasonPending,
  episodePending,
  ListHeaderComponent,
}: {
  sections: EpisodeSection[];
  episodes: Episode[];
  inLibrary: boolean;
  episodesLoading: boolean;
  episodesError: boolean;
  episodesErr: unknown;
  onRetryEpisodes: () => void;
  onToggleCollapse: (section: EpisodeSection) => void;
  onToggleSeason: (section: EpisodeSection) => void;
  onToggleEpisode: (e: Episode) => void;
  seasonPending: (season: number) => boolean;
  episodePending: (e: Episode) => boolean;
  ListHeaderComponent?: ReactElement | null;
}) {
  const tap = useTapGuard();

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => `${e.season}:${e.number}`}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={ListHeaderComponent}
      renderSectionHeader={({ section }) => {
        const s = section as unknown as EpisodeSection;
        const allWatched = s.watched === s.total && s.total > 0;
        const pending = seasonPending(s.season);
        return (
          <View className="flex-row items-center justify-between px-4 pt-5 pb-2 bg-bg">
            <Pressable
              onPressIn={tap.onPressIn}
              onPress={(e) => {
                if (!tap.wasTap(e)) return;
                onToggleCollapse(s);
              }}
              className="flex-row items-center gap-2 flex-1 active:opacity-70"
            >
              <Ionicons
                name={s.collapsed ? "chevron-forward" : "chevron-down"}
                size={16}
                color="#9a9ab0"
              />
              <Text className="text-text text-lg font-bold">
                {s.season === 0 ? "Specials" : `Season ${s.season}`}
              </Text>
              <Text className="text-muted text-sm">
                {inLibrary ? `(${s.watched}/${s.total})` : `(${s.total})`}
              </Text>
            </Pressable>
            {inLibrary ? (
              <Pressable
                onPressIn={tap.onPressIn}
                onPress={(e) => {
                  if (pending || !tap.wasTap(e)) return;
                  onToggleSeason(s);
                }}
                disabled={pending}
                hitSlop={8}
                className="flex-row items-center gap-1 active:opacity-70 pl-2"
              >
                {pending ? (
                  <ActivityIndicator color="#7c5cff" />
                ) : (
                  <Ionicons
                    name={
                      allWatched ? "checkmark-done-circle" : "ellipse-outline"
                    }
                    size={20}
                    color={allWatched ? "#3ecf8e" : "#9a9ab0"}
                  />
                )}
              </Pressable>
            ) : null}
          </View>
        );
      }}
      renderItem={({ item }) => {
        const watched = item.watched_at != null;
        const watchedDate =
          item.watched_at != null ? formatDateYmd(item.watched_at) : null;
        const pending = episodePending(item);
        return (
          <Pressable
            onPressIn={tap.onPressIn}
            onPress={(e) => {
              if (!inLibrary || pending || !tap.wasTap(e)) return;
              onToggleEpisode(item);
            }}
            disabled={!inLibrary || pending}
            className="flex-row items-center px-4 py-2.5 active:opacity-70"
          >
            <View
              className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                watched ? "bg-success" : "border border-border"
              }`}
            >
              {pending ? (
                <ActivityIndicator color="#7c5cff" />
              ) : watched ? (
                <Ionicons name="checkmark" size={15} color="#0b0b12" />
              ) : (
                <Text className="text-muted text-[11px]">{item.number}</Text>
              )}
            </View>
            <EpisodeStill
              path={item.still_path}
              className="w-16 h-9 rounded-md mr-3"
            />
            <View className="flex-1">
              <Text
                numberOfLines={1}
                className={watched ? "text-muted" : "text-text"}
              >
                {item.number}. {item.title ?? `Episode ${item.number}`}
              </Text>
              {item.air_date || watchedDate ? (
                <View className="flex-row items-center flex-wrap mt-0.5">
                  {item.air_date ? (
                    <Text className="text-muted text-xs">{item.air_date}</Text>
                  ) : null}
                  {watchedDate ? (
                    <View className="flex-row items-center ml-2">
                      <Ionicons name="eye" size={11} color="#3ecf8e" />
                      <Text className="text-success text-xs ml-1">
                        {watchedDate}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListEmptyComponent={
        episodes.length === 0 ? (
          episodesLoading ? (
            <Loading label="Loading episodes…" />
          ) : episodesError ? (
            <ErrorState
              title="Couldn't load episodes"
              message={errorMessage(episodesErr)}
              onRetry={onRetryEpisodes}
            />
          ) : (
            <EmptyState
              icon="tv-outline"
              title="No episodes yet"
              subtitle="No episode data is available for this show."
            />
          )
        ) : null
      }
    />
  );
}
