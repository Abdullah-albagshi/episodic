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
} from "../../components/ui";
import { useAddShow, useShows, useTmdbSearch } from "../../lib/queries";
import { useAppStore } from "../../lib/store";
import type { TmdbSearchResult } from "../../lib/tmdb";
import type { Show } from "../../lib/types";

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  const hasKey = !!useAppStore((s) => s.apiKey);
  const { data: shows } = useShows();
  const inLibrary = useMemo(
    () => new Set((shows ?? []).map((s) => s.id)),
    [shows]
  );

  const {
    data: results,
    isFetching,
    isError,
    error,
    refetch,
  } = useTmdbSearch(debounced, hasKey);
  const addShow = useAddShow();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

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
    };
    addShow.mutate(
      { show },
      {
        onError: (e) =>
          Alert.alert("Couldn't add show", errorMessage(e)),
      }
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Search" subtitle="Find shows to track" />

      <View className="px-4 mb-3">
        <View className="flex-row items-center bg-surface rounded-xl px-3">
          <Ionicons name="search" size={18} color="#9a9ab0" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search TV shows…"
            placeholderTextColor="#9a9ab0"
            className="flex-1 text-text px-2 py-3"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isFetching ? <ActivityIndicator color="#7c5cff" /> : null}
        </View>
      </View>

      {!hasKey ? (
        <EmptyState
          icon="key-outline"
          title="Add a TMDB API key"
          subtitle="Search uses The Movie Database. Add a free API key in Settings to start finding shows."
        />
      ) : isError ? (
        <ErrorState
          title="Search failed"
          message={errorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : isFetching && !results ? (
        <Loading label="Searching…" />
      ) : results && results.length === 0 && debounced.trim() && !isFetching ? (
        <EmptyState
          icon="tv-outline"
          title="No results"
          subtitle={`Nothing found for "${debounced}".`}
        />
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const added = inLibrary.has(item.id);
            const isAdding =
              addShow.isPending && addShow.variables?.show.id === item.id;
            const year = item.first_air_date?.slice(0, 4);
            return (
              <View className="flex-row bg-surface rounded-2xl overflow-hidden">
                <Pressable
                  onPress={() => router.push(`/show/${item.id}`)}
                  className="flex-row flex-1 active:opacity-80"
                >
                  <Poster
                    path={item.poster_path}
                    size="w185"
                    title={item.name}
                    className="w-16 h-24"
                  />
                  <View className="flex-1 p-3">
                    <Text
                      numberOfLines={1}
                      className="text-text font-semibold"
                    >
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
                  onPress={() => (added ? undefined : onAdd(item))}
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
      )}
    </SafeAreaView>
  );
}
