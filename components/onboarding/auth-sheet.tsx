import { Colors, Fonts } from "@/constants/onboarding-theme";
import { checkEmail } from "@/lib/validate-email";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  forwardRef,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView } from "./glass-view";
import { tapLight, tapMedium, tapSelection } from "./haptics";

type Method = "email" | "google" | "ig";

export type AuthSheetProps = {
  onDismiss?: () => void;
};

/** Module scope: an inline component type remounts the background every render. */
const SheetBackground: React.FC<BottomSheetBackgroundProps> = ({ style }) => (
  <View style={[style, styles.backgroundContainer]}>
    <GlassView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["rgba(30,31,40,0.94)", "rgba(14,15,20,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
    </GlassView>
    <View style={styles.topBorder} />
  </View>
);

/* ------------------------------------------------------------------ *
 * Email form — isolated so keystrokes re-render ONLY this subtree.
 * ------------------------------------------------------------------ */

type EmailFormProps = {
  busy: boolean;
  locked: boolean;
  onSubmit: (email: string) => void;
};

const EmailForm = memo(function EmailForm({
  busy,
  locked,
  onSubmit,
}: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [blurred, setBlurred] = useState(false);
  /**
   * Only updated once typing pauses. Deriving the "has the user settled"
   * signal from a debounced copy of the text costs one extra render per pause
   * instead of one per keystroke.
   */
  const [paused, setPaused] = useState("");

  useEffect(() => {
    if (!email) {
      setPaused("");
      return;
    }
    const t = setTimeout(() => setPaused(email), 550);
    return () => clearTimeout(t);
  }, [email]);

  /**
   * Validation reads a DEFERRED copy of the text.
   *
   * The keystroke render (just the input's own value) stays urgent, while the
   * validation pass and everything it drives — border colour, button gradient,
   * feedback line — renders at low priority. Without this, React has to finish
   * all of it before the next character can paint, which is what made typing
   * stall and then flush several characters at once.
   */
  const deferred = useDeferredValue(email);
  const check = useMemo(() => checkEmail(deferred), [deferred]);
  const valid = check.state === "valid";
  const suggestion = check.state === "valid" ? check.suggestion : undefined;

  // Validity gates the button instantly; the message waits for a pause or blur.
  const showProblem =
    check.state === "invalid" && (blurred || paused === email);
  const ready = valid && !locked;

  const submit = useCallback(() => {
    if (!valid || locked) return;
    tapMedium();
    onSubmit(check.state === "valid" ? check.normalized : email);
  }, [valid, locked, onSubmit, check, email]);

  return (
    <View>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          valid && styles.inputWrapValid,
          showProblem && styles.inputWrapError,
        ]}
      >
        {/*
          BottomSheetTextInput, not TextInput — the sheet needs to know about
          focus to run its keyboard handling.

          autoComplete / textContentType are deliberately off: Android's
          autofill framework was popping a suggestion overlay and injecting
          text mid-typing. Set autoComplete="email" if you want it back.
        */}
        <BottomSheetTextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setBlurred(true);
          }}
          onSubmitEditing={submit}
          placeholder="you@gmail.com"
          placeholderTextColor="rgba(253,251,247,0.28)"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          returnKeyType="go"
          submitBehavior="submit"
          multiline={false}
          // Stops Android opening its fullscreen text editor, which steals the
          // input and dumps the text back on close.
          disableFullscreenUI
          editable={!locked}
          selectionColor={Colors.accent}
        />
      </View>

      {/* Exactly one feedback line, in a fixed-height row so the button below
          it never shifts as the message changes */}
      <View style={styles.feedbackRow}>
        {showProblem ? (
          <Text style={styles.problem}>{check.message}</Text>
        ) : suggestion ? (
          <Pressable
            onPress={() => {
              tapSelection();
              setEmail(suggestion);
            }}
            hitSlop={6}
          >
            <Text style={styles.suggestText}>
              Did you mean <Text style={styles.suggestValue}>{suggestion}</Text>
              ?
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.helper}>
            We&apos;ll send a 6-digit code to confirm it&apos;s you.
          </Text>
        )}
      </View>

      <Pressable
        onPress={submit}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        style={({ pressed }) => [
          styles.primary,
          !valid && styles.primaryDisabled,
          pressed && ready && styles.primaryPressed,
        ]}
      >
        {valid && (
          <LinearGradient
            colors={[Colors.accentLight, Colors.accentMid, Colors.accent]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {busy ? (
          <ActivityIndicator size="small" color={Colors.buttonText} />
        ) : (
          <Text
            style={[styles.primaryText, !valid && styles.primaryTextDisabled]}
          >
            Continue
          </Text>
        )}
      </Pressable>
    </View>
  );
});

