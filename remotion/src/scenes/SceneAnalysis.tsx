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
import { AnimatedText } from "../components/AnimatedText";
import {
  IconChart,
  IconShield,
  IconStore,
  IconTag,
  IconLightbulb,
} from "../components/icons";

// Duration: 900 frames (30s at 30fps)
// Title fade-in: 0-30
// Grid items stagger: 50 frames between each, starting at frame 60
// 2x3 grid layout

const analysisItems = [
  { Icon: IconChart, text: "Inventario y productos detectados" },
  { Icon: IconShield, text: "Cumplimiento de planograma y materiales POP" },
  { Icon: IconChart, text: "Participación de marca (share of shelf)" },
  { Icon: IconStore, text: "Condición del punto de venta" },
  { Icon: IconTag, text: "Precios visibles" },
  { Icon: IconLightbulb, text: "Oportunidades de mejora" },
];

export const SceneAnalysis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FadeWrapper>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: `linear-gradient(180deg, ${COLORS.bgDark} 0%, #0d0d1a 100%)`,
          padding: 100,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 60,
            width: "100%",
            maxWidth: 1200,
          }}
        >
          {/* Title */}
          <AnimatedText
            text="¿Qué analiza?"
            mode="fade"
            fontSize={56}
            fontWeight={700}
            color={COLORS.white}
            delay={0}
            textAlign="center"
          />

          {/* 2x3 Grid */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 32,
              width: "100%",
            }}
          >
            {analysisItems.map((item, i) => {
              const itemDelay = 60 + i * 50;

              const entrance = spring({
                frame: Math.max(0, frame - itemDelay),
                fps,
                config: TIMING.springSmooth,
              });

              const y = interpolate(entrance, [0, 1], [40, 0]);

              // Icon color cycles between accent and a lighter variant
              const iconColor = COLORS.accent;

              return (
                <div
                  key={i}
                  style={{
                    opacity: entrance,
                    transform: `translateY(${y}px)`,
                    width: 340,
                    padding: "36px 28px",
                    borderRadius: 16,
                    backgroundColor: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 18,
                  }}
                >
                  {/* Icon with subtle glow */}
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        backgroundColor: COLORS.accentDim,
                        opacity: interpolate(entrance, [0.5, 1], [0, 0.5], {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        }),
                      }}
                    />
                    <item.Icon size={44} color={iconColor} />
                  </div>

                  {/* Text */}
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 22,
                      fontWeight: 400,
                      color: COLORS.text,
                      textAlign: "center",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
