/** Shared palette — keep in sync with tailwind.config.js / global.css. */
export const colors = {
  bg: "#0b0b12",
  surface: "#15151f",
  surface2: "#1e1e2b",
  border: "#2a2a3a",
  primary: "#7c5cff",
  primaryDark: "#5b3fd6",
  accent: "#ff5c8a",
  text: "#f2f2f7",
  muted: "#9a9ab0",
  success: "#3ecf8e",
  warning: "#f5a524",
} as const;

/** Android ScrollView / FlatList indicator tint. */
export const scrollIndicator = {
  style: "white" as const,
  color: colors.muted,
};
