import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { FONT, COLORS, TIMING } from "../theme";

type MetricCounterProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  icon: React.ReactNode;
  delay?: number;
  color?: string;
};

export const MetricCounter: React.FC<MetricCounterProps> = ({
  value,
  suffix = "",
  prefix = "",
  label,
  icon,
  delay = 0,
  color = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const entrance = spring({
    frame: localFrame,
    fps,
    config: TIMING.springSmooth,
  });

  const counterProgress = interpolate(localFrame, [10, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const displayValue = Math.floor(value * counterProgress);
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
          color,
          lineHeight: 1,
        }}
      >
        {prefix}
        {value > 0 ? displayValue : ""}
        {suffix}
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
