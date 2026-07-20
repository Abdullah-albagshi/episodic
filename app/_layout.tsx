import "../global.css";
import "react-native-gesture-handler";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ErrorState, errorMessage, Loading } from "../components/ui";
import { initDb } from "../lib/db";
import { queryClient } from "../lib/queries";
import { useAppStore } from "../lib/store";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<unknown>(null);
  const hydrate = useAppStore((s) => s.hydrate);

  const bootstrap = useCallback(async () => {
    setInitError(null);
    setReady(false);
    try {
      await initDb();
      await hydrate();
    } catch (e) {
      console.warn("Startup failed", e);
      setInitError(e);
    } finally {
      setReady(true);
    }
  }, [hydrate]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!ready) {
    return (
      <View className="flex-1 bg-bg">
        <StatusBar style="light" />
        <Loading />
      </View>
    );
  }

  if (initError) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <StatusBar style="light" />
        <ErrorState
          icon="cloud-offline-outline"
          title="Couldn't start Episodic"
          message={errorMessage(
            initError,
            "Something went wrong while loading your data."
          )}
          onRetry={() => bootstrap()}
        />
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
