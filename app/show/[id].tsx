import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  View,
} from "react-native";
import {
  Button,
  EmptyState,
  EpisodeStill,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
  ProgressBar,
} from "../../components/ui";
import {
  useAddShow,
  useEpisodes,
  useRemoveShow,
  useSetShowStatus,
  useShow,
  useToggleEpisode,
  useToggleSeason,
  useTmdbEpisodes,
  useTmdbShowDetail,
} from "../../lib/queries";
import {
  SHOW_STATUSES,
  STATUS_LABELS,
  type Episode,
  type Show,
  type ShowStatus,
} from "../../lib/types";

/** Format an epoch-ms watch timestamp as a local YYYY-MM-DD calendar date. */
function formatWatchedDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Section {
  season: number;
  /** Episodes rendered by the list — empty when the season is collapsed. */
  data: Episode[];
  watched: number;
  /** Total episodes in the season (independent of collapse state). */
  total: number;
  collapsed: boolean;
}

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const showId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();

  const { data: dbShow, isLoading: showLoading } = useShow(showId);
  const inLibrary = !!dbShow;
  const wantPreview = !showLoading && !dbShow;

  const {
    data: dbEpisodes,
    isLoading: dbEpisodesLoading,
    isError: dbEpisodesError,
    error: dbEpisodesErr,
    refetch: refetchDbEpisodes,
  } = useEpisodes(showId, inLibrary);
  const {
    data: previewDetail,
    isLoading: previewLoading,
    isError: previewError,
    error: previewErr,
    refetch: refetchPreview,
  } = useTmdbShowDetail(showId, wantPreview);
  const {
    data: previewEpisodes,
    isLoading: previewEpisodesLoading,
    isError: previewEpisodesError,
    error: previewEpisodesErr,
    refetch: refetchPreviewEpisodes,
  } = useTmdbEpisodes(showId, wantPreview);

  const toggleEpisode = useToggleEpisode();
  const toggleSeason = useToggleSeason();
  const setStatus = useSetShowStatus();
  const removeShow = useRemoveShow();
  const addShow = useAddShow();

  const show: Show | null = useMemo(() => {
    if (dbShow) return dbShow;
    if (previewDetail) {
      return {
        id: previewDetail.id,
        title: previewDetail.name,
        poster_path: previewDetail.poster_path,
        overview: previewDetail.overview,
        first_air_date: previewDetail.first_air_date,
        status: "watching",
        added_at: 0,
      };
    }
    return null;
  }, [dbShow, previewDetail]);

  const episodes = inLibrary ? dbEpisodes ?? [] : previewEpisodes ?? [];
  const episodesLoading = inLibrary ? dbEpisodesLoading : previewEpisodesLoading;
  const episodesError = inLibrary ? dbEpisodesError : previewEpisodesError;
  const episodesErr = inLibrary ? dbEpisodesErr : previewEpisodesErr;
  const refetchEpisodes = inLibrary ? refetchDbEpisodes : refetchPreviewEpisodes;

  // Explicit per-season collapse choices. When a season has no override we fall
  // back to the default: collapsed once fully watched, expanded otherwise.
  const [collapseOverrides, setCollapseOverrides] = useState<
    Record<number, boolean>
  >({});

  const sections: Section[] = useMemo(() => {
    const bySeason = new Map<number, Episode[]>();
    for (const e of episodes) {
      if (!bySeason.has(e.season)) bySeason.set(e.season, []);
      bySeason.get(e.season)!.push(e);
    }
    return [...bySeason.entries()]
      // Regular seasons ascending, specials (0) last.
      .sort((a, b) => {
        if (a[0] === 0) return 1;
        if (b[0] === 0) return -1;
        return a[0] - b[0];
      })
      .map(([season, data]) => {
        const watched = data.filter((e) => e.watched_at != null).length;
        const fullyWatched = data.length > 0 && watched === data.length;
        const collapsed = collapseOverrides[season] ?? fullyWatched;
        return {
          season,
          total: data.length,
          watched,
          collapsed,
          data: collapsed ? [] : data,
        };
      });
  }, [episodes, collapseOverrides]);

  // Progress ignores specials — unwatched specials don't block a finished show.
  const mainEpisodes = episodes.filter((e) => e.season > 0);
  const totalWatched = mainEpisodes.filter((e) => e.watched_at != null).length;
  const totalMain = mainEpisodes.length;

  useLayoutEffect(() => {
    navigation.setOptions({ title: show?.title ?? "" });
  }, [navigation, show?.title]);

  function onToggleEpisode(e: Episode) {
    if (!inLibrary) return;
    toggleEpisode.mutate({
      showId: e.show_id,
      season: e.season,
      number: e.number,
      watched: e.watched_at == null,
    });
  }

  function onToggleSeason(section: Section) {
    if (!inLibrary) return;
    const allWatched = section.watched === section.total;
    toggleSeason.mutate({
      showId,
      season: section.season,
      watched: !allWatched,
    });
  }

  function onToggleCollapse(section: Section) {
    setCollapseOverrides((prev) => ({
      ...prev,
      [section.season]: !section.collapsed,
    }));
  }

  function onAdd() {
    if (!show) return;
    addShow.mutate(
      { show, episodes: previewEpisodes },
      { onError: (e) => Alert.alert("Couldn't add show", errorMessage(e)) }
    );
  }

  function confirmRemove() {
    const doRemove = () =>
      removeShow.mutate(showId, {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert("Couldn't remove show", errorMessage(e)),
      });
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm("Remove this show and its watch history?")) doRemove();
    } else {
      Alert.alert("Remove show", "Remove this show and its watch history?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ]);
    }
  }

  if (showLoading || (wantPreview && previewLoading)) {
    return (
      <View className="flex-1 bg-bg">
        <Loading label="Loading show…" />
      </View>
    );
  }

  // Not in the library and the TMDB preview failed: there's no show to show.
  if (wantPreview && previewError && !previewDetail) {
    return (
      <View className="flex-1 bg-bg">
        <ErrorState
          title="Couldn't load this show"
          message={errorMessage(previewErr)}
          onRetry={() => refetchPreview()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <SectionList
        sections={sections}
        keyExtractor={(e) => `${e.season}:${e.number}`}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <Header
            show={show}
            inLibrary={inLibrary}
            adding={addShow.isPending}
            totalWatched={totalWatched}
            total={totalMain}
            onStatus={(s) => setStatus.mutate({ id: showId, status: s })}
            onAdd={onAdd}
            onRemove={confirmRemove}
          />
        }
        renderSectionHeader={({ section }) => {
          const s = section as unknown as Section;
          const allWatched = s.watched === s.total && s.total > 0;
          const seasonPending =
            toggleSeason.isPending &&
            toggleSeason.variables?.showId === showId &&
            toggleSeason.variables?.season === s.season;
          return (
            <View className="flex-row items-center justify-between px-4 pt-5 pb-2 bg-bg">
              <Pressable
                onPress={() => onToggleCollapse(s)}
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
                  onPress={seasonPending ? undefined : () => onToggleSeason(s)}
                  disabled={seasonPending}
                  hitSlop={8}
                  className="flex-row items-center gap-1 active:opacity-70 pl-2"
                >
                  {seasonPending ? (
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
            item.watched_at != null ? formatWatchedDate(item.watched_at) : null;
          const episodePending =
            toggleEpisode.isPending &&
            toggleEpisode.variables?.showId === item.show_id &&
            toggleEpisode.variables?.season === item.season &&
            toggleEpisode.variables?.number === item.number;
          return (
            <Pressable
              onPress={() => (episodePending ? undefined : onToggleEpisode(item))}
              disabled={!inLibrary || episodePending}
              className="flex-row items-center px-4 py-2.5 active:opacity-70"
            >
              <View
                className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                  watched ? "bg-success" : "border border-border"
                }`}
              >
                {episodePending ? (
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
                onRetry={() => refetchEpisodes()}
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
    </View>
  );
}

function Header({
  show,
  inLibrary,
  adding,
  totalWatched,
  total,
  onStatus,
  onAdd,
  onRemove,
}: {
  show: Show | null;
  inLibrary: boolean;
  adding: boolean;
  totalWatched: number;
  total: number;
  onStatus: (s: ShowStatus) => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View className="px-4 pt-4">
      <View className="flex-row">
        <Poster
          path={show?.poster_path ?? null}
          size="w342"
          title={show?.title}
          className="w-28 aspect-[2/3] rounded-xl"
        />
        <View className="flex-1 ml-4 justify-between">
          <View>
            <Text className="text-text text-xl font-bold" numberOfLines={3}>
              {show?.title ?? "Show"}
            </Text>
            {show?.first_air_date ? (
              <Text className="text-muted mt-1">
                {show.first_air_date.slice(0, 4)}
              </Text>
            ) : null}
            {inLibrary && show?.added_at ? (
              <View className="flex-row items-center mt-1">
                <Ionicons name="add-circle-outline" size={12} color="#9a9ab0" />
                <Text className="text-muted text-xs ml-1">
                  Followed {formatWatchedDate(show.added_at)}
                </Text>
              </View>
            ) : null}
          </View>
          {inLibrary && total > 0 ? (
            <View className="mt-3">
              <Text className="text-muted text-xs mb-1">
                {totalWatched}/{total} episodes watched
              </Text>
              <ProgressBar value={totalWatched} total={total} />
            </View>
          ) : null}
        </View>
      </View>

      {show?.overview ? (
        <Text className="text-muted mt-4 leading-5">{show.overview}</Text>
      ) : null}

      {inLibrary ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
          >
            {SHOW_STATUSES.map((s) => {
              const active = show?.status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => onStatus(s)}
                  className={`h-9 px-3 rounded-full items-center justify-center ${
                    active ? "bg-primary" : "bg-surface"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      active ? "text-white" : "text-muted"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            label="Remove from library"
            icon="trash-outline"
            variant="danger"
            onPress={onRemove}
          />
        </>
      ) : (
        <View className="py-4">
          <Button
            label={adding ? "Adding…" : "Add to library"}
            icon="add"
            onPress={onAdd}
            disabled={adding || !show}
          />
        </View>
      )}
    </View>
  );
}
