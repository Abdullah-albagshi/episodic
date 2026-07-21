import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "./Button";

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
      <Text className="text-lg font-semibold text-center text-text">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 leading-5 text-center text-muted">{subtitle}</Text>
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

export function ErrorState({
  icon = "alert-circle-outline",
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center justify-center flex-1 px-8 py-16">
      <View className="items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-accent/15">
        <Ionicons name={icon} size={30} color="#ff5c8a" />
      </View>
      <Text className="text-lg font-semibold text-center text-text">{title}</Text>
      {message ? (
        <Text className="mt-1 leading-5 text-center text-muted">{message}</Text>
      ) : null}
      {action ? (
        <View className="w-full max-w-xs mt-5">{action}</View>
      ) : onRetry ? (
        <View className="w-full max-w-xs mt-5">
          <Button label={retryLabel} icon="refresh" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/** Normalize an unknown thrown value into a user-facing message. */
export function errorMessage(
  error: unknown,
  fallback = "Please try again."
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
