import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { withAlpha } from '@/lib/color';

export type RadialGlowProps = {
  color: string;
  /** Diameter of the glow's bounding box. */
  size: number;
  /** Overall layer opacity, matching the design's `opacity` on the glow div. */
  opacity?: number;
  /** Where the gradient reaches full transparency, 0–1 (`68%` -> `0.68`). */
  falloff?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * `radial-gradient(circle, <color> 0%, transparent <falloff>)`.
 *
 * `expo-linear-gradient` is linear-only, so the atmospheric glows behind the
 * hero are drawn with `react-native-svg` instead. The design also puts an
 * 18px / 14px `filter: blur()` on them; a gradient that already fades to zero
 * alpha is visually unchanged by that, and RN has no view-level blur filter,
 * so it is dropped rather than approximated.
 */
export function RadialGlow({
  color,
  size,
  opacity = 1,
  falloff = 0.7,
  style,
}: RadialGlowProps) {
  // React 19 mints ids like `«r3»`; those characters are not valid in an SVG
  // id, and `url(#glow-«r3»)` silently fails to resolve the gradient.
  const gradientId = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Svg width={size} height={size} pointerEvents="none" style={[{ opacity }, style]}>
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} />
          <Stop offset={`${falloff * 100}%`} stopColor={withAlpha(color, 0)} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} fill={`url(#${gradientId})`} />
    </Svg>
  );
}
