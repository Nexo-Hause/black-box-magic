import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { FONT, COLORS, TIMING } from "../theme";

export const BIDashboard: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lf = Math.max(0, frame - delay);

  const panelEntrance = spring({
    frame: lf,
    fps,
    config: TIMING.springSmooth,
  });

  // Bar chart data (cumplimiento por zona)
  const bars = [
    { label: "Norte", value: 0.88, color: COLORS.accent },
    { label: "Centro", value: 0.72, color: "#2196f3" },
    { label: "Sur", value: 0.95, color: COLORS.accent },
    { label: "Oeste", value: 0.61, color: "#ff9800" },
  ];

  const barGrow = interpolate(lf, [15, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Trend line (SVG path drawn with stroke-dashoffset)
  const trendDraw = interpolate(lf, [30, 65], [200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Circular indicators
  const circleProgress = interpolate(lf, [45, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelY = interpolate(panelEntrance, [0, 1], [30, 0]);

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        opacity: panelEntrance,
        transform: `translateY(${panelY}px)`,
        width: "100%",
        maxWidth: 1100,
      }}
    >
      {/* Bar Chart */}
      <div
        style={{
          flex: 1,
          padding: 24,
          borderRadius: 12,
          backgroundColor: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.textMuted,
            marginBottom: 20,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Cumplimiento por zona
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 100, marginTop: 16 }}>
          {bars.map((bar, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
              <div
                style={{
                  width: "100%",
                  height: 100 * bar.value * barGrow,
                  backgroundColor: bar.color,
                  borderRadius: "4px 4px 0 0",
                  opacity: 0.85,
                  position: "relative",
                }}
              />
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 700,
                  color: bar.color,
                  opacity: barGrow > 0.5 ? 1 : 0,
                  marginTop: 4,
                }}
              >
                {Math.round(bar.value * 100)}%
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.textMuted }}>{bar.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Line */}
      <div
        style={{
          flex: 1,
          padding: 24,
          borderRadius: 12,
          backgroundColor: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.textMuted,
            marginBottom: 20,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Tendencia semanal
        </div>
        <svg viewBox="0 0 200 120" style={{ width: "100%", height: 140 }}>
          <path
            d="M10,100 Q40,90 60,70 T110,50 T160,30 T190,20"
            fill="none"
            stroke={COLORS.accent}
            strokeWidth="2.5"
            strokeDasharray="200"
            strokeDashoffset={trendDraw}
            strokeLinecap="round"
          />
          {/* Grid lines */}
          {[25, 50, 75, 100].map((y) => (
            <line key={y} x1="10" y1={y} x2="190" y2={y} stroke={COLORS.border} strokeWidth="0.5" />
          ))}
        </svg>
      </div>

      {/* Circular Indicators */}
      <div
        style={{
          flex: 0.8,
          padding: 24,
          borderRadius: 12,
          backgroundColor: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Indicadores
        </div>
        {[
          { label: "Cobertura", value: 94, color: COLORS.accent },
          { label: "Calidad", value: 87, color: "#2196f3" },
        ].map((ind, i) => {
          const circumference = 2 * Math.PI * 28;
          const offset = circumference * (1 - (ind.value / 100) * circleProgress);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="68" height="68" viewBox="0 0 68 68">
                <circle cx="34" cy="34" r="28" fill="none" stroke={COLORS.border} strokeWidth="4" />
                <circle
                  cx="34"
                  cy="34"
                  r="28"
                  fill="none"
                  stroke={ind.color}
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 34 34)"
                />
                <text
                  x="34"
                  y="38"
                  textAnchor="middle"
                  fill={COLORS.text}
                  fontSize="14"
                  fontWeight="700"
                  fontFamily={FONT}
                >
                  {Math.round(ind.value * circleProgress)}%
                </text>
              </svg>
              <span style={{ fontFamily: FONT, fontSize: 14, color: COLORS.textMuted }}>
                {ind.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
