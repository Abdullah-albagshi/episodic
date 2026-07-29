import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, EmptyState, Poster } from "../components/ui";
import {
  collectTvTimeFiles,
  collectTvTimeFilesFromZip,
  type ImportPreview,
  type ImportProgress,
  type ImportSummary,
  type TvTimeFiles,
  type UnmatchedMovie,
  type UnmatchedShow,
} from "../lib/import/tvtime";
import {
  useImportTvTime,
  usePreviewTvTimeImport,
  useRematchMovie,
  useRematchShow,
} from "../lib/queries";
import { useAppStore } from "../lib/store";
import { searchMovies, searchShows, type TmdbSearchResult } from "../lib/tmdb";

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

type Phase =
  | "idle"
  | "previewing"
  | "preview"
  | "importing"
  | "done";

export default function ImportScreen() {
  const router = useRouter();
  const hasKey = !!useAppStore((s) => s.apiKey);
  const importMutation = useImportTvTime();
  const previewMutation = usePreviewTvTimeImport();
  const rematchShowMut = useRematchShow();
  const rematchMovieMut = useRematchMovie();

  const [phase, setPhase] = useState<Phase>("idle");
  const [files, setFiles] = useState<TvTimeFiles | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [rematchTarget, setRematchTarget] = useState<
    | { kind: "show"; item: UnmatchedShow }
    | { kind: "movie"; item: UnmatchedMovie }
    | null
  >(null);

  const previewStats = useMemo(() => {
    if (!preview) return null;
    const showMatched = preview.shows.filter((s) => s.tmdbId != null).length;
    const showUnmatched = preview.shows.length - showMatched;
    const movieMatched = preview.movies.filter((m) => m.tmdbId != null).length;
    const movieUnmatched = preview.movies.length - movieMatched;
    return { showMatched, showUnmatched, movieMatched, movieUnmatched };
  }, [preview]);

  async function pickAndPreview() {
    setError(null);
    setSummary(null);
    setPreview(null);
    try {
      const picked = await pickImportFiles();
      if (picked == null) return;
      setFiles(picked);
      setPhase("previewing");
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await previewMutation.mutateAsync({
        files: picked,
        onProgress: setProgress,
        signal: controller.signal,
      });
      setPreview(result);
      setPhase("preview");
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.message === "Import cancelled") {
        setPhase("idle");
        setFiles(null);
      } else {
        setError(e?.message ?? "Preview failed");
        setPhase("idle");
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function runImport() {
    if (!files) return;
    setError(null);
    setPhase("importing");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await importMutation.mutateAsync({
        files,
        onProgress: setProgress,
        signal: controller.signal,
        concurrency: 4,
      });
      setSummary(result);
      setPhase("done");
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.message === "Import cancelled") {
        // Partial summary may still be returned by the runner; mutation throws only on hard errors.
        setError("Import cancelled. Anything already imported was kept.");
        setPhase(summary ? "done" : "preview");
      } else {
        setError(e?.message ?? "Import failed");
        setPhase("preview");
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  async function onRematchPick(tmdbId: number) {
    if (!rematchTarget || !summary) return;
    try {
      if (rematchTarget.kind === "show") {
        const matched = await rematchShowMut.mutateAsync({
          entry: rematchTarget.item.entry,
          tmdbId,
        });
        setSummary({
          ...summary,
          matched: [...summary.matched, matched],
          unmatched: summary.unmatched.filter(
            (u) => u.name !== rematchTarget.item.name
          ),
        });
      } else {
        const matched = await rematchMovieMut.mutateAsync({
          entry: rematchTarget.item.entry,
          tmdbId,
        });
        setSummary({
          ...summary,
          moviesMatched: [...summary.moviesMatched, matched],
          moviesUnmatched: summary.moviesUnmatched.filter(
            (u) => u.name !== rematchTarget.item.name
          ),
        });
      }
      setRematchTarget(null);
    } catch (e: any) {
      setError(e?.message ?? "Rematch failed");
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

  if (phase === "previewing" || phase === "importing") {
    const label = phase === "previewing" ? "Previewing matches…" : "Importing…";
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <ActivityIndicator color="#7c5cff" size="large" />
        <Text className="text-text font-semibold mt-4">{label}</Text>
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
                    (progress.current / Math.max(progress.total, 1)) * 100
                  )}%`,
                }}
              />
            </View>
          </>
        ) : null}
        <Text className="text-muted text-xs mt-4 text-center">
          {phase === "previewing"
            ? "Looking up each title on TMDB without writing anything yet."
            : "Matching titles and restoring watched episodes in parallel."}
        </Text>
        <Button
          label="Cancel"
          icon="close"
          variant="surface"
          onPress={cancel}
          className="mt-6 w-full"
        />
      </View>
    );
  }

  if (phase === "preview" && preview && previewStats) {
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="bg-surface rounded-2xl p-4 mb-4">
          <Text className="text-text text-lg font-bold">Dry-run preview</Text>
          <Text className="text-muted mt-2 leading-5">
            Nothing has been written yet. Review the proposed matches, then
            import for real — or cancel and pick a different file.
          </Text>
          <Text className="text-text mt-3">
            Shows: {previewStats.showMatched} matched ·{" "}
            {previewStats.showUnmatched} unmatched
          </Text>
          <Text className="text-text mt-1">
            Movies: {previewStats.movieMatched} matched ·{" "}
            {previewStats.movieUnmatched} unmatched
          </Text>
          {formatRuntime(preview.totalRuntimeSeconds) ? (
            <Text className="text-primary mt-2">
              {formatRuntime(preview.totalRuntimeSeconds)} of watch time
            </Text>
          ) : null}
        </View>

        <Section title="Shows">
          {preview.shows.slice(0, 40).map((s) => (
            <View key={s.name} className="flex-row justify-between py-1.5">
              <Text className="text-text flex-1" numberOfLines={1}>
                {s.name}
                {s.matchTitle && s.matchTitle !== s.name ? (
                  <Text className="text-muted"> → {s.matchTitle}</Text>
                ) : null}
              </Text>
              <Text
                className={
                  s.tmdbId ? "text-success ml-2" : "text-warning ml-2"
                }
              >
                {s.tmdbId ? "ok" : "?"}
              </Text>
            </View>
          ))}
          {preview.shows.length > 40 ? (
            <Text className="text-muted text-xs mt-1">
              …and {preview.shows.length - 40} more
            </Text>
          ) : null}
        </Section>

        {preview.movies.length > 0 ? (
          <Section title="Movies">
            {preview.movies.slice(0, 20).map((m) => (
              <View key={m.name} className="flex-row justify-between py-1.5">
                <Text className="text-text flex-1" numberOfLines={1}>
                  {m.name}
                </Text>
                <Text
                  className={
                    m.tmdbId ? "text-success ml-2" : "text-warning ml-2"
                  }
                >
                  {m.tmdbId ? "ok" : "?"}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {error ? (
          <Text className="text-accent text-center mb-3">{error}</Text>
        ) : null}

        <Button
          label="Import for real"
          icon="cloud-upload-outline"
          onPress={runImport}
          className="mb-2"
        />
        <Button
          label="Pick a different file"
          icon="document-outline"
          variant="surface"
          onPress={() => {
            setPreview(null);
            setFiles(null);
            setPhase("idle");
          }}
        />
      </ScrollView>
    );
  }

  if (phase === "done" && summary) {
    const totalWatched = summary.matched.reduce((n, m) => n + m.watched, 0);
    const runtimeLabel = formatRuntime(summary.totalRuntimeSeconds);
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="bg-surface rounded-2xl p-4 mb-4 items-center">
          <Ionicons
            name={summary.cancelled ? "pause-circle" : "checkmark-circle"}
            size={40}
            color={summary.cancelled ? "#f5a524" : "#3ecf8e"}
          />
          <Text className="text-text text-lg font-bold mt-2">
            {summary.cancelled ? "Import cancelled" : "Import complete"}
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
          <Section title={`Matched shows (${summary.matched.length})`}>
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

        {summary.moviesMatched?.length > 0 ? (
          <Section title={`Matched movies (${summary.moviesMatched.length})`}>
            {summary.moviesMatched.map((m) => (
              <View key={m.name} className="flex-row justify-between py-1.5">
                <Text className="text-text flex-1" numberOfLines={1}>
                  {m.name}
                  {m.matchedTitle !== m.name ? (
                    <Text className="text-muted"> → {m.matchedTitle}</Text>
                  ) : null}
                </Text>
                <Text className="text-success ml-2">
                  {m.watched ? "watched" : "added"}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {summary.unmatched.length > 0 ? (
          <Section title={`Shows not found (${summary.unmatched.length})`}>
            <Text className="text-muted text-xs mb-2">
              Tap Rematch to pick the correct TMDB title. Watched episodes from
              your export will be applied.
            </Text>
            {summary.unmatched.map((u) => (
              <View
                key={u.name}
                className="flex-row items-center justify-between py-2 border-b border-border"
              >
                <Text className="text-warning flex-1 pr-2" numberOfLines={2}>
                  {u.name}
                </Text>
                <Pressable
                  onPress={() => setRematchTarget({ kind: "show", item: u })}
                  className="bg-primary/20 px-3 py-1.5 rounded-full"
                >
                  <Text className="text-primary text-xs font-semibold">
                    Rematch
                  </Text>
                </Pressable>
              </View>
            ))}
          </Section>
        ) : null}

        {summary.moviesUnmatched?.length > 0 ? (
          <Section
            title={`Movies not found (${summary.moviesUnmatched.length})`}
          >
            {summary.moviesUnmatched.map((u) => (
              <View
                key={u.name}
                className="flex-row items-center justify-between py-2 border-b border-border"
              >
                <Text className="text-warning flex-1 pr-2" numberOfLines={2}>
                  {u.name}
                </Text>
                <Pressable
                  onPress={() => setRematchTarget({ kind: "movie", item: u })}
                  className="bg-primary/20 px-3 py-1.5 rounded-full"
                >
                  <Text className="text-primary text-xs font-semibold">
                    Rematch
                  </Text>
                </Pressable>
              </View>
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

        {error ? (
          <Text className="text-accent text-center mb-3">{error}</Text>
        ) : null}

        <Button
          label="Done"
          icon="checkmark"
          onPress={() => router.replace("/(tabs)/library")}
          className="mt-2"
        />

        <RematchModal
          target={rematchTarget}
          busy={rematchShowMut.isPending || rematchMovieMut.isPending}
          onClose={() => setRematchTarget(null)}
          onPick={onRematchPick}
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
          Pick your GDPR ZIP (or CSVs). Episodic first dry-runs the matches so
          you can review them, then imports in parallel. Unmatched titles can be
          rematched afterward.
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
          text="Review the dry-run, then import. Rematch anything TMDB missed."
        />
      </View>

      {error ? (
        <Text className="text-accent text-center mb-3">{error}</Text>
      ) : null}

      <Button
        label="Select GDPR ZIP or CSVs"
        icon="document-outline"
        onPress={pickAndPreview}
      />
    </ScrollView>
  );
}

function RematchModal({
  target,
  busy,
  onClose,
  onPick,
}: {
  target:
    | { kind: "show"; item: UnmatchedShow }
    | { kind: "movie"; item: UnmatchedMovie }
    | null;
  busy: boolean;
  onClose: () => void;
  onPick: (tmdbId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setQuery("");
      setResults([]);
      setSearchError(null);
      return;
    }
    setQuery(target.item.name);
  }, [target]);

  useEffect(() => {
    if (!target || !query.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const list =
          target.kind === "show"
            ? await searchShows(query)
            : await searchMovies(query);
        setResults(list);
      } catch (e: any) {
        setSearchError(e?.message ?? "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, target]);

  return (
    <Modal
      visible={!!target}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-bg rounded-t-3xl max-h-[85%] p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text text-lg font-bold flex-1 pr-3">
              Rematch {target?.kind === "movie" ? "movie" : "show"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color="#9a9ab0" />
            </Pressable>
          </View>
          <Text className="text-muted text-sm mb-3" numberOfLines={2}>
            Original: {target?.item.name}
          </Text>
          <View className="flex-row items-center bg-surface rounded-xl px-3 mb-3">
            <Ionicons name="search" size={18} color="#9a9ab0" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search TMDB…"
              placeholderTextColor="#9a9ab0"
              className="flex-1 text-text px-2 py-3"
              autoCorrect={false}
            />
            {searching ? <ActivityIndicator color="#7c5cff" /> : null}
          </View>
          {searchError ? (
            <Text className="text-accent mb-2">{searchError}</Text>
          ) : null}
          <ScrollView className="flex-grow-0" style={{ maxHeight: 420 }}>
            {results.map((r) => (
              <Pressable
                key={r.id}
                disabled={busy}
                onPress={() => onPick(r.id)}
                className="flex-row items-center bg-surface rounded-xl overflow-hidden mb-2 active:opacity-80"
              >
                <Poster
                  path={r.poster_path}
                  size="w185"
                  title={r.name}
                  className="w-12 h-20"
                />
                <View className="flex-1 p-3">
                  <Text className="text-text font-semibold" numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text className="text-muted text-xs mt-0.5">
                    {r.first_air_date?.slice(0, 4) ?? "—"}
                  </Text>
                </View>
                {busy ? (
                  <ActivityIndicator color="#7c5cff" className="mr-3" />
                ) : (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#7c5cff"
                    style={{ marginRight: 12 }}
                  />
                )}
              </Pressable>
            ))}
            {!searching && results.length === 0 && query.trim() ? (
              <Text className="text-muted text-center py-6">No results</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
