import React from 'react';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { continueRender, delayRender } from 'remotion';
import timeline from './timeline.json';

// Inter is bundled in public/fonts (render machines may have no access to Google Fonts).
const fontFamily = 'Inter, system-ui, sans-serif';
const fontHandle = delayRender('Loading Inter');
Promise.all([400, 500, 700, 800].map(w =>
  new FontFace('Inter', `url(${staticFile(`fonts/inter-latin-${w}-normal.woff2`)}) format('woff2')`, { weight: String(w) })
    .load().then(face => document.fonts.add(face)),
)).then(() => continueRender(fontHandle)).catch(err => { console.error(err); continueRender(fontHandle); });

type Line = { text: string; audio: string; from: number; durationInFrames: number };
type Scene = { id: string; type: string; label: string; clip: string | null; from: number; durationInFrames: number; lines: Line[] };

const C = {
  bg1: '#0b1226', bg2: '#1e2a44', accent: '#8b7cf6', accent2: '#5eead4', text: '#f8fafc', muted: '#a5b4cc',
};
const XF = timeline.xfade;

// Fade a scene in/out across the crossfade window.
const useSceneOpacity = (dur: number) => {
  const f = useCurrentFrame();
  return interpolate(f, [0, XF, dur - XF, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
};

const Background: React.FC = () => {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, timeline.durationInFrames], [0, 360]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${135 + Math.sin(a / 57) * 10}deg, ${C.bg1} 0%, ${C.bg2} 55%, #2a2350 100%)` }}>
      <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: -200 + Math.sin(f / 90) * 60, top: -350,
        background: 'radial-gradient(circle, rgba(139,124,246,.22), transparent 65%)' }} />
      <div style={{ position: 'absolute', width: 800, height: 800, borderRadius: '50%', right: -250, bottom: -380 + Math.cos(f / 110) * 50,
        background: 'radial-gradient(circle, rgba(94,234,212,.14), transparent 65%)' }} />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ line: Line }> = ({ line }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6, line.durationInFrames + 4, line.durationInFrames + 10], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const y = interpolate(f, [0, 8], [8, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 26, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${y}px)` }}>
      <div style={{ maxWidth: 1500, padding: '12px 26px', borderRadius: 14, background: 'rgba(8,12,28,.72)', border: '1px solid rgba(255,255,255,.08)',
        color: C.text, fontSize: 30, fontWeight: 500, lineHeight: 1.3, textAlign: 'center', letterSpacing: -0.2 }}>
        {line.text}
      </div>
    </div>
  );
};

const ScreenScene: React.FC<{ scene: Scene; index: number }> = ({ scene, index }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneOpacity(scene.durationInFrames);
  const enter = spring({ frame: f, fps, config: { damping: 200 }, durationInFrames: 20 });
  const zoom = interpolate(f, [0, scene.durationInFrames], [1, 1.025], { easing: Easing.inOut(Easing.quad) });
  const W = 1600, H = 900, X = 160, Y = 70;
  return (
    <AbsoluteFill style={{ opacity }}>
      {/* section chip */}
      <div style={{ position: 'absolute', left: X, top: 18, display: 'flex', alignItems: 'center', gap: 12,
        opacity: enter, transform: `translateX(${(1 - enter) * -20}px)` }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.bg1, background: C.accent2, borderRadius: 8, padding: '4px 10px' }}>
          {String(index).padStart(2, '0')}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>{scene.label}</div>
      </div>
      {/* browser frame */}
      <div style={{ position: 'absolute', left: X, top: Y, width: W, height: H + 34, borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.08)', transform: `scale(${zoom})`, background: '#fff' }}>
        <div style={{ height: 34, background: '#eef1f6', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
          <div style={{ marginLeft: 18, flex: 1, maxWidth: 520, height: 22, borderRadius: 6, background: '#fff', color: '#64748b', fontSize: 13,
            display: 'flex', alignItems: 'center', padding: '0 12px' }}>demo.reefsentinel.com</div>
        </div>
        <OffthreadVideo src={staticFile(scene.clip!)} muted style={{ width: W, height: H, display: 'block' }} />
      </div>
      {scene.lines.map((l, i) => (
        <Sequence key={i} from={l.from} durationInFrames={l.durationInFrames + 12} layout="none">
          <Caption line={l} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Logo: React.FC<{ width: number }> = ({ width }) => (
  <Img src={staticFile('logo.png')} style={{ width, filter: 'brightness(0) invert(1)' }} />
);

const IntroCard: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useSceneOpacity(scene.durationInFrames);
  const s = spring({ frame: f - 4, fps, config: { damping: 14, mass: 0.8 } });
  const sub = interpolate(f, [28, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bar = interpolate(f, [20, 60], [0, 420], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ opacity, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ transform: `scale(${0.85 + 0.15 * s})`, opacity: s }}><Logo width={820} /></div>
      <div style={{ width: bar, height: 4, borderRadius: 2, marginTop: 34, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})` }} />
      <div style={{ marginTop: 30, fontSize: 38, color: C.muted, fontWeight: 500, opacity: sub, transform: `translateY(${(1 - sub) * 12}px)` }}>
        The all-in-one hotel management platform
      </div>
    </AbsoluteFill>
  );
};

const OutroCard: React.FC<{ scene: Scene }> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(f, [0, XF], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(f, [scene.durationInFrames - 24, scene.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const s = spring({ frame: f - 6, fps, config: { damping: 16 } });
  const tag = interpolate(f, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ transform: `scale(${0.9 + 0.1 * s})`, opacity: s }}><Logo width={700} /></div>
      <div style={{ marginTop: 48, fontSize: 64, fontWeight: 800, letterSpacing: -1.2, opacity: tag, transform: `translateY(${(1 - tag) * 16}px)`,
        background: `linear-gradient(90deg, #ffffff, ${C.accent2})`, WebkitBackgroundClip: 'text', color: 'transparent' }}>
        {timeline.tagline}
      </div>
    </AbsoluteFill>
  );
};

// Background music: louder on title cards, ducked under narration.
const voiceWindows = (timeline.scenes as Scene[]).flatMap(s => s.lines.map(l => [s.from + l.from, s.from + l.from + l.durationInFrames] as [number, number]));
const musicVolume = (f: number) => {
  const total = timeline.durationInFrames;
  let duck = 0;
  for (const [a, b] of voiceWindows) {
    if (f >= a - 8 && f <= b + 12) {
      duck = Math.max(duck, Math.min(1, (f - (a - 8)) / 8, (b + 12 - f) / 12));
    }
  }
  const base = 0.22, ducked = 0.07;
  const fade = Math.min(1, f / 30, (total - f) / 60);
  return Math.max(0, (base - (base - ducked) * duck) * fade);
};

export const DemoVideo: React.FC = () => {
  const scenes = timeline.scenes as Scene[];
  let screenIndex = 0;
  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: C.bg1 }}>
      <Background />
      <Audio src={staticFile('bg-music.wav')} volume={musicVolume} />
      {scenes.map(scene => {
        const idx = scene.type === 'screen' ? ++screenIndex : 0;
        return (
          <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} name={scene.id}>
            {scene.id === '01-intro' && <IntroCard scene={scene} />}
            {scene.id === '11-outro' && <OutroCard scene={scene} />}
            {scene.type === 'screen' && <ScreenScene scene={scene} index={idx} />}
            {scene.lines.map((l, i) => (
              <Sequence key={i} from={l.from} durationInFrames={l.durationInFrames + 6} layout="none">
                <Audio src={staticFile(l.audio)} volume={1} />
              </Sequence>
            ))}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
