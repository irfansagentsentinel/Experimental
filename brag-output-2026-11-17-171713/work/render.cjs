// Renders composition.html to ../brag.mp4 and ../brag.jpg:  node render.cjs
// Steps the page one frame at a time (window.seek), screenshots each frame with headless
// Chromium, bakes the poster in as frame 0, then encodes with ffmpeg and adds soundtrack.wav.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FPS = 30, BEAT = 2 / 3, BEATS = 34, W = 1080, H = 1920;
const TOTAL = Math.round(BEATS * BEAT * FPS);            // 680 frames, 22.667 s
const POSTER_FRAME = 186;                                 // 6.2 s: the reveal, settled
const WORKERS = Math.max(1, Math.min(4, os.cpus().length));
const framesDir = path.join(__dirname, 'frames');
const outDir = path.join(__dirname, '..');
const audio = path.join(__dirname, 'soundtrack.wav');
const name = f => path.join(framesDir, `f${String(f).padStart(5, '0')}.png`);

async function worker(browser, id) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'composition.html') + '?capture=1');
  await page.waitForFunction(() => window.__ready === true);   // fonts and images loaded
  for (let f = id; f < TOTAL; f += WORKERS) {
    await page.evaluate(t => window.seek(t), f / FPS);
    await page.screenshot({ path: name(f) });
  }
  await page.close();
}

(async () => {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const browser = await chromium.launch();
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(browser, i)));
  await browser.close();

  // Poster: the strongest settled frame, saved as brag.jpg and baked in as frame 0
  // (replacing that frame, so duration and audio sync do not change).
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', name(POSTER_FRAME), '-q:v', '2', path.join(outDir, 'brag.jpg')]);
  fs.copyFileSync(name(POSTER_FRAME), name(0));

  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(framesDir, 'f%05d.png'), '-i', audio,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(FPS),
    '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
    '-frames:v', String(TOTAL), '-movflags', '+faststart', path.join(outDir, 'brag.mp4')], { stdio: 'inherit' });
  console.log(`wrote brag.mp4 (${TOTAL} frames) and brag.jpg`);
})();
