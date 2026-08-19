/**
 * Single source of truth for font family names.
 *
 * IMPORTANT: @expo-google-fonts exports fonts with UNDERSCORE names
 * (Manrope_700Bold), not hyphenated ones (Manrope-Bold). The old code mixed
 * both, so every hyphenated style silently fell back to the system font.
 * Always reference fonts through this object.
 */
export const Fonts = {
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

export const Colors = {
  ink: "#0A0B0F",
  inkSoft: "#14161C",
  paper: "#FDFBF7",
  accent: "#FF7A2F",
  accentLight: "#FFD08A",
  accentMid: "#FFA544",
  accentDeep: "#C2560F",
  cool: "#4C6BFF",
  buttonText: "#2A1103",
  danger: "#FF6B6B",
  success: "#5BD98A",
} as const;
