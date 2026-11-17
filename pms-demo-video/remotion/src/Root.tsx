import React from 'react';
import { Composition } from 'remotion';
import { DemoVideo } from './DemoVideo';
import timeline from './timeline.json';

export const RemotionRoot: React.FC = () => (
  <Composition id="DemoVideo" component={DemoVideo} durationInFrames={timeline.durationInFrames}
    fps={timeline.fps} width={timeline.width} height={timeline.height} />
);
