import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EmptyState,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
  ScreenTitle,
  SwipeTabs,
} from "../../components/ui";
import { useAddShow, useShows, useTmdbSearch } from "../../lib/queries";
import { useAppStore } from "../../lib/store";
import { useTapGuard } from "../../lib/tapGuard";
import type { TmdbSearchResult } from "../../lib/tmdb";
import type { MediaType, Show } from "../../lib/types";

const SEARCH_TABS = [
  { key: "tv" as const, label: "Shows" },
  { key: "movie" as const, label: "Movies" },
];

function SearchResults({
  mediaType,
  query,
  hasKey,
  inLibrary,
}: {
  mediaType: MediaType;
  query: string;
  hasKey: boolean;
  inLibrary: Set<string>;
}) {
  const router = useRouter();
  const tap = useTapGuard();
  const addShow = useAddShow();
  const {
    data: results,
    isFetching,
    isError,
    error,
    refetch,
  } = useTmdbSearch(query, hasKey, mediaType);

  function onAdd(r: TmdbSearchResult) {
    const show: Show = {
      id: r.id,
      title: r.name,
      poster_path: r.poster_path,
      overview: r.overview,
      first_air_date: r.first_air_date,
      status: "watching",
      added_at: Date.now(),
      source: "manual",
      media_type: mediaType,
      watched_at: null,
    };
    addShow.mutate(
      { show },
      {
        onError: (e) => Alert.alert("Couldn't add", errorMessage(e)),
      }
    );
  }

  function openItem(r: TmdbSearchResult) {
    if (mediaType === "movie") router.push(`/movie/${r.id}`);
    else router.push(`/show/${r.id}`);
  }

  if (!hasKey) {
    return (
      <EmptyState
        icon="key-outline"
        title="Add a TMDB API key"
        subtitle="Search uses The Movie Database. Add a free API key in You to start finding titles."
      />
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="Search failed"
        message={errorMessage(error)}
        onRetry={() => refetch()}
      />
    );
  }
  if (isFetching && !results) {
    return <Loading label="Searching…" />;
  }
  if (results && results.length === 0 && query.trim() && !isFetching) {
    return (
      <EmptyState
        icon="tv-outline"
        title="No results"
        subtitle={`Nothing found for "${query}".`}
      />
    );
  }

  return (
    <FlatList
      data={results ?? []}
      keyExtractor={(r) => `${mediaType}:${r.id}`}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const key = `${mediaType}:${item.id}`;
        const added = inLibrary.has(key);
        const isAdding =
          addShow.isPending &&
          addShow.variables?.show.id === item.id &&
          addShow.variables?.show.media_type === mediaType;
        const year = item.first_air_date?.slice(0, 4);
        return (
          <View className="flex-row bg-surface rounded-2xl overflow-hidden">
            <Pressable
              onPressIn={tap.onPressIn}
              onPress={(e) => {
                if (!tap.wasTap(e)) return;
                openItem(item);
              }}
              className="flex-row flex-1 active:opacity-80"
            >
              <Poster
                path={item.poster_path}
                size="w185"
                title={item.name}
                className="w-16 h-24"
              />
              <View className="flex-1 p-3">
                <Text numberOfLines={1} className="text-text font-semibold">
                  {item.name}
                  {year ? (
                    <Text className="text-muted font-normal"> · {year}</Text>
                  ) : null}
                </Text>
                <Text numberOfLines={3} className="text-muted text-xs mt-1">
                  {item.overview || "No description available."}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPressIn={tap.onPressIn}
              onPress={(e) => {
                if (added || isAdding || !tap.wasTap(e)) return;
                onAdd(item);
              }}
              disabled={added || isAdding}
              className="items-center justify-center px-4 active:opacity-70"
            >
              {isAdding ? (
                <ActivityIndicator color="#7c5cff" />
              ) : (
                <Ionicons
                  name={added ? "checkmark-circle" : "add-circle"}
                  size={28}
                  color={added ? "#3ecf8e" : "#7c5cff"}
                />
              )}
            </Pressable>
          </View>
        );
      }}
    />
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("tv");

  const hasKey = !!useAppStore((s) => s.apiKey);
  const { data: shows } = useShows();
  const inLibrary = useMemo(
    () =>
      new Set((shows ?? []).map((s) => `${s.media_type ?? "tv"}:${s.id}`)),
    [shows]
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Search" subtitle="Find shows and movies" />

      <View className="px-4 mb-3">
        <View className="flex-row items-center bg-surface rounded-xl px-3">
          <Ionicons name="search" size={18} color="#9a9ab0" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              mediaType === "movie" ? "Search movies…" : "Search TV shows…"
            }
            placeholderTextColor="#9a9ab0"
            className="flex-1 text-text px-2 py-3"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <SwipeTabs
        tabs={SEARCH_TABS}
        value={mediaType}
        onChange={setMediaType}
        variant="segmented"
        tabBarClassName="px-4 mb-1"
      >
        <SearchResults
          mediaType="tv"
          query={debounced}
          hasKey={hasKey}
          inLibrary={inLibrary}
        />
        <SearchResults
          mediaType="movie"
          query={debounced}
          hasKey={hasKey}
          inLibrary={inLibrary}
        />
      </SwipeTabs>
    </SafeAreaView>
  );
}
