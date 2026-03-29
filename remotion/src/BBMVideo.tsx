import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { COLORS } from "./theme";
import { SceneHook } from "./scenes/SceneHook";
import { SceneProblem } from "./scenes/SceneProblem";
import { SceneSolution } from "./scenes/SceneSolution";
import { SceneAnalysis } from "./scenes/SceneAnalysis";
import { SceneIntegration } from "./scenes/SceneIntegration";
import { SceneBI } from "./scenes/SceneBI";
import { SceneBenefits } from "./scenes/SceneBenefits";
import { SceneCTA } from "./scenes/SceneCTA";

// Total: 3900 frames = 130 seconds = 2:10
//
// Durations based on animation end + reading buffer.
// No dead air — each scene ends shortly after content is readable.
//
// Scene 1 — Hook:          0 -  420  (14s)  last anim 330 + read
// Scene 2 — Problem:     420 -  870  (15s)  last anim 210 + read 3 items
// Scene 3 — Solution:    870 - 1230  (12s)  last anim 170 + read 3 cards
// Scene 4 — Analysis:   1230 - 1830  (20s)  last anim 340 + read 6 items
// Scene 5 — Integration: 1830 - 2490 (22s)  last anim 480 + read diagram
// Scene 6 — BI:          2490 - 2880 (13s)  last anim 230 + read dashboard
// Scene 7 — Benefits:    2880 - 3270 (13s)  last anim 130 + read 3 metrics
// Scene 8 — CTA:         3270 - 3900 (21s)  last anim 80 + hold for impact

export const BBMVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Music volume: low, fades in at start and out at end
  const musicVolume = interpolate(
    frame,
    [0, 30, durationInFrames - 60, durationInFrames],
    [0, 0.12, 0.12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Voiceover volume: full, fades in gently
  const voiceVolume = interpolate(
    frame,
    [0, 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Background music — loops if shorter than video */}
      <Audio src={staticFile("music.mp3")} volume={musicVolume} loop />

      {/* Voiceover narration */}
      <Audio src={staticFile("voiceover.wav")} volume={voiceVolume} />

      <Sequence from={0} durationInFrames={420}>
        <SceneHook />
      </Sequence>

      <Sequence from={420} durationInFrames={450}>
        <SceneProblem />
      </Sequence>

      <Sequence from={870} durationInFrames={360}>
        <SceneSolution />
      </Sequence>

      <Sequence from={1230} durationInFrames={600}>
        <SceneAnalysis />
      </Sequence>

      <Sequence from={1830} durationInFrames={660}>
        <SceneIntegration />
      </Sequence>

      <Sequence from={2490} durationInFrames={390}>
        <SceneBI />
      </Sequence>

      <Sequence from={2880} durationInFrames={390}>
        <SceneBenefits />
      </Sequence>

      <Sequence from={3270} durationInFrames={630}>
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
