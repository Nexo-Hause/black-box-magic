import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { FONT, COLORS } from "../theme";
import { FadeWrapper } from "../components/FadeWrapper";
import { MediaBackground } from "../components/MediaBackground";

// Duration: 450 frames (15s at 30fps)
// "Black Box Magic" spring entrance with bounce: damping 12
// Pulsing glow via Math.sin on frame
// Tagline 1 (accent): fade at frame 30
// Tagline 2 (muted): fade at frame 50
// FadeWrapper handles fade-to-black at the end

export const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Main title spring with bouncy config
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 150 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.6, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Pulsing glow via Math.sin
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [8, 25]
  );
  const glowOpacity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.4, 0.8]
  );

  // Tagline 1 (accent)
  const tag1Opacity = interpolate(frame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tag1Y = interpolate(frame, [30, 55], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline 2 (muted)
  const tag2Opacity = interpolate(frame, [50, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tag2Y = interpolate(frame, [50, 75], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pill border opacity
  const pillOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <FadeWrapper>
      <MediaBackground type="video" src="clips/scene-8.mp4" playbackRate={0.35} overlayOpacity={0.65} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "transparent",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          {/* Main title with pulsing glow */}
          <div
            style={{
              fontFamily: FONT,
              fontSize: 88,
              fontWeight: 800,
              color: COLORS.white,
              textAlign: "center",
              lineHeight: 1.1,
              opacity: titleOpacity,
              transform: `scale(${titleScale})`,
              textShadow: `0 0 ${glowIntensity}px rgba(0, 212, 170, ${glowOpacity}), 0 0 ${glowIntensity * 2}px rgba(0, 212, 170, ${glowOpacity * 0.4})`,
            }}
          >
            Black Box Magic
          </div>

          {/* Tagline 1 — accent pill */}
          <div
            style={{
              opacity: tag1Opacity,
              transform: `translateY(${tag1Y}px)`,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 32,
                fontWeight: 400,
                color: COLORS.accent,
                textAlign: "center",
                lineHeight: 1.4,
                padding: "10px 32px",
                borderRadius: 100,
                border: `1px solid rgba(0, 212, 170, ${0.3 * pillOpacity})`,
                backgroundColor: `rgba(0, 212, 170, ${0.06 * pillOpacity})`,
              }}
            >
              Inteligencia artificial para tu fuerza de campo
            </div>
          </div>

          {/* Tagline 2 — muted */}
          <div
            style={{
              fontFamily: FONT,
              fontSize: 26,
              fontWeight: 400,
              color: COLORS.textMuted,
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: 700,
              opacity: tag2Opacity,
              transform: `translateY(${tag2Y}px)`,
            }}
          >
            Convierte cada visita en datos accionables
          </div>
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
