import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import {
  ShowEpisodesTab,
  type EpisodeSection,
} from "../../components/show/ShowEpisodesTab";
import { ShowHero } from "../../components/show/ShowHero";
import { ShowInfoTab } from "../../components/show/ShowInfoTab";
import { ShowStatusSheet } from "../../components/show/ShowStatusSheet";
import {
  Button,
  ErrorState,
  errorMessage,
  Loading,
  SwipeTabs,
} from "../../components/ui";
import {
  isEpisodeReleased,
  skippedPriorInSeason,
  unreleasedInSeason,
} from "../../lib/episodes";
import {
  useAddShow,
  useEpisodes,
  useMarkEpisodesWatched,
  useRemoveShow,
  useSetShowStatus,
  useShow,
  useToggleEpisode,
  useToggleSeason,
  useTmdbEpisodes,
  useTmdbShowDetail,
} from "../../lib/queries";
import { useAppStore } from "../../lib/store";
import type { Episode, Show, ShowStatus } from "../../lib/types";
import { confirmAction, confirmSkipEpisodes } from "../../lib/watchConfirm";

type Tab = "info" | "episodes";

const SHOW_TABS = [
  { key: "info" as const, label: "Info" },
  { key: "episodes" as const, label: "Episodes" },
];

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const showId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const hasKey = !!useAppStore((s) => s.apiKey);
  const skipEpisodePrompt = useAppStore((s) => s.skipEpisodePrompt);
  const setSkipEpisodePrompt = useAppStore((s) => s.setSkipEpisodePrompt);

  const { data: dbShow, isLoading: showLoading } = useShow(showId);
  const inLibrary = !!dbShow;
  const wantPreviewEps = !showLoading && !dbShow;

  const {
    data: dbEpisodes,
    isLoading: dbEpisodesLoading,
    isError: dbEpisodesError,
    error: dbEpisodesErr,
    refetch: refetchDbEpisodes,
  } = useEpisodes(showId, inLibrary);

  const {
    data: tmdbDetail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErr,
    refetch: refetchDetail,
  } = useTmdbShowDetail(
    showId,
    Number.isFinite(showId) && showId > 0 && hasKey
  );

  const {
    data: previewEpisodes,
    isLoading: previewEpisodesLoading,
    isError: previewEpisodesError,
    error: previewEpisodesErr,
    refetch: refetchPreviewEpisodes,
  } = useTmdbEpisodes(showId, wantPreviewEps && hasKey);

  const toggleEpisode = useToggleEpisode();
  const markEpisodes = useMarkEpisodesWatched();
  const toggleSeason = useToggleSeason();
  const setStatus = useSetShowStatus();
  const removeShow = useRemoveShow();
  const addShow = useAddShow();

  const [tab, setTab] = useState<Tab>("episodes");
  const [statusOpen, setStatusOpen] = useState(false);
  const [collapseOverrides, setCollapseOverrides] = useState<
    Record<number, boolean>
  >({});

  const show: Show | null = useMemo(() => {
    if (dbShow) return dbShow;
    if (tmdbDetail) {
      return {
        id: tmdbDetail.id,
        title: tmdbDetail.name,
        poster_path: tmdbDetail.poster_path,
        overview: tmdbDetail.overview,
        first_air_date: tmdbDetail.first_air_date,
        status: "watching",
        added_at: 0,
        source: "manual",
        media_type: "tv",
        watched_at: null,
      };
    }
    return null;
  }, [dbShow, tmdbDetail]);

  const episodes = inLibrary ? dbEpisodes ?? [] : previewEpisodes ?? [];
  const episodesLoading = inLibrary ? dbEpisodesLoading : previewEpisodesLoading;
  const episodesError = inLibrary ? dbEpisodesError : previewEpisodesError;
  const episodesErr = inLibrary ? dbEpisodesErr : previewEpisodesErr;
  const refetchEpisodes = inLibrary ? refetchDbEpisodes : refetchPreviewEpisodes;

  const sections: EpisodeSection[] = useMemo(() => {
    const bySeason = new Map<number, Episode[]>();
    for (const e of episodes) {
      if (!bySeason.has(e.season)) bySeason.set(e.season, []);
      bySeason.get(e.season)!.push(e);
    }
    return [...bySeason.entries()]
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

  const mainEpisodes = episodes.filter((e) => e.season > 0);
  const totalWatched = mainEpisodes.filter((e) => e.watched_at != null).length;
  const totalMain = mainEpisodes.length;

  useLayoutEffect(() => {
    navigation.setOptions({ title: show?.title ?? "" });
  }, [navigation, show?.title]);

  async function onToggleEpisode(e: Episode) {
    if (!inLibrary) return;
    const markingWatched = e.watched_at == null;

    if (!markingWatched) {
      toggleEpisode.mutate({
        showId: e.show_id,
        season: e.season,
        number: e.number,
        watched: false,
      });
      return;
    }

    if (!isEpisodeReleased(e)) {
      const ok = await confirmAction(
        "Episode not released",
        "This episode hasn't aired yet. Mark it as watched anyway?",
        "Mark watched"
      );
      if (!ok) return;
    }

    const skipped = skippedPriorInSeason(episodes, e);
    let toMark: { season: number; number: number }[] = [
      { season: e.season, number: e.number },
    ];

    if (skipped.length > 0) {
      if (skipEpisodePrompt === "never") {
        toMark = [
          ...skipped.map((s) => ({ season: s.season, number: s.number })),
          ...toMark,
        ];
      } else {
        const choice = await confirmSkipEpisodes(skipped.length);
        if (choice === "cancel") return;
        if (choice === "yes" || choice === "never") {
          toMark = [
            ...skipped.map((s) => ({ season: s.season, number: s.number })),
            ...toMark,
          ];
          if (choice === "never") void setSkipEpisodePrompt("never");
        }
      }
    }

    if (toMark.length === 1) {
      toggleEpisode.mutate({
        showId: e.show_id,
        season: e.season,
        number: e.number,
        watched: true,
      });
    } else {
      markEpisodes.mutate({ showId: e.show_id, episodes: toMark });
    }
  }

  async function onToggleSeason(section: EpisodeSection) {
    if (!inLibrary) return;
    const allWatched = section.watched === section.total;
    if (!allWatched) {
      const unreleased = unreleasedInSeason(episodes, section.season);
      if (unreleased.length > 0) {
        const ok = await confirmAction(
          "Some episodes aren't released",
          `${unreleased.length} episode${unreleased.length === 1 ? "" : "s"} in this season ${unreleased.length === 1 ? "hasn't" : "haven't"} aired yet. Mark the whole season watched anyway?`,
          "Mark all"
        );
        if (!ok) return;
      }
    }
    toggleSeason.mutate({
      showId,
      season: section.season,
      watched: !allWatched,
    });
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
      removeShow.mutate(
        { id: showId, mediaType: "tv" },
        {
          onSuccess: () => router.back(),
          onError: (e) => Alert.alert("Couldn't remove show", errorMessage(e)),
        }
      );
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm("Remove this show and its watch history?")) doRemove();
    } else {
      Alert.alert("Remove show", "Remove this show and its watch history?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ]);
    }
  }

  if (showLoading || (!dbShow && detailLoading)) {
    return (
      <View className="flex-1 bg-bg">
        <Loading label="Loading show…" />
      </View>
    );
  }

  if (!dbShow && detailError && !tmdbDetail) {
    return (
      <View className="flex-1 bg-bg">
        <ErrorState
          title="Couldn't load this show"
          message={errorMessage(detailErr)}
          onRetry={() => refetchDetail()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <ShowHero
        show={show}
        detail={tmdbDetail}
        inLibrary={inLibrary}
        totalWatched={totalWatched}
        total={totalMain}
        onOpenStatus={() => setStatusOpen(true)}
      />
      {!inLibrary ? (
        <View className="px-4 pt-4">
          <Button
            label={addShow.isPending ? "Adding…" : "Add to library"}
            icon="add"
            onPress={onAdd}
            disabled={addShow.isPending || !show}
          />
        </View>
      ) : null}

      <SwipeTabs
        tabs={SHOW_TABS}
        value={tab}
        onChange={setTab}
        tabBarClassName="mt-4"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {detailLoading && !tmdbDetail ? (
            <Loading label="Loading info…" />
          ) : (
            <View className="pt-4">
              <ShowInfoTab detail={tmdbDetail} />
            </View>
          )}
        </ScrollView>

        <ShowEpisodesTab
          sections={sections}
          episodes={episodes}
          inLibrary={inLibrary}
          episodesLoading={episodesLoading}
          episodesError={episodesError}
          episodesErr={episodesErr}
          onRetryEpisodes={() => refetchEpisodes()}
          onToggleCollapse={(s) =>
            setCollapseOverrides((prev) => ({
              ...prev,
              [s.season]: !s.collapsed,
            }))
          }
          onToggleSeason={onToggleSeason}
          onToggleEpisode={onToggleEpisode}
          seasonPending={(season) =>
            toggleSeason.isPending &&
            toggleSeason.variables?.showId === showId &&
            toggleSeason.variables?.season === season
          }
          episodePending={(item) =>
            (toggleEpisode.isPending &&
              toggleEpisode.variables?.showId === item.show_id &&
              toggleEpisode.variables?.season === item.season &&
              toggleEpisode.variables?.number === item.number) ||
            (markEpisodes.isPending &&
              markEpisodes.variables?.showId === item.show_id &&
              !!markEpisodes.variables?.episodes.some(
                (t) => t.season === item.season && t.number === item.number
              ))
          }
        />
      </SwipeTabs>

      {inLibrary && show ? (
        <ShowStatusSheet
          visible={statusOpen}
          current={show.status}
          onClose={() => setStatusOpen(false)}
          onSelect={(s: ShowStatus) =>
            setStatus.mutate({ id: showId, status: s })
          }
          onRemove={confirmRemove}
        />
      ) : null}
    </View>
  );
}
