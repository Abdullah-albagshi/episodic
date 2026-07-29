import { Children, useRef, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SwipePage, SwipePager } from "./SwipePager";
import type { SwipePagerHandle } from "./SwipePager.types";

export type SwipeTab<T extends string = string> = {
  key: T;
  label: string;
};

type TabBarVariant = "underline" | "segmented";

export function SwipeTabBar<T extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
}: {
  tabs: readonly SwipeTab<T>[];
  value: T;
  onChange: (key: T) => void;
  variant?: TabBarVariant;
}) {
  if (variant === "segmented") {
    return (
      <View className="flex-row bg-surface rounded-xl p-1">
        {tabs.map((tab) => {
          const active = value === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={`flex-1 h-9 rounded-lg items-center justify-center ${
                active ? "bg-primary" : ""
              }`}
            >
              <Text
                className={`font-semibold ${
                  active ? "text-white" : "text-muted"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View className="flex-row border-b border-border px-4 bg-bg">
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
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
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Horizontal swipe pager synced with a tab bar. Pass one child page per tab,
 * in the same order as `tabs`.
 *
 * Native uses react-native-pager-view; web uses a paging ScrollView.
 */
export function SwipeTabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  tabBarClassName,
  children,
}: {
  tabs: readonly SwipeTab<T>[];
  value: T;
  onChange: (key: T) => void;
  variant?: TabBarVariant;
  /** Extra classes wrapping the tab bar (e.g. padding). */
  tabBarClassName?: string;
  children: ReactNode;
}) {
  const pagerRef = useRef<SwipePagerHandle>(null);
  const pages = Children.toArray(children);
  const initialPage = Math.max(
    0,
    tabs.findIndex((t) => t.key === value)
  );

  const goTo = (key: T) => {
    const index = tabs.findIndex((t) => t.key === key);
    onChange(key);
    if (index >= 0) pagerRef.current?.setPage(index);
  };

  return (
    <View className="flex-1">
      <View className={tabBarClassName}>
        <SwipeTabBar
          tabs={tabs}
          value={value}
          onChange={goTo}
          variant={variant}
        />
      </View>
      <SwipePager
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={initialPage}
        onPageSelected={(index) => {
          const next = tabs[index]?.key;
          if (next && next !== value) onChange(next);
        }}
      >
        {pages.map((page, i) => (
          <SwipePage key={tabs[i]?.key ?? String(i)} pageKey={tabs[i]?.key ?? String(i)}>
            {page}
          </SwipePage>
        ))}
      </SwipePager>
    </View>
  );
}
