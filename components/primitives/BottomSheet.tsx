import { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Reusable bottom drawer/sheet. Slides up from the bottom, dims the background,
 * and closes on backdrop tap or hardware back.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable onPress={() => {}} className="active:opacity-100">
          <SafeAreaView edges={["bottom"]} className="bg-surface rounded-t-3xl">
            <View className="px-4 pt-3 pb-4">
              <View className="w-10 h-1.5 rounded-full bg-border self-center mb-4" />
              {title ? (
                <Text className="text-text text-lg font-bold mb-3">{title}</Text>
              ) : null}
              {children}
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ScreenTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="px-4 pt-2 pb-4">
      <Text className="text-3xl font-bold text-text">{title}</Text>
      {subtitle ? <Text className="mt-1 text-muted">{subtitle}</Text> : null}
    </View>
  );
}
