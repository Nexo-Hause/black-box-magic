import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { FONT, COLORS, TIMING } from "../theme";
import { FadeWrapper } from "../components/FadeWrapper";
import { AnimatedText } from "../components/AnimatedText";

// Duration: 360 frames (12s at 30fps)
// Line 1 typewriter: ~50 chars * 2 frames/char = 100 frames, starts at frame 20
// Line 2 typewriter: ~65 chars * 2 frames/char = 130 frames, starts at frame 150
// Emphasis fade-in: starts at frame 300

export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle radial gradient pulse
  const gradientSize = interpolate(frame, [0, 360], [40, 55], {
    extrapolateRight: "clamp",
  });

  return (
    <FadeWrapper>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: `radial-gradient(ellipse ${gradientSize}% ${gradientSize}% at 50% 50%, rgba(20, 20, 40, 1) 0%, ${COLORS.bgDark} 100%)`,
          padding: 120,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40,
            maxWidth: 1100,
          }}
        >
          {/* Line 1 */}
          <AnimatedText
            text="Tu equipo de campo visita decenas de puntos cada día."
            mode="typewriter"
            fontSize={48}
            fontWeight={400}
            color={COLORS.text}
            delay={20}
            charFrames={2}
            textAlign="center"
            lineHeight={1.4}
          />

          {/* Line 2 */}
          <AnimatedText
            text="¿Pero cuánta información se pierde entre la visita y el reporte?"
            mode="typewriter"
            fontSize={48}
            fontWeight={400}
            color={COLORS.text}
            delay={150}
            charFrames={2}
            textAlign="center"
            lineHeight={1.4}
          />

          {/* Emphasis line - fade in after both typewriter lines */}
          <div
            style={{
              marginTop: 24,
              opacity: interpolate(frame, [300, 330], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(frame, [300, 330], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 38,
                fontWeight: 700,
                color: COLORS.danger,
                textAlign: "center",
                lineHeight: 1.5,
                maxWidth: 900,
              }}
            >
              Gran parte de los hallazgos en campo nunca se documentan
              correctamente
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
