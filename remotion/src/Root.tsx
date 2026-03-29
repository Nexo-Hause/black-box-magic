import { Composition } from "remotion";
import { BBMVideo } from "./BBMVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BBMPlusEvidence"
      component={BBMVideo}
      durationInFrames={3900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
