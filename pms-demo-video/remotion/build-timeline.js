// Builds src/timeline.json from the narration script, voice durations and recorded clip metadata.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const script = JSON.parse(fs.readFileSync(path.join(root, 'narration/script.json')));
const voice = JSON.parse(fs.readFileSync(path.join(root, 'assets/voice/durations.json')));
const FPS = 30, XFADE = 0.5;
const LABELS = {
  '02-dashboard': 'Dashboard', '03-roomchart': 'Room Chart', '04-booking': 'Direct Booking',
  '05-checkin': 'Front Desk · Check-in', '06-pos-setup': 'Point of Sale · Outlets', '07-pos-order': 'Point of Sale · Billing',
  '08-folio': 'Guest Folio', '09-users': 'Users & Permissions', '10-reports': 'Reports',
};
let t = 0; const scenes = [];
for (const s of script.scenes) {
  const d = voice[s.id];
  let duration, cues, clip = null;
  if (s.type === 'card') {
    const lead = s.id === '01-intro' ? 0.8 : 0.9, tail = s.id === '01-intro' ? 1.6 : 3.2;
    cues = [lead]; duration = lead + d[0] + tail;
  } else {
    const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/clips', s.id + '.json')));
    cues = meta.cues; duration = meta.duration; clip = `clips/${s.id}.mp4`;
  }
  const start = scenes.length ? t - XFADE : 0;
  scenes.push({ id: s.id, type: s.type, label: LABELS[s.id] || '', clip,
    from: Math.round(start * FPS), durationInFrames: Math.round(duration * FPS),
    lines: s.lines.map((text, i) => ({ text, audio: `voice/${s.id}_${i}.wav`, from: Math.round(cues[i] * FPS), durationInFrames: Math.ceil(d[i] * FPS) })) });
  t = start + duration;
}
const out = { fps: FPS, width: 1920, height: 1080, xfade: Math.round(XFADE * FPS), durationInFrames: Math.round(t * FPS), tagline: script.tagline, scenes };
fs.writeFileSync(path.join(__dirname, 'src/timeline.json'), JSON.stringify(out, null, 2));
console.log('total', t.toFixed(1), 's,', out.durationInFrames, 'frames');
