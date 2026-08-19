import { Colors } from "@/constants/onboarding-theme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";

/**
 * Why this doesn't use react-native-svg:
 *
 * SvgView on Android renders the SVG tree into an offscreen Bitmap and then
 * blits it with Canvas.drawBitmap. If that bitmap is hardware-backed and the
 * destination canvas is software, Android throws
 * "Software rendering doesn't support hardware bitmaps".
 *
 * Everything here is plain Views + expo-linear-gradient, which are ordinary
 * hardware-accelerated draw calls with no bitmap round-trip.
 */

/**
 * Each ring is a translucent circle drawn on top of the last, so this is pure
 * GPU overdraw — and it repaints every frame while anything above it animates
 * (the sheet, its backdrop). Three glows at 16 rings was enough fill cost to
 * make the sheet transition stutter on mid-range Android. 10 keeps the falloff
 * smooth at a third less cost.
 */
const RINGS = 10;

type GlowProps = {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  /** Approximate alpha at the centre of the glow. */
  strength?: number;
};

/**
 * A radial glow built from concentric translucent circles. Overlapping alpha
 * accumulates toward the centre, which reads as a soft falloff.
 */
function Glow({ cx, cy, radius, color, strength = 0.3 }: GlowProps) {
  const size = radius * 2;
  // Solve for the per-ring alpha that accumulates to `strength` over RINGS layers.
  const perRing = 1 - Math.pow(1 - strength, 1 / RINGS);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cx - radius,
        top: cy - radius,
        width: size,
        height: size,
      }}
    >
      {Array.from({ length: RINGS }, (_, i) => {
        // Exponent < 1 packs rings toward the outside for a gentler edge.
        const d = size * Math.pow(1 - i / RINGS, 0.75);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: radius - d / 2,
              top: radius - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              opacity: perRing,
            }}
          />
        );
      })}
    </View>
  );
}

type AmbientBackgroundProps = {
  /**
   * Optional full-bleed hero art, e.g. require('../assets/images/hero.jpg').
   * When set, the gradient becomes a scrim over the photo and the glows dial
   * back so they tint rather than dominate.
   *
   * Use react-native's Image here, not expo-image: Glide decodes to
   * hardware-backed bitmaps, which is what makes Android blur libraries throw
   * "Software rendering doesn't support hardware bitmaps".
   */
  source?: ImageSourcePropType;
};

export function AmbientBackground({ source }: AmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const hasImage = !!source;

  return (
    <View style={styles.root} pointerEvents="none">
      {hasImage && (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}

      {/* Without art this IS the background. With art it's the legibility scrim. */}
      <LinearGradient
        colors={
          hasImage
            ? [
                "rgba(10,11,15,0.35)",
                "rgba(10,11,15,0.72)",
                "rgba(10,11,15,0.96)",
              ]
            : ["#211D2C", "#131420", "#0A0B0F"]
        }
        locations={hasImage ? [0, 0.5, 1] : [0, 0.45, 1]}
        start={hasImage ? { x: 0.5, y: 0 } : { x: 0.25, y: 0 }}
        end={hasImage ? { x: 0.5, y: 1 } : { x: 0.75, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Warm glow bleeding in from the left edge */}
      <Glow
        cx={-40}
        cy={150}
        radius={240}
        color={Colors.accent}
        strength={hasImage ? 0.16 : 0.3}
      />
      {/* Cool glow from the top-right corner */}
      <Glow
        cx={width + 70}
        cy={-10}
        radius={200}
        color={Colors.cool}
        strength={hasImage ? 0.12 : 0.22}
      />
      {/* Faint lift behind the card stack */}
      <Glow
        cx={width * 0.52}
        cy={height * 0.3}
        radius={210}
        color={Colors.accent}
        strength={hasImage ? 0.07 : 0.14}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    // Keeps the off-screen glows from affecting layout.
    overflow: "hidden",
    backgroundColor: Colors.ink,
  },
});
