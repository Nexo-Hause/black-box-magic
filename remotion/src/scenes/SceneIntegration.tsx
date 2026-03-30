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
import { IconPhone, IconBrain, IconDashboard, IconArrowDown } from "../components/icons";

// Duration: 900 frames (30s at 30fps)
// Title fade-in: 0-30
// Level 1 (bottom): spring at frame 60
// Arrow 1: fade at frame 150
// Level 2 (middle): spring at frame 180
// Arrow 2: fade at frame 270
// Level 3 (top): spring at frame 300
// Emphasis texts: fade at frame 420

type LevelData = {
  icon: React.ReactNode;
  title: string;
  description: string;
  startFrame: number;
};

const levels: LevelData[] = [
  {
    icon: <IconPhone size={40} color={COLORS.accent} />,
    title: "Evidence",
    description: "El operador toma foto como parte de su ruta normal",
    startFrame: 60,
  },
  {
    icon: <IconBrain size={40} color={COLORS.accent} />,
    title: "Análisis automático",
    description: "Resultados en tiempo real",
    startFrame: 180,
  },
  {
    icon: <IconDashboard size={40} color={COLORS.accent} />,
    title: "BI de Evidence",
    description: "Dashboards, reportes, tendencias",
    startFrame: 300,
  },
];

const arrowFrames = [150, 270];

export const SceneIntegration: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FadeWrapper>
      <MediaBackground type="image" src="images/scene-5.png" kenBurns="zoom-out" overlayOpacity={0.78} />
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
            gap: 0,
            width: "100%",
            maxWidth: 1100,
          }}
        >
          {/* Title */}
          <AnimatedText
            text="Integrado con tu operación"
            mode="fade"
            fontSize={52}
            fontWeight={700}
            color={COLORS.accent}
            delay={0}
            textAlign="center"
          />

          {/* Vertical diagram — rendered top-to-bottom in DOM but levels appear bottom-to-top */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
              marginTop: 50,
            }}
          >
            {/* Level 3 (top — appears last at frame 300) */}
            {renderLevel(levels[2], frame, fps)}

            {/* Arrow 2 (appears at frame 270) */}
            {renderArrow(arrowFrames[1], frame, fps, true)}

            {/* Level 2 (middle — appears at frame 180) */}
            {renderLevel(levels[1], frame, fps)}

            {/* Arrow 1 (appears at frame 150) */}
            {renderArrow(arrowFrames[0], frame, fps, true)}

            {/* Level 1 (bottom — appears first at frame 60) */}
            {renderLevel(levels[0], frame, fps)}
          </div>

          {/* Emphasis texts */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              marginTop: 48,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 26,
                fontWeight: 400,
                color: COLORS.text,
                textAlign: "center",
                opacity: interpolate(frame, [420, 450], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(frame, [420, 450], [15, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
              }}
            >
              Sin cambiar el flujo de trabajo de tu equipo
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 26,
                fontWeight: 400,
                color: COLORS.accent,
                textAlign: "center",
                opacity: interpolate(frame, [450, 480], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(frame, [450, 480], [15, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px)`,
              }}
            >
              Resultados listos en tu BI, no en otro sistema
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};

function renderLevel(level: LevelData, frame: number, fps: number) {
  const entrance = spring({
    frame: Math.max(0, frame - level.startFrame),
    fps,
    config: TIMING.springSmooth,
  });
  const y = interpolate(entrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        width: 600,
        padding: "20px 28px",
        borderRadius: 14,
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        opacity: entrance,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: 12,
          backgroundColor: COLORS.accentDim,
        }}
      >
        {level.icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          {level.title}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 400,
            color: COLORS.textMuted,
            lineHeight: 1.3,
          }}
        >
          {level.description}
        </div>
      </div>
    </div>
  );
}

function renderArrow(
  startFrame: number,
  frame: number,
  fps: number,
  pointsUp: boolean
) {
  const entrance = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: TIMING.springSnappy,
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 48,
        opacity: entrance,
        transform: `scale(${interpolate(entrance, [0, 1], [0.5, 1])})`,
      }}
    >
      <div style={{ transform: pointsUp ? "rotate(180deg)" : "none" }}>
        <IconArrowDown size={32} color={COLORS.accent} />
      </div>
    </div>
  );
}
