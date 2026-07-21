import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EmptyState,
  EpisodeProgressCard,
  ErrorState,
  errorMessage,
  Loading,
  ScreenTitle,
} from "../../components/ui";
import { useContinueWatching, useToggleEpisode } from "../../lib/queries";
import type { ContinueItem } from "../../lib/types";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // ~1 month

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    data: items,
    isLoading,
    isError,
    error,
    refetch,
  } = useContinueWatching();
  const toggleEpisode = useToggleEpisode();

  const sections = useMemo(() => {
    if (!items) return [];
    const cutoff = Date.now() - STALE_AFTER_MS;
    const current: ContinueItem[] = [];
    const stale: ContinueItem[] = [];
    for (const item of items) {
      const isStale = item.watchedCount === 0 || item.lastActivityAt < cutoff;
      (isStale ? stale : current).push(item);
    }
    current.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    stale.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    const result: { title: string; data: ContinueItem[] }[] = [];
    if (current.length > 0) {
      result.push({ title: t("home.currentlyWatching"), data: current });
    }
    if (stale.length > 0) {
      result.push({ title: t("home.stale"), data: stale });
    }
    return result;
  }, [items, t]);

  function markWatched(item: ContinueItem) {
    toggleEpisode.mutate({
      showId: item.show.id,
      season: item.next.season,
      number: item.next.number,
      watched: true,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title={t("home.title")} subtitle={t("home.subtitle")} />
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState
          title={t("home.errorTitle")}
          message={errorMessage(error)}
          onRetry={() => refetch()}
          retryLabel={t("common.tryAgain")}
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="play-circle-outline"
          title={t("home.emptyTitle")}
          subtitle={t("home.emptySubtitle")}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => String(i.show.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text className="text-muted font-semibold uppercase text-xs tracking-wide mt-2 mb-1">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <EpisodeProgressCard
              show={item.show}
              next={item.next}
              watchedCount={item.watchedCount}
              totalCount={item.totalCount}
              onPress={() => router.push(`/show/${item.show.id}`)}
              onMarkWatched={() => markWatched(item)}
              marking={
                toggleEpisode.isPending &&
                toggleEpisode.variables?.showId === item.show.id
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
