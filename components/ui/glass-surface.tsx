import { useMemo } from 'react';
import {
  StyleSheet,
  View,
  type BoxShadowValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BlurPane } from '@/components/ui/blur-pane';
import { white } from '@/constants/prakash-theme';

export type GlassSurfaceProps = {
  children?: React.ReactNode;
  /** CSS blur radius from the design, in px — mapped onto expo-blur intensity. */
  blur?: number;
  /** Corner radius. */
  radius: number;
  /** `background: rgba(255,255,255,X)` tint sitting on top of the blur. */
  tintOpacity?: number;
  /** `border: 1px solid rgba(255,255,255,X)`. */
  borderOpacity?: number;
  /**
   * `inset 0 1px 0 rgba(255,255,255,X)` — the 1px specular line along the top
   * edge that sells the glass. Pass `0` to omit.
   */
  highlightOpacity?: number;
  /**
   * Outer drop shadows. Kept as a prop rather than left to `style` because RN
   * replaces `boxShadow` wholesale on merge, which would drop the highlight.
   */
  shadows?: readonly BoxShadowValue[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * A single pane of the design's dark glass.
 *
 * The source uses `backdrop-filter: blur(Npx) saturate(160%)` plus a
 * translucent white fill, a hairline border and an inset top highlight.
 * React Native has no `backdrop-filter`, so the blur comes from `BlurPane`
 * (per the BUILD NOTES) and the rest is layered on top of it.
 *
 * `saturate()` has no RN equivalent; `BlurView` already over-saturates
 * slightly on iOS, and the translucent white fill recovers most of the
 * remaining lift on Android.
 */
export function GlassSurface({
  children,
  blur = 16,
  radius,
  tintOpacity = 0.09,
  borderOpacity = 0.16,
  highlightOpacity = 0,
  shadows,
  style,
  contentStyle,
}: GlassSurfaceProps) {
  const highlight = useMemo<BoxShadowValue[]>(
    () => [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 0,
        color: white(highlightOpacity),
        inset: true,
      },
    ],
    [highlightOpacity],
  );

  return (
    <View
      style={[
        styles.root,
        {
          borderRadius: radius,
          borderColor: white(borderOpacity),
        },
        shadows ? { boxShadow: shadows } : null,
        style,
      ]}>
      <BlurPane blur={blur} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: white(tintOpacity) }]}
      />
      <View style={contentStyle}>{children}</View>
      {highlightOpacity > 0 ? (
        // An inset box-shadow paints beneath sibling views, so the specular
        // top edge has to live in its own overlay above the blur to be seen.
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: highlight }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
