import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LibraryCompactRow,
  LibraryGridItem,
  LibraryViewSwitcher,
} from "../../components/library";
import {
  EmptyState,
  EpisodeProgressCard,
  Loading,
  ScreenTitle,
} from "../../components/ui";
import { useLibraryOverview, useToggleEpisode } from "../../lib/queries";
import { useAppStore, type LibraryFilter } from "../../lib/store";
import { SHOW_STATUSES, type LibraryEntry } from "../../lib/types";

const FILTERS: LibraryFilter[] = ["all", ...SHOW_STATUSES];
const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: "All",
  watching: "Watching",
  plan: "Plan",
  completed: "Completed",
  dropped: "Dropped",
};

export default function LibraryScreen() {
  const router = useRouter();
  const { data: entries, isLoading } = useLibraryOverview();
  const toggleEpisode = useToggleEpisode();
  const filter = useAppStore((s) => s.libraryFilter);
  const setFilter = useAppStore((s) => s.setLibraryFilter);
  const view = useAppStore((s) => s.libraryView);
  const setView = useAppStore((s) => s.setLibraryView);

  const filtered = useMemo(() => {
    if (!entries) return [];
    return filter === "all"
      ? entries
      : entries.filter((e) => e.show.status === filter);
  }, [entries, filter]);

  const counts = useMemo(() => {
    const c: Record<LibraryFilter, number> = {
      all: entries?.length ?? 0,
      watching: 0,
      plan: 0,
      completed: 0,
      dropped: 0,
    };
    for (const e of entries ?? []) c[e.show.status] += 1;
    return c;
  }, [entries]);

  function openShow(entry: LibraryEntry) {
    router.push(`/show/${entry.show.id}`);
  }

  function markWatched(entry: LibraryEntry) {
    if (!entry.next) return;
    toggleEpisode.mutate({
      showId: entry.show.id,
      season: entry.next.season,
      number: entry.next.number,
      watched: true,
    });
  }

  function renderItem(entry: LibraryEntry) {
    switch (view) {
      case "grid":
        return <LibraryGridItem entry={entry} onPress={() => openShow(entry)} />;
      case "compact":
        return (
          <LibraryCompactRow entry={entry} onPress={() => openShow(entry)} />
        );
      case "list":
      default:
        return (
          <EpisodeProgressCard
            show={entry.show}
            next={entry.next}
            watchedCount={entry.watchedCount}
            totalCount={entry.totalCount}
            onPress={() => openShow(entry)}
            onMarkWatched={entry.next ? () => markWatched(entry) : undefined}
          />
        );
    }
  }

  const numColumns = view === "grid" ? 4 : 1;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Library" subtitle="Every show you track" />

      <View className="flex-row items-center mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            alignItems: "center",
          }}
        >
          {FILTERS.map((f) => {
            const active = f === filter;
            const count = counts[f];
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                className={`h-9 px-3 rounded-full flex-row items-center ${
                  active ? "bg-primary" : "bg-surface"
                }`}
              >
                <Text
                  className={`font-medium ${
                    active ? "text-white" : "text-muted"
                  }`}
                >
                  {FILTER_LABELS[f]}
                  {count > 0 ? ` · ${count}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="pl-2 pr-4">
          <LibraryViewSwitcher value={view} onChange={setView} />
        </View>
      </View>

      {isLoading || !entries ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title={
            entries.length === 0 ? "Your library is empty" : "Nothing here yet"
          }
          subtitle={
            entries.length === 0
              ? "Use Search to add shows, or import your history from TV Time in Settings."
              : "No shows with this status."
          }
        />
      ) : (
        <FlatList
          // Remount when column count changes; FlatList can't switch numColumns live.
          key={view}
          data={filtered}
          numColumns={numColumns}
          keyExtractor={(e) => String(e.show.id)}
          columnWrapperStyle={
            view === "grid" ? { gap: 12, paddingHorizontal: 16 } : undefined
          }
          contentContainerStyle={
            view === "grid"
              ? { gap: 16, paddingVertical: 8 }
              : view === "list"
              ? { padding: 16, gap: 12 }
              : { paddingHorizontal: 16, paddingVertical: 4 }
          }
          renderItem={({ item }) => renderItem(item)}
        />
      )}
    </SafeAreaView>
  );
}
