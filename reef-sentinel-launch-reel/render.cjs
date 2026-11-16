// Renders reel.html to an MP4: node render.cjs [framesDir]
// Steps the page frame by frame (window.seek), screenshots each one with headless
// Chromium, then encodes with ffmpeg and mixes in out/soundtrack.wav (python3 music.py).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FPS = 30, DURATION = 36.5, W = 1080, H = 1920;
const TOTAL = Math.round(FPS * DURATION);
const WORKERS = Math.max(1, Math.min(4, os.cpus().length));
const framesDir = process.argv[2] || path.join(os.tmpdir(), 'reef-reel-frames');
const outDir = path.join(__dirname, 'out');
const audio = path.join(outDir, 'soundtrack.wav');
const output = path.join(outDir, 'reef-sentinel-launch-reel.mp4');

async function worker(browser, id) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'reel.html') + '?capture=1');
  await page.waitForFunction(() => window.__ready === true);
  for (let f = id; f < TOTAL; f += WORKERS) {
    await page.evaluate(t => window.seek(t), f / FPS);
    await page.screenshot({ path: path.join(framesDir, `f${String(f).padStart(5, '0')}.png`) });
    if (id === 0 && f % 120 === 0) console.log(`frame ${f}/${TOTAL}`);
  }
  await page.close();
}

(async () => {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(browser, i)));
  await browser.close();

  const hasAudio = fs.existsSync(audio);
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, 'f%05d.png')];
  if (hasAudio) args.push('-i', audio);
  args.push(
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(FPS));
  if (hasAudio) args.push('-ar', '48000', '-c:a', 'aac', '-b:a', '192k'); // music.py already masters to about -14 LUFS
  args.push('-t', String(DURATION), '-movflags', '+faststart', output);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log('wrote', output, hasAudio ? '(with soundtrack)' : '(silent: run music.py first for audio)');
})();
