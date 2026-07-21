import { Ionicons } from "@expo/vector-icons";
import { Image, View } from "react-native";
import { stillUrl } from "../../lib/tmdb";

/** Landscape episode still (16:9), with a tv-icon placeholder when missing. */
export function EpisodeStill({
  path,
  className = "",
}: {
  path: string | null;
  className?: string;
}) {
  const url = stillUrl(path, "w300");
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
      <Ionicons name="tv-outline" size={16} color="#9a9ab0" />
    </View>
  );
}
