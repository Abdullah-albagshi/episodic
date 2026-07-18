import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button, EmptyState } from "../components/ui";
import { useImportTvTime } from "../lib/queries";
import { useAppStore } from "../lib/store";
import type { ImportProgress, TvTimeFiles } from "../lib/import/tvtime";

function formatRuntime(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const totalHours = Math.floor(seconds / 3600);
  const months = Math.floor(totalHours / (24 * 30));
  const rem = totalHours - months * 24 * 30;
  const days = Math.floor(rem / 24);
  const hours = rem % 24;
  const parts: string[] = [];
  if (months) parts.push(`${months} mo`);
  if (days) parts.push(`${days} d`);
  parts.push(`${hours} h`);
  return parts.join(" ");
}

async function readAsset(asset: any): Promise<string> {
  if (asset.uri.startsWith("blob:") || asset.uri.startsWith("data:") || asset.file) {
    return await (await fetch(asset.uri)).text();
  }
  const FileSystem = require("expo-file-system");
  return await FileSystem.readAsStringAsync(asset.uri);
}

/**
 * Let the user pick one or more files from their GDPR export and sort them by
 * filename. Only the tracking log is required; the companion files improve
 * status and validation. A single arbitrary CSV is still treated as tracking.
 */
async function pickImportFiles(): Promise<TvTimeFiles | null> {
  const DocumentPicker = require("expo-document-picker");
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "*/*"],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (res.canceled) return null;
  const assets: any[] = res.assets ?? [];
  if (assets.length === 0) return null;

  let tracking: string | undefined;
  let trackingV1: string | undefined;
  let userShowData: string | undefined;
  let followed: string | undefined;
  const unclassified: string[] = [];

  for (const asset of assets) {
    const name = (asset.name ?? "").toLowerCase();
    const text = await readAsset(asset);
    if (name.includes("records-v2")) tracking = text;
    else if (name.includes("tracking-prod-records")) trackingV1 = text;
    else if (name.includes("user_tv_show_data")) userShowData = text;
    else if (name.includes("followed_tv_show")) followed = text;
    else unclassified.push(text);
  }

  // Fall back to the v1 log, then to a lone unclassified CSV (legacy behavior).
  if (!tracking) tracking = trackingV1;
  if (!tracking && unclassified.length === 1) tracking = unclassified[0];

  if (!tracking) {
    throw new Error(
      "Couldn't find tracking-prod-records-v2.csv among the selected files."
    );
  }
  return { tracking, userShowData, followed };
}

