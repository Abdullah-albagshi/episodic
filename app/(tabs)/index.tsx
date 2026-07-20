import { useRouter } from "expo-router";
import { useMemo } from "react";
import { SectionList, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EmptyState,
  EpisodeProgressCard,
  Loading,
  ScreenTitle,
} from "../../components/ui";
import { useContinueWatching, useToggleEpisode } from "../../lib/queries";
import type { ContinueItem } from "../../lib/types";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // ~1 month

export default function HomeScreen() {
  const router = useRouter();
  const { data: items, isLoading } = useContinueWatching();
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
    // Latest activity first.
    current.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    stale.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    const result: { title: string; data: ContinueItem[] }[] = [];
    if (current.length > 0) {
      result.push({ title: "Currently watching", data: current });
    }
    if (stale.length > 0) {
      result.push({ title: "Haven't watched in a while", data: stale });
    }
    return result;
  }, [items]);

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
      <ScreenTitle title="Up next" subtitle="Continue watching your shows" />
      {isLoading ? (
        <Loading />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="play-circle-outline"
          title="Nothing queued up"
          subtitle="Add shows to your library and mark them as Watching to see the next episode here."
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
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
