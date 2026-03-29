import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { FONT, COLORS } from "../theme";

type AnimatedTextProps = {
  text: string;
  mode?: "typewriter" | "fade";
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  delay?: number;
  charFrames?: number;
  textAlign?: "left" | "center" | "right";
  maxWidth?: number;
  lineHeight?: number;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  mode = "fade",
  fontSize = 32,
  fontWeight = 400,
  color = COLORS.text,
  delay = 0,
  charFrames = 2,
  textAlign = "center",
  maxWidth,
  lineHeight = 1.4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  if (mode === "typewriter") {
    const typedChars = Math.min(
      Math.floor(localFrame / charFrames),
      text.length
    );
    const displayText = text.slice(0, typedChars);
    const cursorVisible =
      Math.floor(localFrame / 16) % 2 === 0 || typedChars < text.length;

    return (
      <div
        style={{
          fontFamily: FONT,
          fontSize,
          fontWeight,
          color,
          textAlign,
          maxWidth,
          lineHeight,
        }}
      >
        {displayText}
        <span
          style={{
            opacity: cursorVisible ? 1 : 0,
            color: COLORS.accent,
            marginLeft: 2,
          }}
        >
          {"\u258C"}
        </span>
      </div>
    );
  }

  // Fade mode
  const opacity = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(localFrame, [0, 20], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize,
        fontWeight,
        color,
        textAlign,
        maxWidth,
        lineHeight,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {text}
    </div>
  );
};
