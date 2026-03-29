import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TIMING } from "../theme";

type FadeWrapperProps = {
  children: React.ReactNode;
  fadeIn?: boolean;
  fadeOut?: boolean;
};

export const FadeWrapper: React.FC<FadeWrapperProps> = ({
  children,
  fadeIn = true,
  fadeOut = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const f = TIMING.fadeFrames;

  let opacity = 1;

  if (fadeIn) {
    const fadeInVal = interpolate(frame, [0, f], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    opacity *= fadeInVal;
  }

  if (fadeOut) {
    const fadeOutVal = interpolate(
      frame,
      [durationInFrames - f, durationInFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    opacity *= fadeOutVal;
  }

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
