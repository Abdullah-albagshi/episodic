import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenTitle } from "../../components/ui";
import { YouHistoryTab } from "../../components/you/YouHistoryTab";
import { YouSettingsTab } from "../../components/you/YouSettingsTab";
import { YouStatsTab } from "../../components/you/YouStatsTab";

const TAB_KEYS = ["stats", "history", "settings"] as const;
type YouTab = (typeof TAB_KEYS)[number];

export default function YouScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<YouTab>("stats");
  const pagerRef = useRef<PagerView>(null);

  const goToTab = (next: YouTab) => {
    const index = TAB_KEYS.indexOf(next);
    setTab(next);
    pagerRef.current?.setPage(index);
  };

  const labels: Record<YouTab, string> = {
    stats: t("you.tabStats"),
    history: t("you.tabHistory"),
    settings: t("you.tabSettings"),
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="px-4">
        <ScreenTitle title={t("you.title")} subtitle={t("you.subtitle")} />
      </View>

      <View className="flex-row border-b border-border px-4 bg-bg">
        {TAB_KEYS.map((key) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => goToTab(key)}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={`mr-5 pb-3 border-b-2 ${
                active ? "border-text" : "border-transparent"
              }`}
            >
              <Text
                className={`font-semibold ${
                  active ? "text-text" : "text-muted"
                }`}
              >
                {labels[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => {
          const next = TAB_KEYS[e.nativeEvent.position];
          if (next) setTab(next);
        }}
      >
        <View key="stats" collapsable={false} style={{ flex: 1 }}>
          <YouStatsTab />
        </View>
        <View key="history" collapsable={false} style={{ flex: 1 }}>
          <YouHistoryTab />
        </View>
        <View key="settings" collapsable={false} style={{ flex: 1 }}>
          <YouSettingsTab />
        </View>
      </PagerView>
    </SafeAreaView>
  );
}
