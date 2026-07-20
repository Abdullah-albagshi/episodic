import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, errorMessage, ScreenTitle } from "../../components/ui";
import {
  useClearAll,
  useExportBackup,
  useRestoreBackup,
} from "../../lib/queries";
import { useAppStore } from "../../lib/store";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-surface rounded-2xl p-4 mb-4">
      <Text className="text-text font-semibold mb-3">{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);

  const [key, setKey] = useState(apiKey ?? "");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const ok = (text: string) => setStatus({ text, error: false });
  const fail = (e: unknown) => setStatus({ text: errorMessage(e), error: true });

  const exportBackup = useExportBackup();
  const restoreBackup = useRestoreBackup();
  const clearAll = useClearAll();

  useEffect(() => {
    setKey(apiKey ?? "");
  }, [apiKey]);

  async function onSaveKey() {
    await setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function onExport() {
    setStatus(null);
    exportBackup.mutate(undefined, {
      onSuccess: (msg) => ok(msg),
      onError: (e) => fail(e),
    });
  }

  async function onRestore() {
    setStatus(null);
    try {
      const DocumentPicker = require("expo-document-picker");
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      let text: string;
      if (asset.uri.startsWith("data:") || asset.uri.startsWith("blob:") || asset.file) {
        text = await (await fetch(asset.uri)).text();
      } else {
        const { File } = require("expo-file-system");
        text = await new File(asset.uri).text();
      }
      restoreBackup.mutate(text, {
        onSuccess: () => ok("Backup restored"),
        onError: (e) => fail(e),
      });
    } catch (e) {
      fail(e);
    }
  }

  function onClear() {
    const doClear = () =>
      clearAll.mutate(undefined, {
        onSuccess: () => ok("All data cleared"),
        onError: (e) => fail(e),
      });
    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm("Delete ALL shows and watch history? This cannot be undone."))
        doClear();
    } else {
      Alert.alert(
        "Clear all data",
        "Delete ALL shows and watch history? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doClear },
        ]
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenTitle title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0 }}>
        <Card title="TMDB API key">
          <Text className="text-muted text-sm mb-3 leading-5">
            Episodic uses The Movie Database for show data. Paste a free API key
            (v3) or read access token (v4). Stored only on this device.
          </Text>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="Your TMDB API key"
            placeholderTextColor="#9a9ab0"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-surface2 text-text rounded-xl px-3 py-3 mb-3"
          />
          <Button
            label={saved ? "Saved" : "Save key"}
            icon={saved ? "checkmark" : "save-outline"}
            onPress={onSaveKey}
          />
          <Pressable
            onPress={() => Linking.openURL("https://www.themoviedb.org/settings/api")}
            className="mt-3 flex-row items-center gap-1"
          >
            <Ionicons name="open-outline" size={14} color="#7c5cff" />
            <Text className="text-primary text-sm">Get a TMDB API key</Text>
          </Pressable>
        </Card>

        <Card title="Import from TV Time">
          <Text className="text-muted text-sm mb-3 leading-5">
            TV Time shuts down July 15, 2026. Import your GDPR export
            (tracking-prod-records-v2.csv) to bring over your watch history.
          </Text>
          <Button
            label="Import TV Time CSV"
            icon="cloud-upload-outline"
            variant="surface"
            onPress={() => router.push("/import")}
          />
        </Card>

        <Card title="Backup & restore">
          <Text className="text-muted text-sm mb-3 leading-5">
            Export your whole library to a JSON file, or restore it on another
            device. Your data, always portable.
          </Text>
          <Button
            label={exportBackup.isPending ? "Exporting…" : "Export backup (JSON)"}
            icon="download-outline"
            variant="surface"
            onPress={onExport}
            disabled={exportBackup.isPending}
            className="mb-2"
          />
          <Button
            label={restoreBackup.isPending ? "Restoring…" : "Restore from backup"}
            icon="cloud-download-outline"
            variant="surface"
            onPress={onRestore}
            disabled={restoreBackup.isPending}
          />
        </Card>

        <Card title="Danger zone">
          <Button
            label="Clear all data"
            icon="trash-outline"
            variant="danger"
            onPress={onClear}
          />
        </Card>

        {status ? (
          <Text
            className={`text-center mb-4 ${
              status.error ? "text-accent" : "text-success"
            }`}
          >
            {status.text}
          </Text>
        ) : null}

        <Text className="text-muted text-center text-xs mt-2">
          Episodic · local-first TV tracker
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
