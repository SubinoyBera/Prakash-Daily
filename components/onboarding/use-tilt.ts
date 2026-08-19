import { DeviceMotion } from "expo-sensors";
import { useEffect, useRef } from "react";
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Tilt (radians) that maps to FULL deflection. ~20°, a comfortable wrist turn.
 *
 * The previous version returned raw radians and multiplied by px-per-radian,
 * which meant a normal 8° tilt moved a card about 6px — technically working,
 * practically invisible. Normalising to -1..1 over a realistic range puts the
 * amplitude decision in one obvious place instead.
 */
const RANGE = 0.35;
/** Sensor poll interval. Deliberately coarse — smoothing fills the gaps. */
const INTERVAL_MS = 50;
/** Per-frame lerp toward the target. Higher = more responsive, less liquid. */
const EASE = 0.12;
const GRAVITY = 9.81;

const unit = (v: number) => {
  const n = v / RANGE;
  return n > 1 ? 1 : n < -1 ? -1 : n;
};

export type Tilt = {
  /** Left/right tilt, -1..1, 0 at the resting pose. */
  tiltX: SharedValue<number>;
  /** Forward/back tilt, -1..1, 0 at the resting pose. */
  tiltY: SharedValue<number>;
};

/**
 * Parallax input from the device's motion sensors.
 *
 * Three things this handles that a naive version doesn't:
 *
 * 1. The first reading becomes the zero point. Nobody holds a phone flat, so
 *    raw beta/gamma would park the cards permanently off-centre.
 *
 * 2. `rotation` isn't present on every device or in every Expo Go build. When
 *    it's missing we derive tilt from the gravity vector instead, which comes
 *    from the accelerometer and is effectively universal.
 *
 * 3. The sensor reports at ~20Hz but we render at 60, so raw values look
 *    stepped. The reading goes into a target and a frame callback eases toward
 *    it, which also makes motion settle rather than stop dead.
 *
 * If nothing is available the shared values stay at 0 and cards simply don't
 * parallax — no error path required.
 */
export function useTilt(enabled: boolean): Tilt {
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const rest = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Glide back to neutral rather than snapping.
      targetX.value = 0;
      targetY.value = 0;
      return;
    }

    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    try {
      DeviceMotion.setUpdateInterval(INTERVAL_MS);
      sub = DeviceMotion.addListener((data) => {
        if (cancelled) return;

        let x: number | undefined;
        let y: number | undefined;

        const r = data.rotation;
        if (r && typeof r.gamma === "number" && typeof r.beta === "number") {
          x = r.gamma;
          y = r.beta;
        } else {
          // Fallback: the gravity vector. For small angles the normalised
          // component is close enough to the tilt angle in radians.
          const g = data.accelerationIncludingGravity;
          if (g && typeof g.x === "number" && typeof g.y === "number") {
            x = -g.x / GRAVITY;
            y = -g.y / GRAVITY;
          }
        }

        if (x === undefined || y === undefined) return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        if (!rest.current) rest.current = { x, y };
        targetX.value = unit(x - rest.current.x);
        targetY.value = unit(y - rest.current.y);
      });
    } catch {
      // No sensors on this device/simulator. Cards just won't parallax.
    }

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, targetX, targetY]);

  const smoother = useFrameCallback(() => {
    "worklet";
    tiltX.value += (targetX.value - tiltX.value) * EASE;
    tiltY.value += (targetY.value - tiltY.value) * EASE;
  }, false);

  useEffect(() => {
    // Always smoothing, so disabling animates back to neutral instead of
    // freezing the cards mid-tilt.
    smoother.setActive(true);
    return () => smoother.setActive(false);
  }, [smoother]);

  return { tiltX, tiltY };
}
