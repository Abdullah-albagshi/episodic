import { Ionicons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import { posterUrl } from "../../lib/tmdb";

export function Poster({
  path,
  size = "w342",
  className = "",
  title,
}: {
  path: string | null;
  size?: "w185" | "w342" | "w500";
  className?: string;
  title?: string;
}) {
  const url = posterUrl(path, size);
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        className={`bg-surface2 ${className}`}
        resizeMode="cover"
      />
    );
  }
  return (
    <View className={`bg-surface2 items-center justify-center ${className}`}>
      <Ionicons name="tv-outline" size={24} color="#9a9ab0" />
      {title ? (
        <Text
          numberOfLines={2}
          className="text-muted text-[10px] text-center px-1 mt-1"
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
