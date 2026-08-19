import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type DriftViewProps = {
  children?: React.ReactNode;
  /** Peak vertical travel in points (the design uses 9 / 6 / 4). */
  distance: number;
  /** Full cycle length in ms (the design uses 7000 / 7800 / 8400). */
  duration: number;
  /**
   * Starting point in the cycle, 0–1. Reproduces the source's negative
   * `animation-delay` (e.g. `-1.2s` on an `8.4s` loop === `phase 0.857`)
   * without waiting for the offset to elapse.
   */
  phase?: number;
  style?: StyleProp<ViewStyle>;
};

const TAU = Math.PI * 2;

/**
 * The `@keyframes drift` family from the design:
 *
 *   0%, 100% { translateY(0) }  50% { translateY(-distance) }  ease-in-out
 *
 * Driving one linear 0→1 clock and shaping it with a cosine gives both the
 * ease-in-out feel and exact phase control, which a `withRepeat(..., true)`
 * ping-pong cannot offer.
 */
export function DriftView({ children, distance, duration, phase = 0, style }: DriftViewProps) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [clock, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    // (1 - cos(2πt)) / 2 -> 0 at t=0, 1 at t=0.5, 0 at t=1
    const eased = (1 - Math.cos(TAU * t)) / 2;
    return { transform: [{ translateY: -distance * eased }] };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
