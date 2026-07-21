import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "../ui";
import { SHOW_STATUSES, type ShowStatus } from "../../lib/types";

const STATUS_ICONS: Record<ShowStatus, keyof typeof Ionicons.glyphMap> = {
  watching: "play",
  plan: "bookmark-outline",
  paused: "pause",
  completed: "checkmark-done",
  dropped: "close-circle-outline",
};

export function ShowStatusSheet({
  visible,
  current,
  onClose,
  onSelect,
  onRemove,
}: {
  visible: boolean;
  current: ShowStatus;
  onClose: () => void;
  onSelect: (status: ShowStatus) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t("show.status")}>
      <View className="gap-1">
        {SHOW_STATUSES.map((s) => {
          const active = s === current;
          return (
            <Pressable
              key={s}
              onPress={() => {
                onSelect(s);
                onClose();
              }}
              className="flex-row items-center py-3 px-2 rounded-xl active:bg-surface2"
            >
              <Ionicons
                name={STATUS_ICONS[s]}
                size={20}
                color={active ? "#7c5cff" : "#f2f2f7"}
              />
              <Text
                className={`flex-1 ml-3 text-base ${
                  active ? "text-primary font-semibold" : "text-text"
                }`}
              >
                {t(`status.${s}`)}
              </Text>
              {active ? (
                <Ionicons name="checkmark" size={20} color="#7c5cff" />
              ) : null}
            </Pressable>
          );
        })}

        <View className="h-px bg-border my-2" />

        <Pressable
          onPress={() => {
            onClose();
            onRemove();
          }}
          className="flex-row items-center py-3 px-2 rounded-xl active:bg-accent/10"
        >
          <Ionicons name="trash-outline" size={20} color="#ff5c8a" />
          <Text className="flex-1 ml-3 text-base text-accent font-medium">
            {t("show.remove")}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
