import { LinearGradient } from 'expo-linear-gradient';
import { Image, type ImageContentFit, type ImageSource } from 'expo-image';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Palette } from '@/constants/prakash-theme';

export type ImageSlotProps = {
  /** Drop a real asset or remote URL in here to fill the slot. */
  source?: ImageSource | string | number | null;
  /** What belongs here, for screen readers and for whoever wires the art up. */
  placeholder?: string;
  radius?: number;
  contentFit?: ImageContentFit;
  /** Gradient used when no `source` is supplied. */
  fallbackColors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
};

/**
 * React Native counterpart of the design's `<image-slot>` custom element.
 *
 * Both slots in the source (`prakash-hero`, `prakash-card-thumb`) ship empty,
 * so this renders a composed gradient stand-in instead of a broken image. It
 * is deliberately *quiet*: an earlier version drew a dashed "drop art here"
 * box over the fallback, which — on the hero slot, which is the whole screen —
 * put a dashed rectangle and a line of shouting uppercase across the entire
 * background. The empty state has to look like a designed dark surface,
 * because until real art is wired up it is the background.
 */
export function ImageSlot({
  source,
  placeholder,
  radius = 0,
  contentFit = 'cover',
  fallbackColors = ['#241C2E', '#3A2438', '#12131A'],
  style,
}: ImageSlotProps) {
  if (source) {
    return (
      <Image
        source={source}
        contentFit={contentFit}
        transition={280}
        accessibilityLabel={placeholder}
        // The prop is authored as a view style so the same value can drive
        // both the filled and the fallback branch.
        style={[{ borderRadius: radius }, style] as StyleProp<ImageStyle>}
      />
    );
  }

  return (
    <View
      accessible={false}
      accessibilityLabel={placeholder}
      style={[styles.fallback, { borderRadius: radius }, style]}>
      <LinearGradient
        colors={fallbackColors}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    overflow: 'hidden',
    backgroundColor: Palette.ink,
  },
});
