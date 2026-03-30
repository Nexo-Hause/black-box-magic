import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { FONT, COLORS } from "../theme";
import { FadeWrapper } from "../components/FadeWrapper";
import { MediaBackground } from "../components/MediaBackground";
import { AnimatedText } from "../components/AnimatedText";
import { BIDashboard } from "../components/BIDashboard";

// Duration: 600 frames (20s at 30fps)
// Title fade-in: 0-30
// BIDashboard: delay 30
// Bottom message: fade at frame 200

export const SceneBI: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <FadeWrapper>
      <MediaBackground type="image" src="images/scene-6.png" kenBurns="pan-left" overlayOpacity={0.72} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40,
            width: "100%",
            maxWidth: 1200,
          }}
        >
          {/* Title */}
          <AnimatedText
            text="De fotos a decisiones"
            mode="fade"
            fontSize={52}
            fontWeight={700}
            color={COLORS.white}
            delay={0}
            textAlign="center"
          />

          {/* BI Dashboard */}
          <BIDashboard delay={30} />

          {/* Bottom message */}
          <div
            style={{
              fontFamily: FONT,
              fontSize: 26,
              fontWeight: 400,
              color: COLORS.textMuted,
              textAlign: "center",
              maxWidth: 800,
              lineHeight: 1.5,
              opacity: interpolate(frame, [200, 230], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(frame, [200, 230], [15, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            Toda la inteligencia de campo centralizada, comparable y accionable
          </div>
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
