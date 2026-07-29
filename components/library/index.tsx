import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import type { LibraryFilter, LibraryView } from "../../lib/store";
import { useTapGuard } from "../../lib/tapGuard";
import type { LibraryEntry } from "../../lib/types";
import { BottomSheet, Poster, ProgressBar } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");

const VIEW_OPTIONS: {
  view: LibraryView;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { view: "list", label: "List", icon: "list-outline" },
  { view: "compact", label: "Compact list", icon: "reorder-four-outline" },
  { view: "grid", label: "Grid", icon: "grid-outline" },
];

/**
 * Three-dots trigger that opens a popover with the Library layout options.
 * Keeps the view control out of the filter row so it doesn't crowd small
 * screens. The popover is anchored just under the trigger button.
 */
export function LibraryOptionsMenu({
  value,
  onChange,
}: {
  value: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, right: 16 });
  const btnRef = useRef<View>(null);

  function openMenu() {
    const node = btnRef.current;
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => {
        setAnchor({ top: y + height + 6, right: 16 });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      <Pressable
        ref={btnRef}
        onPress={openMenu}
        hitSlop={8}
        className="w-9 h-9 rounded-full bg-surface items-center justify-center active:opacity-70"
      >
        <Ionicons name="ellipsis-horizontal" size={18} color="#f2f2f7" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View
            style={{ position: "absolute", top: anchor.top, right: anchor.right }}
            className="w-64 bg-surface rounded-2xl p-3 border border-border"
          >
            <Text className="text-muted text-xs font-semibold uppercase tracking-wide mb-2">
              View
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {VIEW_OPTIONS.map(({ view, label, icon }) => {
                const active = view === value;
                return (
                  <Pressable
                    key={view}
                    onPress={() => onChange(view)}
                    className={`h-9 px-3 rounded-full flex-row items-center gap-1.5 ${
                      active ? "bg-primary" : "bg-surface2"
                    }`}
                  >
                    <Ionicons
                      name={icon}
                      size={14}
                      color={active ? "#fff" : "#9a9ab0"}
                    />
                    <Text
                      className={`text-xs font-medium ${
                        active ? "text-white" : "text-muted"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Status filter presented as a bottom drawer (built on the reusable
 * `BottomSheet`), which is friendlier on small screens than a crowded row of
 * chips. Selecting a status applies it and closes the drawer.
 */
export function LibraryFilterDrawer({
  visible,
  onClose,
  value,
  filters,
  labels,
  counts,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  value: LibraryFilter;
  filters: LibraryFilter[];
  labels: Record<LibraryFilter, string>;
  counts: Record<LibraryFilter, number>;
  onChange: (filter: LibraryFilter) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filter by status">
      <View className="gap-1">
        {filters.map((f) => {
          const active = f === value;
          return (
            <Pressable
              key={f}
              onPress={() => {
                onChange(f);
                onClose();
              }}
              className={`flex-row items-center justify-between h-12 px-3 rounded-xl ${
                active ? "bg-primary/15" : "active:bg-surface2"
              }`}
            >
              <Text
                className={`font-medium ${
                  active ? "text-primary" : "text-text"
                }`}
              >
                {labels[f]}
              </Text>
              <View className="flex-row items-center gap-3">
                <Text className="text-muted text-xs">{counts[f]}</Text>
                {active ? (
                  <Ionicons name="checkmark" size={18} color="#7c5cff" />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
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
  const tap = useTapGuard();
  return (
    <Pressable
      onPressIn={tap.onPressIn}
      onPress={(e) => {
        if (!tap.wasTap(e)) return;
        onPress();
      }}
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
  const tap = useTapGuard();
  const { show, next, watchedCount, totalCount } = entry;
  return (
    <Pressable
      onPressIn={tap.onPressIn}
      onPress={(e) => {
        if (!tap.wasTap(e)) return;
        onPress();
      }}
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
