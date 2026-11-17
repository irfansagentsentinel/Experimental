"""Generate one WAV per narration line with Kokoro (Apache-2.0) and write durations.json.
Usage: python3 -I tts.py <model_dir> <out_dir>"""
import json, sys, pathlib, soundfile as sf
from kokoro_onnx import Kokoro
model_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
cfg = json.loads((pathlib.Path(__file__).parent / "script.json").read_text())
k = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
out_dir.mkdir(parents=True, exist_ok=True)
durations = {}
for s in cfg["scenes"]:
    durations[s["id"]] = []
    for i, line in enumerate(s["lines"]):
        samples, sr = k.create(line, voice=cfg["voice"], speed=cfg["speed"], lang=cfg["lang"])
        sf.write(out_dir / f"{s['id']}_{i}.wav", samples, sr)
        durations[s["id"]].append(round(len(samples) / sr, 3))
    print(s["id"], durations[s["id"]])
(out_dir / "durations.json").write_text(json.dumps(durations, indent=2))
