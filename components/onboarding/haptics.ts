import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const supported = Platform.OS === "ios" || Platform.OS === "android";

/**
 * Haptics must never be able to break a tap. Emulators without a vibrator, a
 * missing VIBRATE permission, and web all reject — swallow it. A button that
 * throws because the phone can't buzz is worse than no feedback.
 */
const safe = (fn: () => Promise<void>) => {
  if (!supported) return;
  try {
    fn().catch(() => {});
  } catch {
    /* no-op */
  }
};

/** Secondary actions — social buttons, links. */
export const tapLight = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Primary actions — Get Started, Continue. */
export const tapMedium = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Picking something from a set — accepting a typo suggestion. */
export const tapSelection = () => safe(() => Haptics.selectionAsync());

export const notifySuccess = () =>
  safe(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );

export const notifyError = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
