import { Redirect } from "expo-router";

/** Settings live under the You tab now. */
export default function SettingsRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
