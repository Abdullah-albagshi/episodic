import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Loading, Poster, ScreenTitle } from "../../components/ui";
import { useStats } from "../../lib/queries";
import { SHOW_STATUSES, STATUS_LABELS, type ShowStatus } from "../../lib/types";

const STATUS_DOT: Record<ShowStatus, string> = {
  watching: "bg-primary",
  plan: "bg-warning",
  completed: "bg-success",
  dropped: "bg-muted",
};

function StatCard({
  icon,
  value,
  label,
  tint = "#7c5cff",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  tint?: string;
}) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4">
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mb-3"
        style={{ backgroundColor: `${tint}22` }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text className="text-text text-2xl font-bold">{value}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
    </View>
  );
}

function TimeSegment({ value, unit }: { value: number; unit: string }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-text text-3xl font-bold">{value}</Text>
      <Text className="text-muted text-xs uppercase tracking-wide mt-1">
        {unit}
      </Text>
    </View>
  );
}

function formatMemberSince(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScreenTitle title="Profile" subtitle="Your watch stats" />
        <Loading />
      </SafeAreaView>
    );
  }

  if (!stats || stats.totalShows === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScreenTitle title="Profile" subtitle="Your watch stats" />
        <EmptyState
          icon="stats-chart-outline"
          title="No stats yet"
          subtitle="Add shows to your library and mark episodes as watched to start building your profile."
        />
      </SafeAreaView>
    );
  }

  const { watchTime } = stats;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Profile" subtitle="Your watch stats" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16 }}
      >
        {/* Watch time hero */}
        <View className="bg-surface rounded-2xl p-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="time-outline" size={16} color="#7c5cff" />
            <Text className="text-muted font-semibold uppercase text-xs tracking-wide">
              Total watch time
            </Text>
          </View>
          <View className="flex-row">
            <TimeSegment value={watchTime.months} unit="Months" />
            <View className="w-px bg-surface2" />
            <TimeSegment value={watchTime.days} unit="Days" />
            <View className="w-px bg-surface2" />
            <TimeSegment value={watchTime.hours} unit="Hours" />
          </View>
          <Text className="text-muted text-xs text-center mt-4">
            ≈ {watchTime.totalHours.toLocaleString()} hours across{" "}
            {stats.episodesWatched.toLocaleString()} episodes
          </Text>
        </View>

        {/* Key stats grid */}
        <View className="gap-3">
          <View className="flex-row gap-3">
            <StatCard
              icon="checkmark-done-outline"
              value={stats.episodesWatched.toLocaleString()}
              label="Episodes watched"
              tint="#7c5cff"
            />
            <StatCard
              icon="tv-outline"
              value={stats.totalShows.toLocaleString()}
              label="TV shows tracked"
              tint="#37d39b"
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard
              icon="layers-outline"
              value={stats.seasonsCompleted.toLocaleString()}
              label="Seasons completed"
              tint="#f5b544"
            />
            <StatCard
              icon="play-circle-outline"
              value={stats.showsByStatus.watching.toLocaleString()}
              label="Currently watching"
              tint="#ff5c8a"
            />
          </View>
        </View>

        {/* Library breakdown */}
        <View className="bg-surface rounded-2xl p-4">
          <Text className="text-text font-semibold mb-3">Library breakdown</Text>
          <View className="gap-2.5">
            {SHOW_STATUSES.map((status) => (
              <View
                key={status}
                className="flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`}
                  />
                  <Text className="text-muted">{STATUS_LABELS[status]}</Text>
                </View>
                <Text className="text-text font-semibold">
                  {stats.showsByStatus[status]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Most watched show */}
        {stats.topShow ? (
          <View className="bg-surface rounded-2xl p-4">
            <Text className="text-text font-semibold mb-3">
              Most watched show
            </Text>
            <View className="flex-row items-center gap-3">
              <Poster
                path={stats.topShow.poster_path}
                size="w185"
                title={stats.topShow.title}
                className="w-14 h-20 rounded-xl overflow-hidden"
              />
              <View className="flex-1">
                <Text numberOfLines={2} className="text-text font-semibold">
                  {stats.topShow.title}
                </Text>
                <Text className="text-primary text-sm mt-1">
                  {stats.topShow.watched} episodes watched
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {stats.memberSince ? (
          <Text className="text-muted text-center text-xs">
            Tracking shows since {formatMemberSince(stats.memberSince)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
