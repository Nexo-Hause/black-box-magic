import React from "react";
import {
  AbsoluteFill,
  Img,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

type MediaBackgroundProps = {
  type: "video" | "image";
  src: string;
  overlayOpacity?: number;
  playbackRate?: number;
  kenBurns?: "zoom-in" | "zoom-out" | "pan-left" | "pan-right";
};

export const MediaBackground: React.FC<MediaBackgroundProps> = ({
  type,
  src,
  overlayOpacity = 0.7,
  playbackRate = 1,
  kenBurns = "zoom-in",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns animation for images
  const kbProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let imgTransform = "";
  switch (kenBurns) {
    case "zoom-in":
      imgTransform = `scale(${1 + kbProgress * 0.15})`;
      break;
    case "zoom-out":
      imgTransform = `scale(${1.15 - kbProgress * 0.15})`;
      break;
    case "pan-left":
      imgTransform = `scale(1.1) translateX(${-kbProgress * 5}%)`;
      break;
    case "pan-right":
      imgTransform = `scale(1.1) translateX(${kbProgress * 5}%)`;
      break;
  }

  return (
    <>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {type === "video" ? (
          <Video
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            muted
            playbackRate={playbackRate}
          />
        ) : (
          <Img
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: imgTransform,
            }}
          />
        )}
      </AbsoluteFill>
      {/* Dark overlay for text readability */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(10, 10, 18, ${overlayOpacity})`,
        }}
      />
    </>
  );
};
