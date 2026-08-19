import { BlurView } from 'expo-blur';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  androidGlassFill,
  blurIntensity,
  supportsBackdropBlur,
} from '@/constants/prakash-theme';

export type BlurPaneProps = {
  /** CSS `backdrop-filter: blur(Npx)` radius from the design, in px. */
  blur: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one place `expo-blur` is allowed to be used.
 *
 * Every glass surface in the design goes through here so the Android
 * substitution (see `androidGlassFill`) is made once rather than at each call
 * site — and so a crashing blur backend can never reach the render tree.
 */
export function BlurPane({ blur, style }: BlurPaneProps) {
  if (!supportsBackdropBlur) {
    return (
      <View pointerEvents="none" style={[{ backgroundColor: androidGlassFill(blur) }, style]} />
    );
  }

  return (
    <BlurView
      intensity={blurIntensity(blur)}
      tint="dark"
      pointerEvents="none"
      style={style ?? StyleSheet.absoluteFill}
    />
  );
}
