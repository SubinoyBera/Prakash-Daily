import { DeviceMotion } from 'expo-sensors';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type ParallaxContextValue = {
  /** Normalised horizontal offset from the centre, −0.5 … 0.5. */
  x: SharedValue<number>;
  /** Normalised vertical offset from the centre, −0.5 … 0.5. */
  y: SharedValue<number>;
  /** Free-running 0→1 clock driving the idle wobble. */
  clock: SharedValue<number>;
  /** Multiplier on every layer's depth (the design's `parallax` prop, 0–2). */
  amount: number;
};

const ParallaxContext = createContext<ParallaxContextValue | null>(null);

const RETURN_SPRING = { damping: 20, stiffness: 90, mass: 0.7 } as const;

/**
 * Under-damped on purpose: each tilt sample lands with a little overshoot, so
 * moving the phone makes the stack settle rather than slide. That settle is
 * what reads as "alive" in the hand.
 */
const TILT_SPRING = { damping: 12, stiffness: 70, mass: 0.6 } as const;

/**
 * Android 12+ caps sensor delivery at 200ms for apps without
 * `HIGH_SAMPLING_RATE_SENSORS`, so this is the floor in practice. The spring
 * above is what turns 5Hz of samples into continuous motion.
 */
const TILT_INTERVAL = 80;

/** Radians of tilt for full deflection — about 29°. */
const TILT_RANGE = 0.5;

/**
 * How fast the neutral posture follows the phone, per sample. Without this the
 * layers stay pinned off-centre for anyone who holds their phone at an angle;
 * with it, any resting posture becomes centre within a few seconds while real
 * movement still registers.
 */
const RECENTRE = 0.03;

/** Idle wobble: full cycle length, and its travel in points at depth 18. */
const WOBBLE_CYCLE = 5200;
const WOBBLE_TRAVEL = 0.09;

const TAU = Math.PI * 2;

