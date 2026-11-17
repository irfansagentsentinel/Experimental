# Reef Sentinel PMS – demo video

A narrated product demo of the Reef Sentinel hotel PMS (demo.reefsentinel.com), built from real UI
recordings, an AI voiceover and a Remotion edit. The output is a 1080p MP4 of about 2 min 45 s.

## Pipeline

| Step | Tool | Files |
|---|---|---|
| 1. Script | JSON, one entry per scene, split into narration *lines* (cues) | `narration/script.json` |
| 2. Voiceover | [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) TTS (Apache-2.0), voice `hf_alpha` (Indian female), British-English phonemes | `narration/tts.py` → `assets/voice/` |
| 3. Screen capture | Playwright drives the live app with a visible animated cursor; frames are captured over the Chrome DevTools screencast API and encoded with ffmpeg (CRF 16). Each narration line is *cued* when its UI action happens. | `recorder/director.js`, `recorder/record.js` → `remotion/public/clips/*.mp4 + *.json` |
| 4. Music | Original ambient track generated with NumPy (no licensing) | `music/make_music.py` |
| 5. Edit | [Remotion](https://www.remotion.dev) 4: intro/outro cards, browser frame, section labels, captions, crossfades, music ducked under the voice | `remotion/` |

## Re-running

```bash
# 1) voiceover (needs kokoro-v1.0.onnx + voices-v1.0.bin from the kokoro-onnx releases)
pip install kokoro-onnx soundfile
python3 narration/tts.py <model_dir> assets/voice

# 2) record scenes (creates real records in the demo PMS, so only re-record what you need)
PMS_EMAIL=... PMS_PASSWORD=... node recorder/record.js            # all scenes
PMS_EMAIL=... PMS_PASSWORD=... node recorder/record.js 04-booking # one scene

# 3) music
python3 music/make_music.py remotion/public/bg-music.wav 200

# 4) edit + render
cp assets/voice/*.wav remotion/public/voice/
cd remotion && npm install && node build-timeline.js
npx remotion studio                                 # preview / tweak
npx remotion render DemoVideo out/reef-sentinel-demo.mp4 --crf=18
```

Credentials are read from `PMS_EMAIL` / `PMS_PASSWORD` and are never stored in the repo.
In sandboxes without Chrome downloads, set `REMOTION_BROWSER` to a local headless Chromium.

## Live actions recorded in the video
- Direct booking: Ananya Rao, Suite, 24–26 Nov 2026 (H73VJG)
- Check-in: Daniel Müller (XZ5GB2)
- New POS outlet: "Spa & Wellness"
- POS bill at Coral Café charged to Ishaan Kapoor's room
- New staff user: Kabir Khan (Guest Relations Executive)
