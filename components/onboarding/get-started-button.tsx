import { Colors, Fonts } from "@/constants/onboarding-theme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const HEIGHT = 60;
const LIFT = 8; // how far the face sits above its slab
/** Near-stadium. At height 60 a radius of 30 would be a full pill; 28 keeps a
 *  hint of corner, which is what the reference has. */
const RADIUS = 28;
const HALO_LAYERS = 11;
const CORE_LAYERS = 4;

/**
 * One full cycle = the sheen pass plus the pause. PASS_FRACTION is how much of
 * that cycle the band spends crossing the face; the rest it sits off-screen.
 */
const CYCLE_MS = 5000;
const PASS_FRACTION = 0.48;
const SHEEN_WIDTH = 150;

type Tri = readonly [string, string, string];

/**
 * Left-to-right warm ramp: pale amber into saturated orange. Deeper at the
 * right end than the brand accent alone, which is what gives the face its
 * roundness instead of reading as flat fill.
 */
const IDLE_FACE: Tri = ["#FFC97F", "#FF9A3F", "#F26A18"];
const PRESSED_FACE: Tri = ["#F0A04A", "#E87C22", Colors.accentDeep];

/**
 * A soft orange bloom under the button, built from stacked translucent rounded
 * rects rather than shadow props — Android's shadows are grey-only via
 * `elevation`, and the coloured shadow path on Fabric is the code we're
 * deliberately staying away from.
 */
function Bloom() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Wide, soft halo. Falloff is raised to a power so the outer layers
          fade faster than linearly — a linear ramp reads as a flat disc. */}
      {Array.from({ length: HALO_LAYERS }, (_, i) => {
        const spread = (i + 1) * 9;
        return (
          <View
            key={`halo-${i}`}
            style={{
              position: "absolute",
              left: -spread,
              right: -spread,
              top: LIFT - spread * 0.3,
              height: HEIGHT + spread * 1.35,
              borderRadius: RADIUS + spread,
              backgroundColor: Colors.accent,
              opacity: 0.05 * (1 - i / HALO_LAYERS) ** 1.35,
            }}
          />
        );
      })}

      {/* Tight hot core hugging the slab, biased downward so the light reads
          as spilling out from underneath the button. */}
      {Array.from({ length: CORE_LAYERS }, (_, i) => {
        const spread = (i + 1) * 3;
        return (
          <View
            key={`core-${i}`}
            style={{
              position: "absolute",
              left: -spread,
              right: -spread,
              top: LIFT + spread * 0.7,
              height: HEIGHT,
              borderRadius: RADIUS + spread,
              backgroundColor: Colors.accentMid,
              opacity: 0.1 * (1 - i / CORE_LAYERS),
            }}
          />
        );
      })}
    </View>
  );
}

export function GetStartedButton({
  onPress,
  label = "Get Started",
  paused = false,
}: {
  onPress: () => void;
  label?: string;
  /** Freeze the sheen while something covers the screen. */
  paused?: boolean;
}) {
  const [measured, setMeasured] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const sweep = useSharedValue(0);

  /**
   * Press state lives in a shared value, not React state.
   *
   * The previous version flipped a useState on press, which meant a JS-thread
   * re-render and a hard style swap — the face jumped its full 8px in one
   * frame and the gradient cut instantly. Driving it on the UI thread lets the
   * press actually travel.
   */
  const press = useSharedValue(0);

  // Never let the travel distance be 0 before onLayout has reported.
  const width = measured || screenWidth;

  const pressIn = () => {
    // Quick and linear-ish going down: a press should feel immediate.
    press.value = withTiming(1, {
      duration: 90,
      easing: Easing.out(Easing.quad),
    });
  };

  const pressOut = () => {
    // Springy coming back up, so the button feels like it has weight.
    press.value = withSpring(0, { damping: 15, stiffness: 280, mass: 0.5 });
  };

  const frame = useFrameCallback((f) => {
    "worklet";
    sweep.value = (f.timeSinceFirstFrame % CYCLE_MS) / CYCLE_MS;
  }, false);

  useEffect(() => {
    frame.setActive(!paused && !reducedMotion);
  }, [frame, paused, reducedMotion]);

  const sheenStyle = useAnimatedStyle(() => {
    const p = Math.min(sweep.value / PASS_FRACTION, 1);
    const eased = 0.5 - Math.cos(Math.PI * p) / 2;
    return {
      transform: [
        {
          translateX: interpolate(
            eased,
            [0, 1],
            [-SHEEN_WIDTH, width + SHEEN_WIDTH],
          ),
        },
        { rotateZ: "18deg" },
      ],
    };
  });

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * LIFT }],
  }));

  /** Pressed gradient crossfades in over the idle one. */
  const pressedFillStyle = useAnimatedStyle(() => ({ opacity: press.value }));
  const highlightStyle = useAnimatedStyle(() => ({ opacity: 1 - press.value }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: 1 - press.value * 0.45,
  }));

  return (
    <View
      style={styles.wrapper}
      onLayout={(e: LayoutChangeEvent) =>
        setMeasured(e.nativeEvent.layout.width)
      }
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, bloomStyle]}
        pointerEvents="none"
      >
        <Bloom />
      </Animated.View>

      <View style={styles.slab} pointerEvents="none" />

      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        style={styles.pressArea}
      >
        <Animated.View style={[styles.face, faceStyle]}>
          <LinearGradient
            colors={IDLE_FACE}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View
            style={[StyleSheet.absoluteFill, pressedFillStyle]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={PRESSED_FACE}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.75 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            style={[styles.topHighlight, highlightStyle]}
            pointerEvents="none"
          />

          {/*
            A GRADIENT, not a solid block. The previous version used a flat
            14px rect here, and its top edge drew a visible horizontal line
            across the button. A gradient from transparent has no edge.
          */}
          <LinearGradient
            colors={["rgba(120,45,5,0)", "rgba(120,45,5,0.26)"]}
            style={styles.bottomShade}
            pointerEvents="none"
          />

          {/* Light ray sweeping across every few seconds */}
          <Animated.View
            pointerEvents="none"
            style={[styles.sheen, sheenStyle]}
          >
            <LinearGradient
              colors={[
                "rgba(255,255,255,0)",
                "rgba(255,255,255,0.2)",
                "rgba(255,255,255,0.6)",
                "rgba(255,255,255,0.2)",
                "rgba(255,255,255,0)",
              ]}
              locations={[0, 0.35, 0.5, 0.65, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Text style={styles.label}>{label}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 28,
    width: "100%",
    height: HEIGHT + LIFT,
  },
  slab: {
    position: "absolute",
    left: 0,
    right: 0,
    top: LIFT,
    height: HEIGHT,
    borderRadius: RADIUS,
    backgroundColor: Colors.accentDeep,
  },
  /** Covers both resting and pressed positions so the target never moves. */
  pressArea: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: HEIGHT + LIFT,
  },
  face: {
    height: HEIGHT,
    width: "100%",
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 22,
    right: 22,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
  },
  sheen: {
    position: "absolute",
    left: 0,
    top: -HEIGHT,
    width: SHEEN_WIDTH,
    height: HEIGHT * 3,
  },
  label: {
    fontFamily: Fonts.extrabold,
    fontSize: 17.5,
    letterSpacing: 0.2,
    color: Colors.buttonText,
  },
});
