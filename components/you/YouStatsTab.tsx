import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
} from "../ui";
import { formatMonthYear } from "../../lib/dates";
import { useStats } from "../../lib/queries";
import { SHOW_STATUSES, type ShowStatus } from "../../lib/types";

const STATUS_DOT: Record<ShowStatus, string> = {
  watching: "bg-primary",
  plan: "bg-warning",
  paused: "bg-[#5b8def]",
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

export function YouStatsTab() {
  const { t } = useTranslation();
  const { data: stats, isLoading, isError, error, refetch } = useStats();

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <ErrorState
        title={t("you.errorTitle")}
        message={errorMessage(error)}
        onRetry={() => refetch()}
        retryLabel={t("common.tryAgain")}
      />
    );
  }

  if (!stats || stats.totalShows === 0) {
    return (
      <EmptyState
        icon="stats-chart-outline"
        title={t("you.noStatsTitle")}
        subtitle={t("you.noStatsSubtitle")}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 16 }}
    >
      <View className="bg-surface rounded-2xl p-5">
        <View className="flex-row items-center gap-2 mb-4">
          <Ionicons name="time-outline" size={16} color="#7c5cff" />
          <Text className="text-muted font-semibold uppercase text-xs tracking-wide">
            {t("you.watchTime")}
          </Text>
        </View>
        <View className="flex-row">
          <TimeSegment value={stats.watchTime.months} unit={t("you.months")} />
          <View className="w-px bg-surface2" />
          <TimeSegment value={stats.watchTime.days} unit={t("you.days")} />
          <View className="w-px bg-surface2" />
          <TimeSegment value={stats.watchTime.hours} unit={t("you.hours")} />
        </View>
        <Text className="text-muted text-xs text-center mt-4">
          {stats.watchTime.estimated ? "≈ " : ""}
          {stats.watchTime.totalHours.toLocaleString()} hours across{" "}
          {stats.episodesWatched.toLocaleString()} episodes
          {stats.watchTime.estimated ? "" : " · from TV Time"}
        </Text>
      </View>

      <View className="gap-3">
        <View className="flex-row gap-3">
          <StatCard
            icon="checkmark-done-outline"
            value={stats.episodesWatched.toLocaleString()}
            label={t("you.episodesWatched")}
            tint="#7c5cff"
          />
          <StatCard
            icon="tv-outline"
            value={stats.totalShows.toLocaleString()}
            label={t("you.showsTracked")}
            tint="#37d39b"
          />
        </View>
        <View className="flex-row gap-3">
          <StatCard
            icon="layers-outline"
            value={stats.seasonsCompleted.toLocaleString()}
            label={t("you.seasonsCompleted")}
            tint="#f5b544"
          />
          <StatCard
            icon="play-circle-outline"
            value={stats.showsByStatus.watching.toLocaleString()}
            label={t("you.currentlyWatching")}
            tint="#ff5c8a"
          />
        </View>
      </View>

      <View className="bg-surface rounded-2xl p-4">
        <Text className="text-text font-semibold mb-3">
          {t("you.libraryBreakdown")}
        </Text>
        <View className="gap-2.5">
          {SHOW_STATUSES.map((s) => (
            <View
              key={s}
              className="flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2.5">
                <View className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} />
                <Text className="text-muted">{t(`status.${s}`)}</Text>
              </View>
              <Text className="text-text font-semibold">
                {stats.showsByStatus[s]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {stats.topShow ? (
        <View className="bg-surface rounded-2xl p-4">
          <Text className="text-text font-semibold mb-3">
            {t("you.mostWatched")}
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
                {stats.topShow.watched}{" "}
                {t("you.episodesWatched").toLowerCase()}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {stats.memberSince ? (
        <Text className="text-muted text-center text-xs mb-4">
          {t("you.trackingSince", {
            date: formatMonthYear(stats.memberSince),
          })}
        </Text>
      ) : null}
    </ScrollView>
  );
}
