// Shared helpers for recording a scene: login, fake cursor, paced actions,
// CDP screencast capture and narration cue timestamps.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.PMS_URL || 'https://demo.reefsentinel.com';
const EMAIL = process.env.PMS_EMAIL;
const PASSWORD = process.env.PMS_PASSWORD;
const W = 1920, H = 1080, FPS = 30;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  if (!EMAIL || !PASSWORD) throw new Error('Set PMS_EMAIL and PMS_PASSWORD');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept()); // app uses confirm() before charging a room
  await page.goto(`${BASE}/ui/login.html?portal=hotel`, { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('#submitBtn');
  await page.waitForFunction(() => window.__HOTEL_SCRIPT_LOADED__ === true, null, { timeout: 90000 });
  await page.waitForLoadState('networkidle');
  await installCursor(page);
  return { browser, page };
}

async function installCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('__cur')) return;
    const style = document.createElement('style');
    style.textContent = `
      #__cur{position:fixed;left:960px;top:540px;width:28px;height:28px;z-index:2147483647;pointer-events:none;
        transition:left .75s cubic-bezier(.22,.8,.3,1),top .75s cubic-bezier(.22,.8,.3,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;z-index:2147483646;pointer-events:none;
        background:rgba(124,58,237,.35);border:2px solid rgba(124,58,237,.8);animation:__rip .55s ease-out forwards}
      @keyframes __rip{to{transform:scale(3.2);opacity:0}}
      ::-webkit-scrollbar{width:0;height:0}`;
    document.head.appendChild(style);
    const c = document.createElement('div');
    c.id = '__cur';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l16 9.5-7 1.6 4.2 8.2-3.2 1.6-4.2-8.2L5 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    window.__ripple = (x, y) => {
      const r = document.createElement('div');
      r.className = '__ripple'; r.style.left = x + 'px'; r.style.top = y + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 700);
    };
  });
}

// ---------- paced actions ----------
async function moveTo(page, loc) {
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 });
  await sleep(150);
  const b = await loc.boundingBox();
  if (!b) throw new Error('no bounding box');
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.evaluate(([x, y]) => { const c = document.getElementById('__cur'); c.style.left = (x - 5) + 'px'; c.style.top = (y - 3) + 'px'; }, [x, y]);
  await sleep(800);
  return { x, y };
}
async function click(page, loc, { pause = 500 } = {}) {
  const { x, y } = await moveTo(page, loc);
  await page.evaluate(([x, y]) => window.__ripple(x, y), [x, y]);
  await loc.click();
  await sleep(pause);
}
async function type(page, loc, text, { delay = 45 } = {}) {
  await click(page, loc, { pause: 150 });
  await loc.fill('');
  await loc.pressSequentially(text, { delay });
  await sleep(250);
}
async function select(page, loc, value) {
  await moveTo(page, loc);
  await loc.selectOption(value);
  await sleep(400);
}
async function hover(page, loc, ms = 600) { await moveTo(page, loc); await sleep(ms); }
async function smoothScroll(page, selector, dy, ms = 1200) {
  await page.evaluate(([sel, dy, ms]) => new Promise(res => {
    const el = sel ? document.querySelector(sel) : document.scrollingElement;
    const start = el.scrollTop, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      el.scrollTop = start + dy * e; k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  }), [selector, dy, ms]);
  await sleep(200);
}

// ---------- recording ----------
class Recorder {
  constructor(page, sceneId, outDir, lineDurations) {
    Object.assign(this, { page, sceneId, outDir, lineDurations, frames: [], cues: [], nextLine: 0 });
    this.frameDir = path.join(outDir, sceneId + '_frames');
    fs.rmSync(this.frameDir, { recursive: true, force: true });
    fs.mkdirSync(this.frameDir, { recursive: true });
  }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async f => {
      const file = path.join(this.frameDir, String(this.frames.length).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    // nudge a repaint so the first frame arrives immediately
    await this.page.evaluate(() => { const c = document.getElementById('__cur'); c.style.opacity = '0.99'; requestAnimationFrame(() => c.style.opacity = '1'); });
    await sleep(300);
    this.t0 = Date.now() / 1000;
  }
  now() { return Date.now() / 1000 - this.t0; }
  // Start the next narration line now, but never before the previous line has finished.
  async cue() {
    const i = this.nextLine++;
    if (i > 0) {
      const prev = this.cues[i - 1] + this.lineDurations[i - 1] + 0.25;
      const wait = prev - this.now();
      if (wait > 0) await sleep(wait * 1000);
    }
    this.cues.push(+this.now().toFixed(3));
  }
  // Hold until the last narration line is done (+ tail), then stop.
  async finish(tail = 1.2) {
    const last = this.cues.length - 1;
    const end = last >= 0 ? this.cues[last] + this.lineDurations[last] + tail : tail;
    const wait = end - this.now();
    if (wait > 0) await sleep(wait * 1000);
    await this.page.evaluate(() => { const c = document.getElementById('__cur'); c.style.opacity = '0.98'; });
    await sleep(200);
    await this.cdp.send('Page.stopScreencast');
    const total = this.now();
    // ffmpeg concat list with per-frame durations (screencast only emits on change)
    const list = [];
    const startT = this.frames[0].t, sceneStartWall = this.t0;
    // align: frame timestamps are monotonic seconds; offset relative to first frame
    for (let i = 0; i < this.frames.length; i++) {
      const cur = this.frames[i].t - startT;
      const next = i + 1 < this.frames.length ? this.frames[i + 1].t - startT : total;
      list.push(`file '${this.frames[i].file}'`, `duration ${Math.max(0.001, next - cur).toFixed(4)}`);
    }
    list.push(`file '${this.frames[this.frames.length - 1].file}'`);
    const listFile = path.join(this.outDir, this.sceneId + '_frames.txt');
    fs.writeFileSync(listFile, list.join('\n'));
    const mp4 = path.join(this.outDir, this.sceneId + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', mp4]);
    fs.rmSync(this.frameDir, { recursive: true, force: true });
    fs.rmSync(listFile);
    const meta = { id: this.sceneId, duration: +total.toFixed(3), cues: this.cues };
    fs.writeFileSync(path.join(this.outDir, this.sceneId + '.json'), JSON.stringify(meta, null, 2));
    return meta;
  }
}

module.exports = { launch, installCursor, moveTo, click, type, select, hover, smoothScroll, Recorder, sleep, BASE };
