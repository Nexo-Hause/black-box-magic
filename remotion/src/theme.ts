import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "700", "800"],
  subsets: ["latin"],
});

export const FONT = fontFamily;

export const COLORS = {
  bgDark: "#0a0a12",
  bgCard: "rgba(255,255,255,0.04)",
  bgCardHover: "rgba(255,255,255,0.08)",
  accent: "#00d4aa",
  accentDim: "rgba(0,212,170,0.15)",
  danger: "#ff4757",
  dangerDim: "rgba(255,71,87,0.12)",
  text: "#e8e8f0",
  textMuted: "#6b6b80",
  border: "rgba(255,255,255,0.08)",
  white: "#ffffff",
} as const;

export const TIMING = {
  fps: 30,
  fadeFrames: 20,
  staggerDelay: 10,
  springSmooth: { damping: 200 },
  springSnappy: { damping: 20, stiffness: 200 },
} as const;
