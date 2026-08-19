import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

type GlassViewProps = {
  /** Matches expo-blur's intensity scale (0–100). */
  intensity?: number;
  tint?: 'dark' | 'light';
  /** Override the Android fill if the computed one doesn't suit the surface. */
  androidFill?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Why this exists:
 *
 * expo-blur only produces real blur on Android via
 * `experimentalBlurMethod="dimezisBlurView"`, which snapshots the views behind
 * it into a SOFTWARE canvas. Our backdrop is react-native-svg, which Android
 * renders as a HARDWARE bitmap — drawing one into the other throws
 * "Software rendering doesn't support hardware bitmaps" and crashes the app.
 *
 * So: real blur on iOS, a calibrated translucent fill on Android. The dark
 * gradient backdrop means the difference is barely visible.
 */
export function GlassView({
  intensity = 30,
  tint = 'dark',
  androidFill,
  style,
  children,
}: GlassViewProps) {
  if (Platform.OS === 'android') {
    // Higher intensity reads as a denser, more opaque pane.
    const fill =
      androidFill ??
      (tint === 'light'
        ? `rgba(255,255,255,${(0.06 + intensity / 500).toFixed(3)})`
        : `rgba(20,21,28,${(0.55 + intensity / 260).toFixed(3)})`);

    return <View style={[style, { backgroundColor: fill }]}>{children}</View>;
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={style}>
      {children}
    </BlurView>
  );
}