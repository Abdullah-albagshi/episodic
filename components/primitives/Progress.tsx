import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { ShowStatus } from "../../lib/types";

const STATUS_STYLES: Record<ShowStatus, string> = {
  watching: "bg-primary/20 text-primary",
  plan: "bg-warning/20 text-warning",
  paused: "bg-[#5b8def]/20 text-[#5b8def]",
  completed: "bg-success/20 text-success",
  dropped: "bg-muted/20 text-muted",
};

export function StatusPill({ status }: { status: ShowStatus }) {
  const { t } = useTranslation();
  return (
    <View
      className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[status].split(" ")[0]}`}
    >
      <Text
        className={`text-[11px] font-semibold ${STATUS_STYLES[status].split(" ")[1]}`}
      >
        {t(`status.${status}`)}
      </Text>
    </View>
  );
}

export function ProgressBar({
  value,
  total,
}: {
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View className="h-1.5 bg-surface2 rounded-full overflow-hidden w-full">
      <View
        className="h-full rounded-full bg-primary"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
