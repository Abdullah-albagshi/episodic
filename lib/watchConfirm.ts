import { Alert, Platform } from "react-native";

export type ConfirmChoice = "yes" | "no" | "cancel";

function webConfirm(message: string): boolean {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(message);
  }
  return true;
}

/** Simple OK / Cancel confirm. Resolves true if the user confirms. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = "Continue"
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(webConfirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Three-way confirm used for "mark previous episodes too?".
 * On web, "Never ask again" is offered via a second confirm after Yes/No.
 */
export function confirmSkipEpisodes(
  count: number
): Promise<"yes" | "no" | "never" | "cancel"> {
  const title = "Mark previous episodes?";
  const message =
    count === 1
      ? "You skipped an earlier episode. Mark it watched too?"
      : `You skipped ${count} earlier episodes. Mark them watched too?`;

  if (Platform.OS === "web") {
    const markPrev = webConfirm(`${title}\n\n${message}`);
    if (!markPrev) {
      // Second chance: mark only this episode, or cancel entirely.
      const onlyThis = webConfirm(
        "Mark only this episode?\n\nCancel to abort."
      );
      return Promise.resolve(onlyThis ? "no" : "cancel");
    }
    const never = webConfirm(
      "Always mark previous episodes without asking?\n\nOK = never ask again. Cancel = ask next time."
    );
    return Promise.resolve(never ? "never" : "yes");
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
      { text: "Only this", onPress: () => resolve("no") },
      { text: "Never ask", onPress: () => resolve("never") },
      { text: "Yes, mark all", onPress: () => resolve("yes") },
    ]);
  });
}
