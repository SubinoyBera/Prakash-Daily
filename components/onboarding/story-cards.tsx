import { Colors, Fonts } from "@/constants/onboarding-theme";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GlassView } from "./glass-view";
import { useTilt } from "./use-tilt";
import { STORIES, type Story } from "./stories";

/**
 * Three static cards with a gentle idle float, whose CONTENT rotates
 * independently and continuously through STORIES. Position/tilt/drift is
 * untouched — this only adds a content layer on top via useRotatingStory.
 */

const TOP = [0, 66, 138] as const;
const DRIFT = [
  { period: 8400, amp: 4, phase: 0 },
  { period: 7800, amp: 6, phase: 900 },
  { period: 7000, amp: 9, phase: 1800 },
] as const;

/** How often each card swaps its headline, staggered so they never sync up. */
const ROTATE_MS = [6400, 5200, 4600] as const;
const ROTATE_DELAY_MS = [0, 1400, 2600] as const;

const PERSPECTIVE = 700;

/**
 * Points of travel at full tilt, back card -> hero. The front card moves
 * furthest, which is what reads as depth rather than one sliding sheet.
 * Vertical is damped because a phone pitches much further than it rolls.
 */
const TILT_X = [14, 20, 28] as const;
const TILT_Y = [8, 12, 17] as const;

const depth = (elevation: number, radius: number, opacity: number) =>
  Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: Math.round(radius * 0.6) },
    },
    default: { elevation },
  });

/**
 * Cycles a card's content through STORIES on its own timer. Content is
 * swapped at the trough of a fade-out (invisible), so the change itself is
 * never seen mid-motion — only the fade/slide transition is visible.
 */
