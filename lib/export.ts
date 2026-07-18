import { Platform } from "react-native";
import { exportAll, importAll } from "./db";
import type { ExportBundle } from "./types";

/**
 * Produce a JSON backup of the whole library and hand it to the user:
 *  - web: triggers a browser download
 *  - native: writes to a cache file and opens the share sheet
 */
export async function exportBackup(): Promise<string> {
  const bundle = await exportAll();
  const json = JSON.stringify(bundle, null, 2);
  const filename = `episodic-backup-${formatDate(bundle.exported_at)}.json`;

  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return `Downloaded ${filename}`;
  }

  const { File, Paths } = require("expo-file-system");
  const Sharing = require("expo-sharing");
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
    return "Backup ready to share";
  }
  return `Saved to ${file.uri}`;
}

export async function restoreBackup(json: string): Promise<void> {
  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(json) as ExportBundle;
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  await importAll(bundle);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
