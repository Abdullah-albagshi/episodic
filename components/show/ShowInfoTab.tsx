import { Ionicons } from "@expo/vector-icons";
import { Image, ScrollView, Text, View } from "react-native";
import { profileUrl, type TmdbShowDetail } from "../../lib/tmdb";

export function ShowInfoTab({ detail }: { detail: TmdbShowDetail | null | undefined }) {
  if (!detail) {
    return (
      <Text className="text-muted text-center px-8 py-10">
        Show details unavailable.
      </Text>
    );
  }

  const cast = (detail.credits?.cast ?? []).slice(0, 12);
  const reviews = (detail.reviews?.results ?? []).slice(0, 5);

  return (
    <View className="px-4 pb-8 gap-5">
      {detail.overview ? (
        <View>
          <Text className="text-text font-semibold mb-2">Synopsis</Text>
          <Text className="text-muted leading-5">{detail.overview}</Text>
        </View>
      ) : null}

      {detail.genres?.length ? (
        <View>
          <Text className="text-text font-semibold mb-2">Genres</Text>
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

      {detail.vote_count > 0 ? (
        <View className="bg-surface rounded-2xl p-4 flex-row items-center">
          <Ionicons name="star" size={28} color="#3ecf8e" />
          <View className="ml-3">
            <Text className="text-text text-2xl font-bold">
              {detail.vote_average.toFixed(1)}
              <Text className="text-muted text-base font-normal"> / 10</Text>
            </Text>
            <Text className="text-muted text-xs">
              {detail.vote_count.toLocaleString()} ratings
            </Text>
          </View>
        </View>
      ) : null}

      <View>
        <Text className="text-text font-semibold mb-2">Details</Text>
        {detail.first_air_date ? (
          <Text className="text-muted mb-1">
            First air date: {detail.first_air_date}
          </Text>
        ) : null}
        {detail.status ? (
          <Text className="text-muted">Status: {detail.status}</Text>
        ) : null}
      </View>

      {cast.length > 0 ? (
        <View>
          <Text className="text-text font-semibold mb-3">Cast</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {cast.map((c) => {
              const url = profileUrl(c.profile_path);
              return (
                <View key={`${c.id}-${c.character}`} className="w-20 items-center">
                  <View className="w-16 h-16 rounded-full bg-surface2 overflow-hidden items-center justify-center">
                    {url ? (
                      <Image
                        source={{ uri: url }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={22} color="#9a9ab0" />
                    )}
                  </View>
                  <Text
                    numberOfLines={2}
                    className="text-text text-[11px] font-medium text-center mt-1.5"
                  >
                    {c.name}
                  </Text>
                  <Text
                    numberOfLines={2}
                    className="text-muted text-[10px] text-center"
                  >
                    {c.character}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {reviews.length > 0 ? (
        <View>
          <Text className="text-text font-semibold mb-3">
            Reviews ({detail.reviews?.results?.length ?? reviews.length})
          </Text>
          <View className="gap-3">
            {reviews.map((r) => (
              <View key={r.id} className="bg-surface rounded-2xl p-4">
                <Text className="text-text font-semibold">{r.author}</Text>
                <Text className="text-muted text-sm mt-2 leading-5" numberOfLines={6}>
                  {r.content}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
