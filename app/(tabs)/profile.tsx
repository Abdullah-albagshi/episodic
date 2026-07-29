import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenTitle, SwipeTabs } from "../../components/ui";
import { YouHistoryTab } from "../../components/you/YouHistoryTab";
import { YouSettingsTab } from "../../components/you/YouSettingsTab";
import { YouStatsTab } from "../../components/you/YouStatsTab";

const TAB_KEYS = ["stats", "history", "settings"] as const;
type YouTab = (typeof TAB_KEYS)[number];

export default function YouScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<YouTab>("stats");

  const tabs = [
    { key: "stats" as const, label: t("you.tabStats") },
    { key: "history" as const, label: t("you.tabHistory") },
    { key: "settings" as const, label: t("you.tabSettings") },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="px-4">
        <ScreenTitle title={t("you.title")} subtitle={t("you.subtitle")} />
      </View>

      <SwipeTabs tabs={tabs} value={tab} onChange={setTab}>
        <YouStatsTab />
        <YouHistoryTab />
        <YouSettingsTab />
      </SwipeTabs>
    </SafeAreaView>
  );
}
