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
import { Card } from "../components/Card";
import {
  IconCamera,
  IconBrain,
  IconDashboard,
  IconArrowRight,
} from "../components/icons";

// Duration: 600 frames (20s at 30fps)
// Title fade-in: 0-30
// Cards stagger: 40 frames between each, starting at frame 60
// Arrows appear after each card enters

const steps = [
  {
    Icon: IconCamera,
    title: "Una foto",
    description: "El operador toma una foto en el punto",
  },
  {
    Icon: IconBrain,
    title: "IA analiza",
    description: "La imagen se analiza en segundos",
  },
  {
    Icon: IconDashboard,
    title: "Reporte al instante",
    description: "Recibes un reporte estructurado",
  },
];

export const SceneSolution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FadeWrapper>
      <MediaBackground type="video" src="clips/scene-3.mp4" playbackRate={0.65} overlayOpacity={0.7} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: "transparent",
          padding: 100,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 64,
            width: "100%",
          }}
        >
          {/* Title */}
          <AnimatedText
            text="Ahora imagina esto"
            mode="fade"
            fontSize={56}
            fontWeight={700}
            color={COLORS.accent}
            delay={0}
            textAlign="center"
          />

          {/* Cards row with arrows */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
              width: "100%",
            }}
          >
            {steps.map((step, i) => {
              const cardDelay = 60 + i * 40;

              // Arrow appears after the card it follows
              const arrowDelay = cardDelay + 25;
              const arrowEntrance = spring({
                frame: Math.max(0, frame - arrowDelay),
                fps,
                config: TIMING.springSmooth,
              });
              const arrowScale = interpolate(arrowEntrance, [0, 1], [0.3, 1]);

              return (
                <React.Fragment key={i}>
                  <Card
                    icon={<step.Icon size={52} color={COLORS.accent} />}
                    title={step.title}
                    description={step.description}
                    delay={cardDelay}
                    width={300}
                    accentColor={COLORS.accent}
                  />

                  {i < steps.length - 1 && (
                    <div
                      style={{
                        opacity: arrowEntrance,
                        transform: `scale(${arrowScale})`,
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconArrowRight
                        size={36}
                        color={COLORS.accent}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </FadeWrapper>
  );
};