export default function ImportScreen() {
  const router = useRouter();
  const hasKey = !!useAppStore((s) => s.apiKey);
  const importMutation = useImportTvTime();
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = importMutation.data;

  async function start() {
    setError(null);
    setProgress(null);
    try {
      const files = await pickImportFiles();
      if (files == null) return;
      await importMutation.mutateAsync({ files, onProgress: setProgress });
    } catch (e: any) {
      setError(e?.message ?? "Import failed");
    } finally {
      setProgress(null);
    }
  }

  if (!hasKey) {
    return (
      <View className="flex-1 bg-bg">
        <EmptyState
          icon="key-outline"
          title="TMDB key required"
          subtitle="Importing matches your shows against The Movie Database. Add an API key in Settings first."
          action={
            <Button
              label="Go to Settings"
              icon="settings-outline"
              onPress={() => router.replace("/(tabs)/settings")}
            />
          }
        />
      </View>
    );
  }

  if (importMutation.isPending) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <ActivityIndicator color="#7c5cff" size="large" />
        <Text className="text-text font-semibold mt-4">Importing…</Text>
        {progress ? (
          <>
            <Text className="text-muted mt-1 text-center">
              {progress.current} / {progress.total} · {progress.label}
            </Text>
            <View className="h-1.5 bg-surface2 rounded-full overflow-hidden w-full mt-4">
              <View
                className="h-full bg-primary"
                style={{
                  width: `${Math.round(
                    (progress.current / progress.total) * 100
                  )}%`,
                }}
              />
            </View>
          </>
        ) : null}
        <Text className="text-muted text-xs mt-4 text-center">
          Matching each show against TMDB and fetching episodes. This can take a
          minute for large histories.
        </Text>
      </View>
    );
  }

  if (summary) {
    const totalWatched = summary.matched.reduce((n, m) => n + m.watched, 0);
    const runtimeLabel = formatRuntime(summary.totalRuntimeSeconds);
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="bg-surface rounded-2xl p-4 mb-4 items-center">
          <Ionicons name="checkmark-circle" size={40} color="#3ecf8e" />
          <Text className="text-text text-lg font-bold mt-2">
            Import complete
          </Text>
          <Text className="text-muted text-center mt-1">
            {summary.matched.length} shows matched ·{" "}
            {summary.episodeWatchCount
              ? `${totalWatched} of ${summary.episodeWatchCount}`
              : totalWatched}{" "}
            episodes restored
          </Text>
          {runtimeLabel ? (
            <Text className="text-primary text-center mt-1">
              {runtimeLabel} of watch time
            </Text>
          ) : null}
        </View>

        {summary.matched.length > 0 ? (
          <Section title={`Matched (${summary.matched.length})`}>
            {summary.matched.map((m) => {
              const partial = m.watched < m.expected;
              return (
                <View key={m.name} className="flex-row justify-between py-1.5">
                  <Text className="text-text flex-1" numberOfLines={1}>
                    {m.name}
                    {m.matchedTitle !== m.name ? (
                      <Text className="text-muted"> → {m.matchedTitle}</Text>
                    ) : null}
                  </Text>
                  <Text className={partial ? "text-warning ml-2" : "text-success ml-2"}>
                    {m.watched}
                    {partial ? `/${m.expected}` : ""}
                  </Text>
                </View>
              );
            })}
          </Section>
        ) : null}

        {summary.unmatched.length > 0 ? (
          <Section title={`Not found (${summary.unmatched.length})`}>
            <Text className="text-muted text-xs mb-2">
              These weren't found on TMDB. Add them manually via Search.
            </Text>
            {summary.unmatched.map((n) => (
              <Text key={n} className="text-warning py-1" numberOfLines={1}>
                {n}
              </Text>
            ))}
          </Section>
        ) : null}

        {summary.failed.length > 0 ? (
          <Section title={`Errors (${summary.failed.length})`}>
            {summary.failed.map((f) => (
              <Text key={f.name} className="text-accent py-1 text-xs">
                {f.name}: {f.error}
              </Text>
            ))}
          </Section>
        ) : null}

        <Button
          label="Done"
          icon="checkmark"
          onPress={() => router.replace("/(tabs)/library")}
          className="mt-2"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16 }}>
      <View className="bg-surface rounded-2xl p-5 mb-4">
        <Ionicons name="cloud-upload-outline" size={32} color="#7c5cff" />
        <Text className="text-text text-lg font-bold mt-3">
          Bring your history from TV Time
        </Text>
        <Text className="text-muted mt-2 leading-5">
          TV Time is shutting down on July 15, 2026 and will delete all user
          data. Export your data from TV Time's GDPR tool, then select the CSV
          files here. Episodic matches each show against TMDB and restores your
          watched episodes.
        </Text>
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-4">
        <Step n={1} text="In TV Time, request your data export (GDPR download)." />
        <Step n={2} text="Unzip it. The key file is tracking-prod-records-v2.csv." />
        <Step
          n={3}
          text="For best results also select user_tv_show_data.csv and followed_tv_show.csv."
        />
        <Step n={4} text="Pick the file(s) below to start the import." />
      </View>

      {error ? (
        <Text className="text-accent text-center mb-3">{error}</Text>
      ) : null}

      <Button label="Select CSV files" icon="document-outline" onPress={start} />
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-surface rounded-2xl p-4 mb-4">
      <Text className="text-text font-semibold mb-2">{title}</Text>
      {children}
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View className="flex-row items-start mb-2">
      <View className="w-6 h-6 rounded-full bg-primary/20 items-center justify-center mr-3">
        <Text className="text-primary text-xs font-bold">{n}</Text>
      </View>
      <Text className="text-muted flex-1 leading-5">{text}</Text>
    </View>
  );
}
