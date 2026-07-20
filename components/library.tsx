import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import type { LibraryView } from "../lib/store";
import type { LibraryEntry } from "../lib/types";
import { Poster, ProgressBar } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");

const VIEW_OPTIONS: { view: LibraryView; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { view: "grid", icon: "grid-outline" },
    { view: "list", icon: "list-outline" },
    { view: "compact", icon: "reorder-four-outline" },
  ];

/** Segmented control for choosing the Library layout. */
export function LibraryViewSwitcher({
  value,
  onChange,
}: {
  value: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  return (
    <View className="flex-row bg-surface rounded-full p-1">
      {VIEW_OPTIONS.map(({ view, icon }) => {
        const active = view === value;
        return (
          <Pressable
            key={view}
            onPress={() => onChange(view)}
            hitSlop={4}
            className={`w-8 h-8 rounded-full items-center justify-center ${
              active ? "bg-primary" : ""
            }`}
          >
            <Ionicons
              name={icon}
              size={16}
              color={active ? "#fff" : "#9a9ab0"}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Poster tile used by the grid layout. */
export function LibraryGridItem({
  entry,
  onPress,
}: {
  entry: LibraryEntry;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 active:opacity-80 max-w-[25%]"
    >
      <Poster
        path={entry.show.poster_path}
        title={entry.show.title}
        className="w-full aspect-[2/3] rounded-xl"
      />
      <Text
        numberOfLines={1}
        className="text-text text-xs mt-1.5 font-medium"
      >
        {entry.show.title}
      </Text>
    </Pressable>
  );
}

/** Dense single-line row used by the compact layout. */
export function LibraryCompactRow({
  entry,
  onPress,
}: {
  entry: LibraryEntry;
  onPress: () => void;
}) {
  const { show, next, watchedCount, totalCount } = entry;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-2.5 active:opacity-70"
    >
      <Poster
        path={show.poster_path}
        size="w185"
        title={show.title}
        className="w-9 h-[54px] rounded-md"
      />
      <View className="flex-1 ml-3">
        <Text numberOfLines={1} className="text-text font-medium">
          {show.title}
        </Text>
        <Text numberOfLines={1} className="text-muted text-xs mt-0.5">
          {next ? `S${pad(next.season)}·E${pad(next.number)} · ` : ""}
          {watchedCount}/{totalCount}
        </Text>
        <View className="mt-1.5">
          <ProgressBar value={watchedCount} total={totalCount} />
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color="#9a9ab0"
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
}
