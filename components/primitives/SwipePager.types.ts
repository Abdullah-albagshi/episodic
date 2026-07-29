import type { ReactNode, Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type SwipePagerHandle = {
  setPage: (index: number) => void;
};

export type SwipePagerProps = {
  pagerRef: Ref<SwipePagerHandle | null>;
  initialPage: number;
  onPageSelected: (index: number) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};
