import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { FONT, COLORS, TIMING } from "../theme";
import { FadeWrapper } from "../components/FadeWrapper";
import { MediaBackground } from "../components/MediaBackground";
import { AnimatedText } from "../components/AnimatedText";
import { IconClipboard, IconClock, IconEye } from "../components/icons";

// Duration: 690 frames (23s at 30fps)
// Title fade-in: 0-30
// Pain points stagger: 60 frames between items, starting at frame 60

const painPoints = [
  {
    Icon: IconClipboard,
    text: "Reportes manuales que dependen de la memoria del operador",
  },
  {
    Icon: IconClock,
    text: "Horas entre la visita y el análisis de la información",
  },
  {
    Icon: IconEye,
    text: "Decisiones basadas en datos incompletos o subjetivos",
  },
];

export const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FadeWrapper>
      <MediaBackground type="image" src="images/scene-2.png" kenBurns="zoom-in" overlayOpacity={0.75} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: "transparent",
          padding: 120,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 56,
            width: "100%",
            maxWidth: 1200,
          }}
        >
          {/* Title */}
          <AnimatedText
            text="El problema"
            mode="fade"
            fontSize={56}
            fontWeight={700}
            color={COLORS.danger}
            delay={0}
            textAlign="left"
          />

          {/* Pain points */}
          {painPoints.map((point, i) => {
            const itemDelay = 60 + i * 60;

            const entrance = spring({
              frame: Math.max(0, frame - itemDelay),
              fps,
              config: TIMING.springSnappy,
            });

            const x = interpolate(entrance, [0, 1], [-40, 0]);
            const opacity = interpolate(entrance, [0, 1], [0, 1]);

            // Subtle glow behind the icon
            const glowOpacity = interpolate(
              entrance,
              [0.5, 1],
              [0, 0.3],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 32,
                  opacity,
                  transform: `translateX(${x}px)`,
                }}
              >
                {/* Icon container with glow */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 72,
                    height: 72,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      backgroundColor: COLORS.dangerDim,
                      opacity: glowOpacity,
                    }}
                  />
                  <point.Icon size={40} color={COLORS.danger} />
                </div>

                {/* Text */}
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 36,
                    fontWeight: 400,
                    color: COLORS.text,
                    lineHeight: 1.4,
                  }}
                >
                  {point.text}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