function useRotatingStory(
  startIndex: number,
  intervalMs: number,
  startDelayMs: number,
  enabled: boolean,
) {
  const indexRef = useRef(startIndex);
  const [story, setStory] = useState<Story>(
    STORIES[startIndex % STORIES.length],
  );

  const opacity = useSharedValue(1);
  const shiftY = useSharedValue(0);
  const fill = useSharedValue(0);

  const swapContent = useCallback(() => {
    indexRef.current += 1;
    setStory(STORIES[indexRef.current % STORIES.length]);
  }, []);

  const advance = useCallback(() => {
    opacity.value = withTiming(0, {
      duration: 240,
      easing: Easing.in(Easing.cubic),
    });
    shiftY.value = withTiming(
      -8,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (!finished) return;
        runOnJS(swapContent)();
        shiftY.value = 8;
        opacity.value = withTiming(1, {
          duration: 340,
          easing: Easing.out(Easing.cubic),
        });
        shiftY.value = withTiming(0, {
          duration: 340,
          easing: Easing.out(Easing.cubic),
        });
      },
    );
  }, [opacity, shiftY, swapContent]);

  useEffect(() => {
    if (!enabled) {
      fill.value = 0;
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const runCycle = () => {
      fill.value = 0;
      fill.value = withTiming(1, {
        duration: intervalMs,
        easing: Easing.linear,
      });
    };

    const timeoutId = setTimeout(() => {
      runCycle();
      intervalId = setInterval(() => {
        advance();
        runCycle();
      }, intervalMs);
    }, startDelayMs);

    runCycle();

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, intervalMs, startDelayMs, advance, fill]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: shiftY.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return { story, contentStyle, progressStyle };
}

function CardBody({
  story,
  contentStyle,
  progressStyle,
  thumbSize,
  tagStyle,
  titleStyle,
  progressTint,
}: {
  story: Story;
  contentStyle: any;
  progressStyle: any;
  thumbSize: number;
  tagStyle: object;
  titleStyle: object;
  progressTint: string;
}) {
  return (
    <Animated.View style={[styles.row, contentStyle]}>
      <View
        style={[
          styles.thumbWrap,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize * 0.28,
          },
        ]}
      >
        <Image
          source={{ uri: story.image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={320}
        />
      </View>
      <View style={styles.col}>
        <View style={styles.metaRow}>
          <Text style={tagStyle}>{story.tag}</Text>
          <Text style={styles.readTime}>{story.read}</Text>
        </View>
        <Text style={titleStyle} numberOfLines={2}>
          {story.title}
        </Text>
        <Text style={styles.sources}>{story.sources}</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: progressTint },
              progressStyle,
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

export default function NewsCards({ paused = false }: { paused?: boolean }) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const animating = !paused && !reducedMotion;

  const w = Math.min(width, 430);
  const w1 = w - 108;
  const w2 = w - 76;
  const w3 = w - 40;

  const drift1 = useSharedValue(0);
  const drift2 = useSharedValue(0);
  const drift3 = useSharedValue(0);

  // Gyroscope parallax: -1..1 per axis, 0 at whatever pose the phone was
  // first held in.
  const { tiltX, tiltY } = useTilt(animating);

  const frame = useFrameCallback((f) => {
    "worklet";
    const t = f.timeSinceFirstFrame;
    const wave = (period: number, amp: number, phase: number) =>
      -(amp / 2) * (1 - Math.cos((2 * Math.PI * (t + phase)) / period));

    drift1.value = wave(DRIFT[0].period, DRIFT[0].amp, DRIFT[0].phase);
    drift2.value = wave(DRIFT[1].period, DRIFT[1].amp, DRIFT[1].phase);
    drift3.value = wave(DRIFT[2].period, DRIFT[2].amp, DRIFT[2].phase);
  }, false);

  useEffect(() => {
    frame.setActive(animating);
  }, [frame, animating]);

  // Independent content rotation per card — different pace, different start
  // offset, so headlines never change in lockstep.
  const card1 = useRotatingStory(
    3,
    ROTATE_MS[0],
    ROTATE_DELAY_MS[0],
    animating,
  );
  const card2 = useRotatingStory(
    8,
    ROTATE_MS[1],
    ROTATE_DELAY_MS[1],
    animating,
  );
  const card3 = useRotatingStory(
    0,
    ROTATE_MS[2],
    ROTATE_DELAY_MS[2],
    animating,
  );

  const style1 = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: tiltX.value * TILT_X[0] },
      { translateY: drift1.value + tiltY.value * TILT_Y[0] },
      { rotateX: "14deg" },
      { rotateZ: "-3deg" },
    ],
  }));

  const style2 = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: tiltX.value * TILT_X[1] },
      { translateY: drift2.value + tiltY.value * TILT_Y[1] },
      { rotateX: "10deg" },
      { rotateZ: "2deg" },
    ],
  }));

  const style3 = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { translateX: tiltX.value * TILT_X[2] },
      { translateY: drift3.value + tiltY.value * TILT_Y[2] },
      { rotateX: "6deg" },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* Card 1 — furthest back */}
      <View style={[styles.wrapper, { top: TOP[0], zIndex: 1 }]}>
        <Animated.View
          style={[styles.origin, { width: w1, opacity: 0.72 }, style1]}
        >
          <View style={[styles.card, styles.card1, { width: w1 }]}>
            <GlassView
              intensity={18}
              tint="dark"
              androidFill="rgba(24,25,33,0.66)"
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, styles.tint1]} />
            <CardBody
              story={card1.story}
              contentStyle={card1.contentStyle}
              progressStyle={card1.progressStyle}
              thumbSize={44}
              tagStyle={styles.category1}
              titleStyle={styles.title1}
              progressTint="rgba(255,255,255,0.5)"
            />
          </View>
        </Animated.View>
      </View>

      {/* Card 2 — middle */}
      <View style={[styles.wrapper, { top: TOP[1], zIndex: 2 }]}>
        <Animated.View
          style={[styles.origin, { width: w2, opacity: 0.88 }, style2]}
        >
          <View style={[styles.card, styles.card2, { width: w2 }]}>
            <GlassView
              intensity={28}
              tint="dark"
              androidFill="rgba(24,25,33,0.74)"
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, styles.tint2]} />
            <CardBody
              story={card2.story}
              contentStyle={card2.contentStyle}
              progressStyle={card2.progressStyle}
              thumbSize={58}
              tagStyle={styles.category2}
              titleStyle={styles.title2}
              progressTint={Colors.accent}
            />
          </View>
        </Animated.View>
      </View>

      {/* Card 3 — hero */}
      <View style={[styles.wrapper, { top: TOP[2], zIndex: 3 }]}>
        <Animated.View style={[styles.origin, { width: w3 }, style3]}>
          <View style={[styles.card, styles.card3, { width: w3 }]}>
            <GlassView
              intensity={40}
              tint="dark"
              androidFill="rgba(26,27,36,0.9)"
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, styles.tint3]} />
            <CardBody
              story={card3.story}
              contentStyle={card3.contentStyle}
              progressStyle={card3.progressStyle}
              thumbSize={72}
              tagStyle={styles.category3}
              titleStyle={styles.title3}
              progressTint={Colors.accent}
            />
            <LinearGradient
              colors={[Colors.accent, "rgba(255,122,47,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.accentLine}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 248, width: "100%", alignItems: "center" },
  wrapper: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  origin: { transformOrigin: "50% 100%" },
  card: { overflow: "hidden", borderWidth: 1 },
  card1: {
    borderRadius: 22,
    borderColor: "rgba(255,255,255,0.12)",
    ...depth(2, 18, 0.35),
  },
  card2: {
    borderRadius: 24,
    borderColor: "rgba(255,255,255,0.16)",
    ...depth(7, 22, 0.45),
  },
  card3: {
    borderRadius: 26,
    borderColor: "rgba(255,255,255,0.2)",
    ...depth(14, 28, 0.55),
  },
  tint1: { backgroundColor: "rgba(255,255,255,0.05)" },
  tint2: { backgroundColor: "rgba(255,255,255,0.07)" },
  tint3: { backgroundColor: "rgba(255,255,255,0.09)" },

  row: { flexDirection: "row", padding: 14, gap: 13 },
  col: { flex: 1, gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },

  thumbWrap: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  category1: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
  },
  title1: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  category2: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.accent,
    textTransform: "uppercase",
  },
  title2: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    lineHeight: 19.5,
    color: "rgba(255,255,255,0.86)",
  },
  category3: {
    fontFamily: Fonts.extrabold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.accent,
    textTransform: "uppercase",
  },
  readTime: {
    fontFamily: Fonts.semibold,
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
  },
  title3: {
    fontFamily: Fonts.bold,
    fontSize: 16.5,
    lineHeight: 20.6,
    color: "#fff",
  },
  sources: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.5)",
  },
  accentLine: { height: 3, width: "100%" },

  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: { height: "100%", borderRadius: 1 },
});