/* ------------------------------------------------------------------ */

type SocialButtonProps = {
  mark: string;
  label: string;
  variant: "light" | "dark";
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
};

function SocialButton({
  mark,
  label,
  variant,
  busy,
  disabled,
  onPress,
}: SocialButtonProps) {
  const light = variant === "light";
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
      style={({ pressed }) => [
        styles.social,
        light ? styles.socialLight : styles.socialDark,
        pressed && styles.socialPressed,
        disabled && !busy && styles.socialDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={light ? Colors.inkSoft : Colors.paper}
        />
      ) : (
        <>
          {/* Placeholder marks — swap for the official brand assets before shipping. */}
          <View
            style={[styles.mark, light ? styles.markLight : styles.markDark]}
          >
            <Text
              style={[
                styles.markText,
                light ? styles.markTextLight : styles.markTextDark,
              ]}
            >
              {mark}
            </Text>
          </View>
          <Text
            style={[
              styles.socialLabel,
              light ? styles.socialLabelLight : styles.socialLabelDark,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export const AuthSheet = forwardRef<BottomSheetModal, AuthSheetProps>(
  ({ onDismiss }, ref) => {
    const innerRef = useRef<BottomSheetModal>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const insets = useSafeAreaInsets();
    const [busy, setBusy] = useState<Method | null>(null);

    useImperativeHandle(ref, () => innerRef.current as BottomSheetModal, []);

    /**
     * Fixed snap point rather than enableDynamicSizing.
     *
     * Dynamic sizing re-measures the content whenever it changes — and with a
     * focused text input plus adjustResize, the keyboard opening triggers a
     * measure/resize cycle that shows up as stuttering while typing. A fixed
     * height removes the loop entirely. Adjust this one percentage if the sheet
     * sits too high or low on your device.
     */
    const snapPoints = useMemo(() => ["64%"], []);

    const animationConfigs = useBottomSheetTimingConfigs({
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });

    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      [],
    );

    const start = useCallback((method: Method) => {
      setBusy(method);
      timer.current = setTimeout(() => setBusy(null), 2200);
    }, []);

    const onEmailSubmit = useCallback(
      (_email: string) => {
        // TODO: request the OTP for `_email`, then advance to the code step.
        start("email");
      },
      [start],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.68}
          pressBehavior="close"
        />
      ),
      [],
    );

    const locked = busy !== null;

    return (
      <BottomSheetModal
        ref={innerRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        animationConfigs={animationConfigs}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundComponent={SheetBackground}
        handleIndicatorStyle={styles.indicator}
        onDismiss={onDismiss}
      >
        <BottomSheetView
          style={[styles.content, { paddingBottom: insets.bottom + 18 }]}
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>प</Text>
            </View>
            <Text style={styles.title}>Sign Up for Prakash</Text>
            <Text style={styles.subtitle}>
              We&apos;ll remember your profile and preferences.
            </Text>
          </View>

          <EmailForm
            busy={busy === "email"}
            locked={locked}
            onSubmit={onEmailSubmit}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.socialLead}>Sign up with</Text>

          <View style={styles.socialRow}>
            <SocialButton
              mark="G"
              label="Google"
              variant="light"
              busy={busy === "google"}
              disabled={locked}
              onPress={() => start("google")}
            />
            <SocialButton
              mark="IG"
              label="Instagram"
              variant="dark"
              busy={busy === "ig"}
              disabled={locked}
              onPress={() => start("ig")}
            />
          </View>

          {/* Explicit spacer rather than marginTop:'auto' — reliable regardless of
            how BottomSheetView resolves its own height. */}
          <View style={styles.spacer} />

          <Text style={styles.terms}>
            By continuing you agree to our{" "}
            <Text style={styles.link}>Terms</Text> and{" "}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

AuthSheet.displayName = "AuthSheet";

const styles = StyleSheet.create({
  backgroundContainer: {
    overflow: "hidden",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  topBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  indicator: {
    backgroundColor: "rgba(255,255,255,0.22)",
    width: 38,
    height: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 6,
  },

  header: {
    alignItems: "center",
    marginBottom: 22,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  logoText: {
    fontFamily: Fonts.serif,
    fontSize: 23,
    lineHeight: 28,
    color: Colors.accent,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 27,
    lineHeight: 33,
    color: Colors.paper,
    marginTop: 10,
  },
  subtitle: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(253,251,247,0.5)",
    textAlign: "center",
    maxWidth: 290,
    marginTop: 5,
  },

  inputWrap: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.055)",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  inputWrapFocused: {
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  inputWrapValid: {
    borderColor: "rgba(91,217,138,0.5)",
  },
  inputWrapError: {
    borderColor: "rgba(255,107,107,0.55)",
  },
  input: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.paper,
    padding: 0,
  },

  primary: {
    height: 52,
    // Narrower than the field and centred, so it reads as the single action
    // rather than a second full-width block.
    width: "74%",
    alignSelf: "center",
    borderRadius: 14,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryDisabled: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  primaryPressed: {
    opacity: 0.9,
  },
  primaryText: {
    fontFamily: Fonts.extrabold,
    fontSize: 15.5,
    letterSpacing: 0.2,
    color: Colors.buttonText,
  },
  primaryTextDisabled: {
    color: "rgba(253,251,247,0.32)",
  },

  feedbackRow: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  helper: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(253,251,247,0.34)",
  },
  problem: {
    fontFamily: Fonts.semibold,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.danger,
  },
  suggestText: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(253,251,247,0.45)",
  },
  suggestValue: {
    fontFamily: Fonts.bold,
    color: Colors.accent,
    textDecorationLine: "underline",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    marginBottom: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  orText: {
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.32)",
  },

  socialLead: {
    fontFamily: Fonts.semibold,
    fontSize: 12.5,
    textAlign: "center",
    color: "rgba(253,251,247,0.46)",
    marginBottom: 12,
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  social: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
  },
  socialLight: {
    backgroundColor: "#F1F0EE",
    borderColor: "rgba(0,0,0,0.06)",
  },
  socialDark: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  socialPressed: {
    opacity: 0.75,
  },
  socialDisabled: {
    opacity: 0.4,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  markLight: {
    backgroundColor: "#E7E4DF",
    borderColor: "#C7C3BC",
  },
  markDark: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.34)",
  },
  markText: {
    fontFamily: Fonts.extrabold,
    fontSize: 9.5,
  },
  markTextLight: { color: "#8A857D" },
  markTextDark: { color: "rgba(255,255,255,0.66)" },
  socialLabel: {
    fontFamily: Fonts.bold,
    fontSize: 14.5,
  },
  socialLabelLight: { color: Colors.inkSoft },
  socialLabelDark: { color: Colors.paper },

  spacer: {
    flex: 1,
    minHeight: 14,
  },
  terms: {
    textAlign: "center",
    fontFamily: Fonts.medium,
    fontSize: 11,
    lineHeight: 17,
    color: "rgba(253,251,247,0.32)",
  },
  link: {
    color: "rgba(253,251,247,0.55)",
    textDecorationLine: "underline",
  },
});
