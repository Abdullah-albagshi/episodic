import "../global.css";
import "react-native-gesture-handler";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { initDb } from "../lib/db";
import { queryClient } from "../lib/queries";
import { useAppStore } from "../lib/store";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await hydrate();
      } catch (e) {
        console.warn("Startup failed", e);
      } finally {
        setReady(true);
      }
    })();
  }, [hydrate]);

  if (!ready) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b0b12" },
          headerTintColor: "#f2f2f7",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#0b0b12" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="show/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="import"
          options={{ title: "Import from TV Time", presentation: "modal" }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
