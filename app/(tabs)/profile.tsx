import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  EmptyState,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
  ScreenTitle,
} from "../../components/ui";
import type { AppLocale } from "../../lib/i18n";
import { formatMonthYear } from "../../lib/dates";
import {
  useClearAll,
  useExportBackup,
  useRestoreBackup,
  useStats,
} from "../../lib/queries";
import { useAppStore } from "../../lib/store";
import { SHOW_STATUSES, type ShowStatus } from "../../lib/types";

const STATUS_DOT: Record<ShowStatus, string> = {
  watching: "bg-primary",
  plan: "bg-warning",
  paused: "bg-[#5b8def]",
  completed: "bg-success",
  dropped: "bg-muted",
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-surface rounded-2xl p-4 mb-4">
      <Text className="text-text font-semibold mb-3">{title}</Text>
      {children}
    </View>
  );
}

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

export default function YouScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: stats, isLoading, isError, error, refetch } = useStats();

  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const [key, setKey] = useState(apiKey ?? "");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const ok = (text: string) => setStatus({ text, error: false });
  const fail = (e: unknown) => setStatus({ text: errorMessage(e), error: true });

  const exportBackup = useExportBackup();
  const restoreBackup = useRestoreBackup();
  const clearAll = useClearAll();

  useEffect(() => {
    setKey(apiKey ?? "");
  }, [apiKey]);

  async function onSaveKey() {
    await setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function onExport() {
    setStatus(null);
    exportBackup.mutate(undefined, {
      onSuccess: (msg) => ok(msg),
      onError: (e) => fail(e),
    });
  }

  async function onRestore() {
    setStatus(null);
    try {
      const DocumentPicker = require("expo-document-picker");
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      let text: string;
      if (
        asset.uri.startsWith("data:") ||
        asset.uri.startsWith("blob:") ||
        asset.file
      ) {
        text = await (await fetch(asset.uri)).text();
      } else {
        const { File } = require("expo-file-system");
        text = await new File(asset.uri).text();
      }
      restoreBackup.mutate(text, {
        onSuccess: () => ok(t("you.backupRestored")),
        onError: (e) => fail(e),
      });
    } catch (e) {
      fail(e);
    }
  }

  function onClear() {
    const doClear = () =>
      clearAll.mutate(undefined, {
        onSuccess: () => ok(t("you.dataCleared")),
        onError: (e) => fail(e),
      });
    if (typeof window !== "undefined" && window.confirm) {
      if (
        window.confirm(
          "Delete ALL shows and watch history? This cannot be undone."
        )
      )
        doClear();
    } else {
      Alert.alert(
        t("you.clearAll"),
        "Delete ALL shows and watch history? This cannot be undone.",
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doClear },
        ]
      );
    }
  }

  async function onLocale(next: AppLocale) {
    if (next === locale) return;
    await setLocale(next);
  }

  const settingsBlock = (
    <>
      <Text className="text-text text-lg font-bold mb-3 mt-2">
        {t("you.settings")}
      </Text>

      <Card title={t("you.language")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.languageHint")}
        </Text>
        <View className="flex-row gap-2">
          {(["en", "ar"] as const).map((code) => {
            const active = locale === code;
            return (
              <Pressable
                key={code}
                onPress={() => onLocale(code)}
                className={`flex-1 h-11 rounded-xl items-center justify-center ${
                  active ? "bg-primary" : "bg-surface2"
                }`}
              >
                <Text
                  className={`font-semibold ${
                    active ? "text-white" : "text-text"
                  }`}
                >
                  {code === "en" ? t("you.english") : t("you.arabic")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title={t("you.tmdbTitle")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.tmdbHint")}
        </Text>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder={t("you.tmdbPlaceholder")}
          placeholderTextColor="#9a9ab0"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-surface2 text-text rounded-xl px-3 py-3 mb-3"
        />
        <Button
          label={saved ? t("you.saved") : t("you.saveKey")}
          icon={saved ? "checkmark" : "save-outline"}
          onPress={onSaveKey}
        />
        <Pressable
          onPress={() =>
            Linking.openURL("https://www.themoviedb.org/settings/api")
          }
          className="mt-3 flex-row items-center gap-1"
        >
          <Ionicons name="open-outline" size={14} color="#7c5cff" />
          <Text className="text-primary text-sm">{t("you.getKey")}</Text>
        </Pressable>
      </Card>

      <Card title={t("you.importTitle")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.importHint")}
        </Text>
        <Button
          label={t("you.importButton")}
          icon="cloud-upload-outline"
          variant="surface"
          onPress={() => router.push("/import")}
        />
      </Card>

      <Card title={t("you.backupTitle")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.backupHint")}
        </Text>
        <Button
          label={
            exportBackup.isPending ? t("you.exporting") : t("you.exportBackup")
          }
          icon="download-outline"
          variant="surface"
          onPress={onExport}
          disabled={exportBackup.isPending}
          className="mb-2"
        />
        <Button
          label={
            restoreBackup.isPending
              ? t("you.restoring")
              : t("you.restoreBackup")
          }
          icon="cloud-download-outline"
          variant="surface"
          onPress={onRestore}
          disabled={restoreBackup.isPending}
        />
      </Card>

      <Card title={t("you.dangerTitle")}>
        <Button
          label={t("you.clearAll")}
          icon="trash-outline"
          variant="danger"
          onPress={onClear}
        />
      </Card>

      {status ? (
        <Text
          className={`text-center mb-4 ${
            status.error ? "text-accent" : "text-success"
          }`}
        >
          {status.text}
        </Text>
      ) : null}

      <Text className="text-muted text-center text-xs mb-4">
        {t("you.footer")}
      </Text>
    </>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScreenTitle title={t("you.title")} subtitle={t("you.subtitle")} />
        <Loading />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <ScreenTitle title={t("you.title")} subtitle={t("you.subtitle")} />
        <ErrorState
          title={t("you.errorTitle")}
          message={errorMessage(error)}
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const emptyStats = !stats || stats.totalShows === 0;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title={t("you.title")} subtitle={t("you.subtitle")} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16 }}
      >
        {emptyStats ? (
          <EmptyState
            icon="stats-chart-outline"
            title={t("you.noStatsTitle")}
            subtitle={t("you.noStatsSubtitle")}
          />
        ) : (
          <>
            <View className="bg-surface rounded-2xl p-5">
              <View className="flex-row items-center gap-2 mb-4">
                <Ionicons name="time-outline" size={16} color="#7c5cff" />
                <Text className="text-muted font-semibold uppercase text-xs tracking-wide">
                  {t("you.watchTime")}
                </Text>
              </View>
              <View className="flex-row">
                <TimeSegment
                  value={stats!.watchTime.months}
                  unit={t("you.months")}
                />
                <View className="w-px bg-surface2" />
                <TimeSegment
                  value={stats!.watchTime.days}
                  unit={t("you.days")}
                />
                <View className="w-px bg-surface2" />
                <TimeSegment
                  value={stats!.watchTime.hours}
                  unit={t("you.hours")}
                />
              </View>
              <Text className="text-muted text-xs text-center mt-4">
                {stats!.watchTime.estimated ? "≈ " : ""}
                {stats!.watchTime.totalHours.toLocaleString()} hours across{" "}
                {stats!.episodesWatched.toLocaleString()} episodes
                {stats!.watchTime.estimated ? "" : " · from TV Time"}
              </Text>
            </View>

            <View className="gap-3">
              <View className="flex-row gap-3">
                <StatCard
                  icon="checkmark-done-outline"
                  value={stats!.episodesWatched.toLocaleString()}
                  label={t("you.episodesWatched")}
                  tint="#7c5cff"
                />
                <StatCard
                  icon="tv-outline"
                  value={stats!.totalShows.toLocaleString()}
                  label={t("you.showsTracked")}
                  tint="#37d39b"
                />
              </View>
              <View className="flex-row gap-3">
                <StatCard
                  icon="layers-outline"
                  value={stats!.seasonsCompleted.toLocaleString()}
                  label={t("you.seasonsCompleted")}
                  tint="#f5b544"
                />
                <StatCard
                  icon="play-circle-outline"
                  value={stats!.showsByStatus.watching.toLocaleString()}
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
                      <View
                        className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`}
                      />
                      <Text className="text-muted">{t(`status.${s}`)}</Text>
                    </View>
                    <Text className="text-text font-semibold">
                      {stats!.showsByStatus[s]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {stats!.topShow ? (
              <View className="bg-surface rounded-2xl p-4">
                <Text className="text-text font-semibold mb-3">
                  {t("you.mostWatched")}
                </Text>
                <View className="flex-row items-center gap-3">
                  <Poster
                    path={stats!.topShow.poster_path}
                    size="w185"
                    title={stats!.topShow.title}
                    className="w-14 h-20 rounded-xl overflow-hidden"
                  />
                  <View className="flex-1">
                    <Text numberOfLines={2} className="text-text font-semibold">
                      {stats!.topShow.title}
                    </Text>
                    <Text className="text-primary text-sm mt-1">
                      {stats!.topShow.watched} {t("you.episodesWatched").toLowerCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {stats!.memberSince ? (
              <Text className="text-muted text-center text-xs">
                {t("you.trackingSince", {
                  date: formatMonthYear(stats!.memberSince),
                })}
              </Text>
            ) : null}
          </>
        )}

        {settingsBlock}
      </ScrollView>
    </SafeAreaView>
  );
}
