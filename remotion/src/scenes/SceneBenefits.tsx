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
import { MetricCounter } from "../components/MetricCounter";
import { IconClock, IconCheck, IconChart } from "../components/icons";

// Duration: 600 frames (20s at 30fps)
// 3 benefit blocks in horizontal row
// Block 1 (qualitative): spring at delay 20
// Block 2 (100% counter): MetricCounter at delay 60
// Block 3 (qualitative): spring at delay 100

type QualitativeBlockProps = {
  icon: React.ReactNode;
  bigText: string;
  label: string;
  delay: number;
};

const QualitativeBlock: React.FC<QualitativeBlockProps> = ({
  icon,
  bigText,
  label,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const entrance = spring({
    frame: localFrame,
    fps,
    config: TIMING.springSmooth,
  });

  const y = interpolate(entrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        opacity: entrance,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ transform: `scale(${0.8 + entrance * 0.2})` }}>{icon}</div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 64,
          fontWeight: 800,
          color: COLORS.accent,
          lineHeight: 1,
        }}
      >
        {bigText}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 400,
          color: COLORS.textMuted,
          textAlign: "center",
          maxWidth: 280,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const SceneBenefits: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle accent gradient in background
  const gradientOpacity = interpolate(frame, [0, 60], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <FadeWrapper>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.bgDark,
          padding: 80,
        }}
      >
        {/* Subtle accent gradient overlay */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${COLORS.accentDim} 0%, transparent 100%)`,
            opacity: gradientOpacity,
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 80,
            width: "100%",
            maxWidth: 1200,
            position: "relative",
          }}
        >
          {/* Block 1: qualitative — speed */}
          <QualitativeBlock
            icon={<IconClock size={64} color={COLORS.accent} />}
            bigText="En segundos"
            label="Análisis instantáneo"
            delay={20}
          />

          {/* Block 2: quantitative — 100% counter */}
          <MetricCounter
            value={100}
            suffix="%"
            label="De las visitas documentadas"
            icon={<IconCheck size={64} color={COLORS.accent} />}
            delay={60}
            color={COLORS.accent}
          />

          {/* Block 3: qualitative — objectivity */}
          <QualitativeBlock
            icon={<IconChart size={64} color={COLORS.accent} />}
            bigText="Objetivos"
            label="Datos reales, no opiniones"
            delay={100}
          />
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
