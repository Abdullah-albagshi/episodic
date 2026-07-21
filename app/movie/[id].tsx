import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { ShowStatusSheet } from "../../components/show/ShowStatusSheet";
import {
  Button,
  ErrorState,
  errorMessage,
  Loading,
  Poster,
} from "../../components/ui";
import {
  useAddShow,
  useRemoveShow,
  useSetShowStatus,
  useShow,
  useToggleMovieWatched,
  useTmdbMovieDetail,
} from "../../lib/queries";
import { useAppStore } from "../../lib/store";
import { backdropUrl } from "../../lib/tmdb";
import type { Show, ShowStatus } from "../../lib/types";

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const movieId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const hasKey = !!useAppStore((s) => s.apiKey);

  const { data: dbMovie, isLoading: dbLoading } = useShow(movieId, "movie");
  const inLibrary = !!dbMovie;

  const {
    data: detail,
    isLoading: detailLoading,
    isError,
    error,
    refetch,
  } = useTmdbMovieDetail(movieId, hasKey && Number.isFinite(movieId));

  const addShow = useAddShow();
  const removeShow = useRemoveShow();
  const setStatus = useSetShowStatus();
  const toggleWatched = useToggleMovieWatched();
  const [statusOpen, setStatusOpen] = useState(false);

  const movie: Show | null = useMemo(() => {
    if (dbMovie) return dbMovie;
    if (detail) {
      return {
        id: detail.id,
        media_type: "movie",
        title: detail.title,
        poster_path: detail.poster_path,
        overview: detail.overview,
        first_air_date: detail.release_date,
        status: "watching",
        added_at: 0,
        source: "manual",
        watched_at: null,
      };
    }
    return null;
  }, [dbMovie, detail]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: movie?.title ?? "" });
  }, [navigation, movie?.title]);

  function onAdd() {
    if (!movie) return;
    addShow.mutate(
      { show: { ...movie, media_type: "movie", watched_at: null } },
      { onError: (e) => Alert.alert("Couldn't add movie", errorMessage(e)) }
    );
  }

  function confirmRemove() {
    const doRemove = () =>
      removeShow.mutate(
        { id: movieId, mediaType: "movie" },
        {
          onSuccess: () => router.back(),
          onError: (e) =>
            Alert.alert("Couldn't remove movie", errorMessage(e)),
        }
      );
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm("Remove this movie from your library?")) doRemove();
    } else {
      Alert.alert("Remove movie", "Remove this movie from your library?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ]);
    }
  }

  if (dbLoading || (!dbMovie && detailLoading)) {
    return (
      <View className="flex-1 bg-bg">
        <Loading label="Loading movie…" />
      </View>
    );
  }

  if (!dbMovie && isError && !detail) {
    return (
      <View className="flex-1 bg-bg">
        <ErrorState
          title="Couldn't load this movie"
          message={errorMessage(error)}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const backdrop = backdropUrl(detail?.backdrop_path ?? null);
  const year = movie?.first_air_date?.slice(0, 4);
  const watched =
    inLibrary &&
    (dbMovie?.watched_at != null || dbMovie?.status === "completed");

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="h-44 bg-surface2 overflow-hidden">
          {backdrop ? (
            <Image
              source={{ uri: backdrop }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : null}
          <View className="absolute inset-0 bg-black/40" />
        </View>

        <View className="px-4 -mt-16">
          <View className="flex-row">
            <Poster
              path={movie?.poster_path ?? null}
              size="w342"
              title={movie?.title}
              className="w-28 aspect-[2/3] rounded-xl border-2 border-bg"
            />
            <View className="flex-1 ml-3 justify-end pb-1">
              <Text className="text-text text-xl font-bold" numberOfLines={3}>
                {movie?.title ?? "Movie"}
              </Text>
              <Text className="text-muted text-xs mt-1">
                {[year, detail?.runtime ? `${detail.runtime} min` : null, detail?.status]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {detail && detail.vote_count > 0 ? (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="star" size={12} color="#3ecf8e" />
                  <Text className="text-success text-xs ml-1">
                    {detail.vote_average.toFixed(1)}/10 ({detail.vote_count})
                  </Text>
                </View>
              ) : null}
              {inLibrary && dbMovie?.source === "tvtime" ? (
                <View className="self-start mt-2 rounded-full bg-primary/20 px-2.5 py-0.5">
                  <Text className="text-primary text-[11px] font-semibold">
                    {t("show.fromTvTime")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {inLibrary && movie ? (
            <View className="flex-row gap-2 mt-4">
              <Pressable
                onPress={() => setStatusOpen(true)}
                className="flex-1 flex-row items-center justify-center bg-surface rounded-full h-11 active:opacity-80"
              >
                <Text className="text-text font-semibold">
                  {t(`status.${movie.status}`)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color="#9a9ab0"
                  style={{ marginLeft: 6 }}
                />
              </Pressable>
              <Pressable
                onPress={() =>
                  toggleWatched.mutate({ id: movieId, watched: !watched })
                }
                className="w-11 h-11 rounded-full bg-surface items-center justify-center active:opacity-80"
              >
                <Ionicons
                  name={watched ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={watched ? "#3ecf8e" : "#9a9ab0"}
                />
              </Pressable>
            </View>
          ) : (
            <View className="mt-4">
              <Button
                label={addShow.isPending ? t("show.adding") : "Add to library"}
                icon="add"
                onPress={onAdd}
                disabled={addShow.isPending || !movie}
              />
            </View>
          )}

          {movie?.overview ? (
            <View className="mt-5">
              <Text className="text-text font-semibold mb-2">
                {t("show.synopsis")}
              </Text>
              <Text className="text-muted leading-5">{movie.overview}</Text>
            </View>
          ) : null}

          {detail?.genres?.length ? (
            <View className="mt-5">
              <Text className="text-text font-semibold mb-2">
                {t("show.genres")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {detail.genres.map((g) => (
                  <View
                    key={g.id}
                    className="rounded-full bg-surface px-3 py-1.5"
                  >
                    <Text className="text-muted text-sm">{g.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {inLibrary && movie ? (
        <ShowStatusSheet
          visible={statusOpen}
          current={movie.status}
          onClose={() => setStatusOpen(false)}
          onSelect={(s: ShowStatus) =>
            setStatus.mutate({
              id: movieId,
              status: s,
              mediaType: "movie",
            })
          }
          onRemove={confirmRemove}
        />
      ) : null}
    </View>
  );
}