export type ParallaxProviderProps = {
  children: React.ReactNode;
  /** The design's `parallax` prop: 0 disables, 1 is default, 2 is doubled. */
  amount?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Depth tracker for the hero stack.
 *
 * The source design drives its `[data-depth]` layers from `pointermove`, which
 * does not exist on a touch device. Two things stand in for the cursor:
 *
 *   1. **Device tilt** (`expo-sensors` DeviceMotion) — the phone's attitude
 *      takes the place of the pointer position, so the scene reacts to being
 *      held and moved without any input at all. The BUILD NOTES call gyroscope
 *      parallax optional; without it this screen is inert on a phone, which is
 *      the one thing the design is not.
 *   2. **Dragging** — a finger on the glass still steers directly, and takes
 *      precedence over tilt while it is down. `minDistance(10)` means a tap is
 *      never captured here, so buttons underneath stay fully pressable.
 *
 * On top of both, every layer carries a permanent sub-pixel wobble (see
 * `ParallaxLayer`) so the stack breathes even on a desk.
 */
export function ParallaxProvider({ children, amount = 1, style }: ParallaxProviderProps) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const clock = useSharedValue(0);
  const dragging = useSharedValue(0);
  const width = useSharedValue(1);
  const height = useSharedValue(1);

  /** Neutral attitude, in radians, tracked on the JS thread between samples. */
  const rest = useRef<{ beta: number; gamma: number } | null>(null);

  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: WOBBLE_CYCLE, easing: Easing.linear }),
      -1,
      false,
    );
  }, [clock]);

  useEffect(() => {
    // Web needs a user gesture before it will hand over motion events, and the
    // pan gesture already covers a mouse there.
    if (amount <= 0 || Platform.OS === 'web') {
      return;
    }

    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    const clamp = (value: number) => Math.min(0.5, Math.max(-0.5, value));

    (async () => {
      const available = await DeviceMotion.isAvailableAsync().catch(() => false);
      if (!available || cancelled) {
        return;
      }

      DeviceMotion.setUpdateInterval(TILT_INTERVAL);
      subscription = DeviceMotion.addListener(({ rotation }) => {
        // A finger on the glass wins; tilt would otherwise fight the drag.
        if (!rotation || dragging.value === 1) {
          return;
        }

        const { beta, gamma } = rotation;
        if (!Number.isFinite(beta) || !Number.isFinite(gamma)) {
          return;
        }

        if (rest.current === null) {
          rest.current = { beta, gamma };
        } else {
          rest.current = {
            beta: rest.current.beta + (beta - rest.current.beta) * RECENTRE,
            gamma: rest.current.gamma + (gamma - rest.current.gamma) * RECENTRE,
          };
        }

        // gamma is rotation about the phone's long axis (tilt left/right),
        // beta about its short axis (tilt toward and away from you).
        x.value = withSpring(clamp((gamma - rest.current.gamma) / TILT_RANGE), TILT_SPRING);
        y.value = withSpring(clamp((beta - rest.current.beta) / TILT_RANGE), TILT_SPRING);
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      rest.current = null;
    };
  }, [amount, dragging, x, y]);

  const gesture = useMemo(() => {
    const clamp = (value: number) => Math.min(0.5, Math.max(-0.5, value));
    const track = (px: number, py: number) => {
      'worklet';
      x.value = clamp(px / width.value - 0.5);
      y.value = clamp(py / height.value - 0.5);
    };

    return Gesture.Pan()
      .minDistance(10)
      .onStart(() => {
        dragging.value = 1;
      })
      .onUpdate((event) => {
        track(event.x, event.y);
      })
      .onFinalize(() => {
        dragging.value = 0;
        x.value = withSpring(0, RETURN_SPRING);
        y.value = withSpring(0, RETURN_SPRING);
      });
  }, [dragging, height, width, x, y]);

  const value = useMemo<ParallaxContextValue>(
    () => ({ x, y, clock, amount }),
    [amount, clock, x, y],
  );

  return (
    <ParallaxContext.Provider value={value}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[StyleSheet.absoluteFill, style]}
          onLayout={({ nativeEvent }) => {
            width.value = Math.max(1, nativeEvent.layout.width);
            height.value = Math.max(1, nativeEvent.layout.height);
          }}>
          {children}
        </Animated.View>
      </GestureDetector>
    </ParallaxContext.Provider>
  );
}

export type ParallaxLayerProps = {
  children?: React.ReactNode;
  /** Travel in points at full offset — the design's `data-depth` value. */
  depth: number;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewStyle['pointerEvents'];
};

/**
 * One `[data-depth]` layer. Layers nest: the source puts `data-depth="14"`
 * inside `data-depth="18"` so the front story card travels furthest, and
 * composed RN transforms reproduce that for free.
 *
 * Each layer also carries a wobble of its own — two out-of-step sines whose
 * period and phase are derived from `depth`, so no two layers ever line up and
 * the stack never looks like one rigid sheet. It peaks at well under a point;
 * it should be felt rather than seen.
 */
export function ParallaxLayer({ children, depth, style, pointerEvents }: ParallaxLayerProps) {
  const context = useContext(ParallaxContext);
  const idle = useSharedValue(0);

  const x = context?.x ?? idle;
  const y = context?.y ?? idle;
  const clock = context?.clock ?? idle;
  const amount = context?.amount ?? 0;

  const animatedStyle = useAnimatedStyle(() => {
    const travel = depth * amount;
    const wobble = depth * WOBBLE_TRAVEL * amount;
    // Derived from depth so each layer runs at its own rate and phase.
    const phase = depth * 0.137;
    const drift = Math.sin(TAU * (clock.value + phase));
    const sway = Math.cos(TAU * (clock.value * 0.63 + phase * 1.7));

    return {
      transform: [
        { translateX: -x.value * travel + sway * wobble },
        // The source damps vertical travel to 60% of horizontal.
        { translateY: -y.value * travel * 0.6 + drift * wobble * 0.8 },
        { rotateZ: `${drift * 0.05 * amount}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents={pointerEvents} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
