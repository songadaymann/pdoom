"""Find boss-fight takes that run on after their last word, so the importer can cut them.

    <voice lab>/runtime/breeze-tts2/.venv/bin/python3 -I scripts/find-endgame-take-tails.py <batch folder> [key prefix...]

The 2026-10-27 shouted retakes came back with up to 2 s of loud, wordless noise after the line ("Got it!"
ends at 0.42 s of 2.24). Whisper (mlx-whisper, large-v3-turbo, as the batch's own word checks use) times
each take's last word; a take with more than 0.6 s after it is listed in
doom-web/local/endgame/take-tails.json with where its last word ends and the source WAV's sha256, so
scripts/import-endgame-assets.mjs cuts it there, and never cuts a retake. Elon's takes are left alone (his
meltdown line is cut off on purpose). With key prefixes (guide-mario-end-call, guide-), only those takes are
heard again and the list keeps the rest. scripts/import-guide-voices.py --endgame cuts the meadow's lines by
the same list.
"""
import hashlib, json, sys, wave
from pathlib import Path
from mlx_whisper import transcribe

ROOT = Path(__file__).resolve().parents[1]
batch, only = Path(sys.argv[1]), tuple(sys.argv[2:])
lines = json.loads((batch / 'voices/manifest.json').read_text())['lines']
out = ROOT / 'doom-web/local/endgame/take-tails.json'
tails = {k: v for k, v in json.loads(out.read_text()).items() if not k.startswith(only)} if only and out.exists() else {}
for n, line in enumerate(lines):
    key, path = line['key'], batch / 'voices' / line['file']
    if key.startswith('mcp-') or not path.exists() or only and not key.startswith(only):
        continue
    with wave.open(str(path)) as w:
        sec = w.getnframes() / w.getframerate()
    heard = transcribe(str(path), path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='en', word_timestamps=True)
    words = [w for s in heard['segments'] for w in s.get('words', [])]
    if words and sec - words[-1]['end'] > .6:
        tails[key] = {'end': round(words[-1]['end'], 2), 'sec': round(sec, 2), 'heard': heard['text'].strip(),
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    if n % 50 == 0:
        print(f'{n}/{len(lines)}', flush=True)
out.write_text(json.dumps(tails, indent=1) + '\n')
print(f'{len(tails)} takes run on past their last word -> {out.relative_to(ROOT)}')
