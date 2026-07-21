import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";

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
