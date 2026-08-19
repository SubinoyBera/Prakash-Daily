import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type RiseInViewProps = {
  children?: React.ReactNode;
  /** Starting offset in points (the design's `riseIn` uses 14). */
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The design's `@keyframes riseIn`:
 * `from { opacity: 0; translateY(14px) } to { opacity: 1; translateY(0) }`.
 *
 * Hand-rolled rather than using a Reanimated entering animation so it also
 * plays when the node is swapped in mid-layout, which is how the sheet moves
 * between its idle and authenticating states.
 */
export function RiseInView({ children, distance = 14, duration = 300, style }: RiseInViewProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration, easing: Easing.inOut(Easing.quad) });
  }, [duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: distance * (1 - progress.value) }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
