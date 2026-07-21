import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button, EmptyState } from "../components/ui";
import {
  collectTvTimeFiles,
  collectTvTimeFilesFromZip,
  type ImportProgress,
  type TvTimeFiles,
} from "../lib/import/tvtime";
import { useImportTvTime } from "../lib/queries";
import { useAppStore } from "../lib/store";

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

async function readAssetText(asset: any): Promise<string> {
  if (
    asset.uri.startsWith("blob:") ||
    asset.uri.startsWith("data:") ||
    asset.file
  ) {
    return await (await fetch(asset.uri)).text();
  }
  const { File } = require("expo-file-system");
  return await new File(asset.uri).text();
}

async function readAssetBytes(asset: any): Promise<ArrayBuffer> {
  if (
    asset.uri.startsWith("blob:") ||
    asset.uri.startsWith("data:") ||
    asset.file
  ) {
    return await (await fetch(asset.uri)).arrayBuffer();
  }
  const { File } = require("expo-file-system");
  const bytes: Uint8Array = await new File(asset.uri).bytes();
  // Copy into a plain ArrayBuffer (Uint8Array.buffer may be SharedArrayBuffer).
  return bytes.slice().buffer;
}

function isZipAsset(asset: any): boolean {
  const name = (asset.name ?? "").toLowerCase();
  const mime = (asset.mimeType ?? "").toLowerCase();
  return (
    name.endsWith(".zip") ||
    mime.includes("zip") ||
    mime === "application/x-zip-compressed"
  );
}

/**
 * Let the user pick the GDPR ZIP (preferred) or one/more CSVs. The ZIP path
 * auto-pulls companion files; CSV multi-select keeps the older workflow.
 */
async function pickImportFiles(): Promise<TvTimeFiles | null> {
  const DocumentPicker = require("expo-document-picker");
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "text/csv",
      "text/comma-separated-values",
      "application/vnd.ms-excel",
      "*/*",
    ],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (res.canceled) return null;
  const assets: any[] = res.assets ?? [];
  if (assets.length === 0) return null;

  const zipAsset = assets.find(isZipAsset);
  if (zipAsset) {
    return collectTvTimeFilesFromZip(await readAssetBytes(zipAsset));
  }

  const entries: { name: string; text: string }[] = [];
  for (const asset of assets) {
    entries.push({
      name: asset.name ?? "export.csv",
      text: await readAssetText(asset),
    });
  }
  return collectTvTimeFiles(entries);
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
              onPress={() => router.replace("/(tabs)/profile")}
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
                  <Text
                    className={
                      partial ? "text-warning ml-2" : "text-success ml-2"
                    }
                  >
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
          data. Export your data from TV Time's GDPR tool, then select the ZIP
          here. Episodic matches each show against TMDB and restores your
          watched episodes.
        </Text>
      </View>

      <View className="bg-surface rounded-2xl p-4 mb-4">
        <Step
          n={1}
          text="Request your data export from TV Time's GDPR download page."
        />
        <Step
          n={2}
          text="Select the original GDPR ZIP — no need to unzip it."
        />
        <Step
          n={3}
          text="Or pick individual CSVs (tracking-prod-records-v2.csv plus companions)."
        />
      </View>

      {error ? (
        <Text className="text-accent text-center mb-3">{error}</Text>
      ) : null}

      <Button
        label="Select GDPR ZIP or CSVs"
        icon="document-outline"
        onPress={start}
      />
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
