import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Loading, Poster, ScreenTitle } from "../../components/ui";
import { useUpcoming } from "../../lib/queries";

function formatAir(date: string): string {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  const label = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (days <= 0) return `Today · ${label}`;
  if (days === 1) return `Tomorrow · ${label}`;
  if (days < 7) return `In ${days} days · ${label}`;
  return label;
}

export default function UpcomingScreen() {
  const router = useRouter();
  const { data: rows, isLoading } = useUpcoming();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Upcoming" subtitle="New episodes on the way" />
      {isLoading ? (
        <Loading />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming episodes"
          subtitle="When shows you track have future air dates, they'll appear here."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.show.id}:${r.episode.season}:${r.episode.number}`}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/show/${item.show.id}`)}
              className="flex-row items-center bg-surface rounded-2xl overflow-hidden active:opacity-80"
            >
              <Poster
                path={item.show.poster_path}
                size="w185"
                title={item.show.title}
                className="w-14 h-20"
              />
              <View className="flex-1 p-3">
                <Text numberOfLines={1} className="text-text font-semibold">
                  {item.show.title}
                </Text>
                <Text className="text-primary text-sm mt-0.5">
                  S{item.episode.season} · E{item.episode.number}
                  {item.episode.title ? ` — ${item.episode.title}` : ""}
                </Text>
                <Text className="text-muted text-xs mt-1">
                  {formatAir(item.episode.air_date!)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
