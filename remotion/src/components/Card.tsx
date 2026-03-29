import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { FONT, COLORS, TIMING } from "../theme";

type CardProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  delay?: number;
  width?: number;
  accentColor?: string;
};

export const Card: React.FC<CardProps> = ({
  icon,
  title,
  description,
  delay = 0,
  width = 320,
  accentColor = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: TIMING.springSmooth,
  });

  const y = interpolate(entrance, [0, 1], [50, 0]);

  return (
    <div
      style={{
        opacity: entrance,
        transform: `translateY(${y}px)`,
        width,
        padding: "36px 28px",
        borderRadius: 16,
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {icon}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.white,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 17,
            fontWeight: 300,
            color: COLORS.textMuted,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
};
