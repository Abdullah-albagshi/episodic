import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { posterUrl } from "../lib/tmdb";
import { STATUS_LABELS, ShowStatus } from "../lib/types";

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
    <View
      className={`bg-surface2 items-center justify-center ${className}`}
    >
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

const STATUS_STYLES: Record<ShowStatus, string> = {
  watching: "bg-primary/20 text-primary",
  plan: "bg-warning/20 text-warning",
  completed: "bg-success/20 text-success",
  dropped: "bg-muted/20 text-muted",
};

export function StatusPill({ status }: { status: ShowStatus }) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[status].split(" ")[0]}`}>
      <Text
        className={`text-[11px] font-semibold ${STATUS_STYLES[status].split(" ")[1]}`}
      >
        {STATUS_LABELS[status]}
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

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  className = "",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "surface" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  className?: string;
}) {
  const bg =
    variant === "primary"
      ? "bg-primary"
      : variant === "danger"
      ? "bg-accent/20"
      : "bg-surface2";
  const fg =
    variant === "primary"
      ? "text-white"
      : variant === "danger"
      ? "text-accent"
      : "text-text";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${bg} ${
        disabled ? "opacity-50" : "active:opacity-80"
      } ${className}`}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={variant === "primary" ? "#fff" : "#f2f2f7"}
        />
      ) : null}
      <Text className={`font-semibold ${fg}`}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center justify-center flex-1 px-8 py-16">
      <View className="items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-surface">
        <Ionicons name={icon} size={30} color="#7c5cff" />
      </View>
      <Text className="text-lg font-semibold text-center text-text">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 leading-5 text-center text-muted">
          {subtitle}
        </Text>
      ) : null}
      {action ? <View className="w-full max-w-xs mt-5">{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center flex-1 py-16">
      <ActivityIndicator color="#7c5cff" />
      {label ? <Text className="mt-3 text-muted">{label}</Text> : null}
    </View>
  );
}

export function ScreenTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="px-4 pt-2 pb-4">
      <Text className="text-3xl font-bold text-text">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
