import { Colors, Fonts } from "@/constants/onboarding-theme";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground } from "./ambient-background";
import { AuthSheet } from "./auth-sheet";
import { GetStartedButton } from "./get-started-button";
import { tapLight } from "./haptics";
import StoryCards from "./story-cards";

/** Pixels to raise the card stack from centred. Increase to move it higher. */
const CARDS_LIFT = 90;

const STORY_TOTAL = 42;
const COUNT_MS = 8000;
const COUNT_STEP_MS = 45;

/**
 * Counts up to the total on mount.
 *
 * State starts AT the total, not 0 — if the effect never runs (reduced motion,
 * or a Fast Refresh that skips it) the pill still shows the right number rather
 * than a permanent zero. The count-down to 0 happens inside the effect.
 *
 * Isolated + memo'd because it re-renders ~20 times in the first second, and
 * the whole landing page must not re-render with it.
 */
const StoryCount = memo(function StoryCount() {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(STORY_TOTAL);

  useEffect(() => {
    if (reducedMotion) return;
    setShown(0);
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / COUNT_MS, 1);
      // Ease-out so it decelerates into the final number.
      setShown(Math.round((1 - (1 - p) ** 3) * STORY_TOTAL));
      if (p >= 1) clearInterval(id);
    }, COUNT_STEP_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return <Text style={styles.pillText}>Today in India · {shown} stories</Text>;
});

export default function LandingScreen() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * Declarative one-shot entrances. Nothing here depends on an effect firing,
   * so a stalled animation can't leave an element invisible — and reduced
   * motion just renders the final state immediately.
   */
  const enter = (delay: number) =>
    reducedMotion ? undefined : FadeInDown.delay(delay).springify().damping(16);

  // present() on a modal — the sheet is not mounted until this fires.
  const openAuth = useCallback(() => {
    setSheetOpen(true);
    sheetRef.current?.present();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/landing.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        contentPosition="top"
      />
      <View style={{ ...StyleSheet.absoluteFillObject, opacity: 0.3 }}>
        <AmbientBackground />
      </View>

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 },
        ]}
      >
        {/* Status pill */}
        <Animated.View style={styles.topBar} entering={enter(60)}>
          <View style={styles.pill}>
            <View style={styles.dot} />
            <StoryCount />
          </View>
        </Animated.View>

        {/* Floating stack — no horizontal padding here so the widest card
            isn't squeezed by the screen gutter. */}
        <View style={styles.cardsArea}>
          <StoryCards paused={sheetOpen} />
        </View>

        <View style={styles.bottomArea}>
          <Animated.Text style={styles.title} entering={enter(480)}>
            Prakash Daily
          </Animated.Text>

          <Animated.Text style={styles.subtitle} entering={enter(560)}>
            Your news. Your people.{"\n"}Curated for you, not the crowd.
          </Animated.Text>

          {/* Wrapper carries the entrance so the button's own sheen transform
              isn't fighting a layout animation on the same view. */}
          <Animated.View style={styles.buttonEnter} entering={enter(640)}>
            <GetStartedButton onPress={openAuth} paused={sheetOpen} />
          </Animated.View>

          <Animated.View style={styles.signInRow} entering={enter(730)}>
            <Text style={styles.alreadyText}>Already have an account?</Text>
            <Pressable
              onPress={() => {
                tapLight();
                openAuth();
              }}
              hitSlop={8}
            >
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <AuthSheet ref={sheetRef} onDismiss={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ink,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    alignItems: "center",
    paddingHorizontal: 26,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
    paddingLeft: 11,
    paddingRight: 15,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.accent,
    // shadow* props go through Fabric's box-shadow path on Android; keep the
    // platform on plain elevation instead.
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      default: { elevation: 4 },
    }),
  },
  pillText: {
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.82)",
    textTransform: "uppercase",
  },
  cardsArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // translateY rather than padding/margin: shifts the stack without
    // resizing its box, so the tilt, stacking and spacing stay identical.
    transform: [{ translateY: -CARDS_LIFT }],
  },
  bottomArea: {
    alignItems: "center",
    paddingHorizontal: 26,
    paddingBottom: 16,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 52,
    lineHeight: 58,
    color: Colors.paper,
    textAlign: "center",
    // Paint.setShadowLayer with a large radius is the classic trigger for a
    // forced software layer on Android. Keep the big blur to iOS.
    ...Platform.select({
      ios: {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 8 },
        textShadowRadius: 40,
      },
      default: {},
    }),
  },
  subtitle: {
    fontFamily: Fonts.medium,
    marginTop: 12,
    maxWidth: 300,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22.5,
    color: "rgba(253,251,247,0.68)",
  },
  buttonEnter: {
    width: "100%",
  },
  signInRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alreadyText: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: "rgba(253,251,247,0.5)",
  },
  signInText: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    color: Colors.paper,
    textDecorationLine: "underline",
  },
});
