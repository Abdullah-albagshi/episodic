import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EmptyState,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
  ScreenTitle,
} from "../../components/ui";
import { useUpcoming } from "../../lib/queries";
import type { Episode, Show } from "../../lib/types";

type Row = { show: Show; episode: Episode };

const DAY_MS = 86_400_000;

const BUCKETS = [
  "Released last week",
  "Today",
  "Tomorrow",
  "This week",
  "This month",
  "Later this year",
  "Later",
] as const;
type Bucket = (typeof BUCKETS)[number];

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function airDayStart(airDate: string): number {
  return startOfLocalDay(new Date(airDate + "T00:00:00"));
}

function bucketFor(airDate: string, now: Date): Bucket | null {
  const day = airDayStart(airDate);
  const today = startOfLocalDay(now);
  const tomorrow = today + DAY_MS;
  const lastWeek = today - 7 * DAY_MS;
  const dow = now.getDay();
  const daysToNextMonday = (8 - dow) % 7 || 7;
  const endOfWeek = today + daysToNextMonday * DAY_MS;
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).getTime();
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();

  if (day < today) return day >= lastWeek ? "Released last week" : null;
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  if (day < endOfWeek) return "This week";
  if (day < endOfMonth) return "This month";
  if (day < endOfYear) return "Later this year";
  return "Later";
}

function formatAir(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function UpcomingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: rows, isLoading, isError, error, refetch } = useUpcoming();

  const sections = useMemo(() => {
    if (!rows) return [];
    const now = new Date();
    const map = new Map<Bucket, Row[]>();
    for (const row of rows) {
      if (!row.episode.air_date) continue;
      const bucket = bucketFor(row.episode.air_date, now);
      if (!bucket) continue;
      const list = map.get(bucket);
      if (list) list.push(row);
      else map.set(bucket, [row]);
    }
    return BUCKETS.filter((b) => map.has(b)).map((b) => ({
      title: b,
      data: map.get(b)!,
    }));
  }, [rows]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle
        title={t("upcoming.title")}
        subtitle={t("upcoming.subtitle")}
      />
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState
          title={t("upcoming.errorTitle")}
          message={errorMessage(error)}
          onRetry={() => refetch()}
          retryLabel={t("common.tryAgain")}
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={t("upcoming.emptyTitle")}
          subtitle={t("upcoming.emptySubtitle")}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(r) =>
            `${r.show.id}:${r.episode.season}:${r.episode.number}`
          }
          contentContainerStyle={{ padding: 16, gap: 12 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text className="text-muted font-semibold uppercase text-xs tracking-wide mt-2 mb-1">
              {section.title}
            </Text>
          )}
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
