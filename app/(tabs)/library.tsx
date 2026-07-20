import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Loading, Poster, ScreenTitle } from "../../components/ui";
import { useShows } from "../../lib/queries";
import { useAppStore, type LibraryFilter } from "../../lib/store";
import { SHOW_STATUSES } from "../../lib/types";

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
  const { data: shows, isLoading } = useShows();
  const filter = useAppStore((s) => s.libraryFilter);
  const setFilter = useAppStore((s) => s.setLibraryFilter);

  const filtered = useMemo(() => {
    if (!shows) return [];
    return filter === "all" ? shows : shows.filter((s) => s.status === filter);
  }, [shows, filter]);

  const counts = useMemo(() => {
    const c: Record<LibraryFilter, number> = {
      all: shows?.length ?? 0,
      watching: 0,
      plan: 0,
      completed: 0,
      dropped: 0,
    };
    for (const s of shows ?? []) c[s.status] += 1;
    return c;
  }, [shows]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Library" subtitle="Every show you track" />

      <View className="mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
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
      </View>

      {isLoading || !shows ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title={
            shows.length === 0 ? "Your library is empty" : "Nothing here yet"
          }
          subtitle={
            shows.length === 0
              ? "Use Search to add shows, or import your history from TV Time in Settings."
              : "No shows with this status."
          }
        />
      ) : (
        <FlatList
          data={filtered}
          key={"grid"}
          numColumns={4}
          keyExtractor={(s) => String(s.id)}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 16, paddingVertical: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/show/${item.id}`)}
              className="flex-1 active:opacity-80 max-w-[25%]"
            >
              <Poster
                path={item.poster_path}
                title={item.title}
                className="w-full aspect-[2/3] rounded-xl"
              />
              <Text
                numberOfLines={1}
                className="text-text text-xs mt-1.5 font-medium"
              >
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
