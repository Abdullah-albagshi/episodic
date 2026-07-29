import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, errorMessage } from "../ui";
import type { AppLocale } from "../../lib/i18n";
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

export function YouSettingsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const [key, setKey] = useState(apiKey ?? "");
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const ok = (text: string) => setStatus({ text, error: false });
  const fail = (e: unknown) =>
    setStatus({ text: errorMessage(e), error: true });

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
      if (
        asset.uri.startsWith("data:") ||
        asset.uri.startsWith("blob:") ||
        asset.file
      ) {
        text = await (await fetch(asset.uri)).text();
      } else {
        const { File } = require("expo-file-system");
        text = await new File(asset.uri).text();
      }
      restoreBackup.mutate(text, {
        onSuccess: () => ok(t("you.backupRestored")),
        onError: (e) => fail(e),
      });
    } catch (e) {
      fail(e);
    }
  }

  function onClear() {
    const doClear = () =>
      clearAll.mutate(undefined, {
        onSuccess: () => ok(t("you.dataCleared")),
        onError: (e) => fail(e),
      });
    if (typeof window !== "undefined" && window.confirm) {
      if (
        window.confirm(
          "Delete ALL shows and watch history? This cannot be undone."
        )
      )
        doClear();
    } else {
      Alert.alert(
        t("you.clearAll"),
        "Delete ALL shows and watch history? This cannot be undone.",
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doClear },
        ]
      );
    }
  }

  async function onLocale(next: AppLocale) {
    if (next === locale) return;
    await setLocale(next);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
      <Card title={t("you.language")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.languageHint")}
        </Text>
        <View className="flex-row gap-2">
          {(["en", "ar"] as const).map((code) => {
            const active = locale === code;
            return (
              <Pressable
                key={code}
                onPress={() => onLocale(code)}
                className={`flex-1 h-11 rounded-xl items-center justify-center ${
                  active ? "bg-primary" : "bg-surface2"
                }`}
              >
                <Text
                  className={`font-semibold ${
                    active ? "text-white" : "text-text"
                  }`}
                >
                  {code === "en" ? t("you.english") : t("you.arabic")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title={t("you.tmdbTitle")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.tmdbHint")}
        </Text>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder={t("you.tmdbPlaceholder")}
          placeholderTextColor="#9a9ab0"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-surface2 text-text rounded-xl px-3 py-3 mb-3"
        />
        <Button
          label={saved ? t("you.saved") : t("you.saveKey")}
          icon={saved ? "checkmark" : "save-outline"}
          onPress={onSaveKey}
        />
        <Pressable
          onPress={() =>
            Linking.openURL("https://www.themoviedb.org/settings/api")
          }
          className="mt-3 flex-row items-center gap-1"
        >
          <Ionicons name="open-outline" size={14} color="#7c5cff" />
          <Text className="text-primary text-sm">{t("you.getKey")}</Text>
        </Pressable>
      </Card>

      <Card title={t("you.importTitle")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.importHint")}
        </Text>
        <Button
          label={t("you.importButton")}
          icon="cloud-upload-outline"
          variant="surface"
          onPress={() => router.push("/import")}
        />
      </Card>

      <Card title={t("you.backupTitle")}>
        <Text className="text-muted text-sm mb-3 leading-5">
          {t("you.backupHint")}
        </Text>
        <Button
          label={
            exportBackup.isPending ? t("you.exporting") : t("you.exportBackup")
          }
          icon="download-outline"
          variant="surface"
          onPress={onExport}
          disabled={exportBackup.isPending}
          className="mb-2"
        />
        <Button
          label={
            restoreBackup.isPending
              ? t("you.restoring")
              : t("you.restoreBackup")
          }
          icon="cloud-download-outline"
          variant="surface"
          onPress={onRestore}
          disabled={restoreBackup.isPending}
        />
      </Card>

      <Card title={t("you.dangerTitle")}>
        <Button
          label={t("you.clearAll")}
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

      <Text className="text-muted text-center text-xs mb-4">
        {t("you.footer")}
      </Text>
    </ScrollView>
  );
}
