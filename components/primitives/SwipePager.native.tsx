import { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import PagerView from "react-native-pager-view";
import type { SwipePagerHandle, SwipePagerProps } from "./SwipePager.types";

/**
 * Native pager with animated horizontal swipes.
 */
export const SwipePager = forwardRef<SwipePagerHandle, Omit<SwipePagerProps, "pagerRef">>(
  function SwipePager({ initialPage, onPageSelected, children, style }, ref) {
    const inner = useRef<PagerView>(null);

    useImperativeHandle(ref, () => ({
      setPage: (index: number) => {
        inner.current?.setPage(index);
      },
    }));

    return (
      <PagerView
        ref={inner}
        style={style ?? { flex: 1 }}
        initialPage={initialPage}
        onPageSelected={(e) => onPageSelected(e.nativeEvent.position)}
      >
        {children}
      </PagerView>
    );
  }
);

/** Page wrapper required by react-native-pager-view. */
export function SwipePage({
  children,
  pageKey,
}: {
  children: React.ReactNode;
  pageKey: string;
}) {
  return (
    <View key={pageKey} collapsable={false} style={{ flex: 1 }}>
      {children}
    </View>
  );
}
