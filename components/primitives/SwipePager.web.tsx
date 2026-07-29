import {
  Children,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from "react-native";
import type { SwipePagerHandle } from "./SwipePager.types";

/**
 * Web fallback: horizontal paging ScrollView (pager-view is native-only).
 */
export const SwipePager = forwardRef<
  SwipePagerHandle,
  {
    initialPage: number;
    onPageSelected: (index: number) => void;
    children: ReactNode;
    style?: object;
  }
>(function SwipePager({ initialPage, onPageSelected, children, style }, ref) {
  const scrollRef = useRef<ScrollView>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pages = Children.toArray(children);

  useImperativeHandle(ref, () => ({
    setPage: (index: number) => {
      if (size.width <= 0) return;
      scrollRef.current?.scrollTo({
        x: index * size.width,
        animated: true,
      });
    },
  }));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width <= 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / size.width);
    onPageSelected(index);
  };

  return (
    <View
      style={[{ flex: 1 }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => {
          if (prev.width === width && prev.height === height) return prev;
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
              x: initialPage * width,
              animated: false,
            });
          });
          return { width, height };
        });
      }}
    >
      {size.width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          style={{ flex: 1 }}
        >
          {pages.map((page, i) => (
            <View
              key={i}
              style={{ width: size.width, height: size.height }}
            >
              {page}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
});

/** On web, pages are sized by SwipePager — this is a passthrough. */
export function SwipePage({
  children,
}: {
  children: ReactNode;
  pageKey: string;
}) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
