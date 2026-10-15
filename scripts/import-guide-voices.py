#!/usr/bin/env python3
"""Import Jonathan's recorded Bliss guide lines into the game.

Record one file per line, named after the line's key in
src/doom-bliss-guide-lines.json, into

    GADtrailers/pdoom/dario-prologue-vo-v2/<key>.mp3   (Dario: call, greet, follow,
    GADtrailers/pdoom/sam-prologue-vo-v2/<key>.mp3      recap, fault, situation, mirror, inside)

(.wav, .m4a and .aif work too). This levels every line to the same loudness and
writes doom-web/outside-assets/voice/guide-<mario|samwise>-<key>.mp3 plus
guide-voices.json; the game times each line from its file and shows subtitles
alone for lines without one. Takes are left untouched. To cut or join pieces of
a longer take instead, list them in TAKES. The v1 recordings (the first script)
are archived in art/audio/bliss-guide-v1-recordings/.

    python3 scripts/import-guide-voices.py
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parents[2] / 'GADtrailers' / 'pdoom'
OUT = ROOT / 'doom-web' / 'outside-assets' / 'voice'
LINES = ROOT / 'src' / 'doom-bliss-guide-lines.json'
FOLDERS = {'mario': 'dario-prologue-vo-v2', 'samwise': 'sam-prologue-vo-v2'}
EXTS = ('.mp3', '.wav', '.m4a', '.aif', '.aiff')
TARGET_LUFS = -16.0
PEAK_DB = -1.5

# Optional: key -> list of (take file relative to SRC, start s, end s or None),
# joined with a short pause. Keys not listed are found by name in FOLDERS.
D, S = 'dario-prologue-vo-v2/dario-20261010-', 'sam-prologue-vo-v2/sam-20261010-'
D3 = 'dario-prologue-vo-v3/dario-20261010-'
TAKES: dict[str, dict[str, list]] = {
    # Jonathan's 2026-10-10 takes (copied from ~/Downloads/{dario,sam}-rewritten-oct10).
    'mario': {
        # Dario v3 (~/Downloads/dario-rewritten-oct10v1): mostly Sam's script in Dario's voice.
        'call': [(D + '152126-125091.wav', 0, None)],   # v2: no new take
        'greet': [(D3 + '173939-434125.wav', 0, None)],
        'follow': [(D3 + '174145-331441.wav', 0, None)],
        'recap': [(D3 + '174702-127402.wav', 0, None), (D3 + '174524-926537.wav', 0, None), (D3 + '174547-262230.wav', 0, None)],
        'fault': [(D3 + '174614-430191.wav', 0, None)],
        # The later of the two situation takes (nostalgia ending, no Black Mirror, like Sam's).
        'situation': [(D3 + '175853-166026.wav', 0, None)],
        'inside': [(D3 + '180147-561194.wav', 0, None), (D3 + '180257-289146.wav', 0, None)],
    },
    'samwise': {
        'call': [(S + '153257-770630.wav', 0, None)],
        'greet': [(S + '153331-443732.wav', 0, None)],
        'follow': [(S + '153352-484927.wav', 0, None)],
        'recap': [(S + '153451-153471.wav', 0, None), (S + '153520-834702.wav', 0, None)],
        'fault': [(S + '153541-129013.wav', 0, None)],
        'situation': [(S + '153605-793528.wav', 0, None)],
        'inside': [(S + '153846-231068.wav', 0, None), (S + '153909-940924.wav', 0, None), (S + '153924-171267.wav', 0, None)],
    },
}
# Pause between joined pieces, per (who, key); 0.3 s otherwise.
GAP: dict = {('mario', 'recap'): [0.45, 0.4], ('mario', 'inside'): [0.4], ('samwise', 'inside'): [0.45, 0.3]}


def discover():
    lines = json.loads(LINES.read_text())
    takes, missing = {}, []
    for who, folder in FOLDERS.items():
        for line in lines[who]['lines']:
            key = line['key']
            pieces = TAKES[who].get(key)
            if not pieces:
                found = next((f'{folder}/{key}{ext}' for ext in EXTS if (SRC / folder / f'{key}{ext}').exists()), None)
                pieces = [(found, 0, None)] if found else None
            if pieces:
                takes.setdefault(who, {})[key] = pieces
            else:
                missing.append(f'{folder}/{key}')
    return takes, missing


def run(*args):
    return subprocess.run(list(args), check=True, capture_output=True, text=True)


def loudness(path):
    err = subprocess.run(['ffmpeg', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])
    peak = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', err)[-1])
    return lufs, peak


def build(who, key, pieces, tmp):
    parts = []
    gaps = GAP.get((who, key), [0.3] * (len(pieces) - 1))
    for i, (name, start, end) in enumerate(pieces):
        piece = tmp / f'{who}-{key}-{i}.wav'
        trim = ['-ss', str(start)] + (['-to', str(end)] if end is not None else [])
        # 8 ms fades at every cut so joins never click.
        run('ffmpeg', '-v', 'error', '-y', '-i', str(SRC / name), *trim, '-af', 'afade=t=in:d=0.008,areverse,afade=t=in:d=0.008,areverse',
            '-ar', '44100', '-ac', '1', str(piece))
        parts.append(piece)
        if i < len(pieces) - 1 and gaps[i] > 0:
            silence = tmp / f'{who}-{key}-gap{i}.wav'
            run('ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', str(gaps[i]), str(silence))
            parts.append(silence)
    joined = tmp / f'{who}-{key}.wav'
    listing = tmp / f'{who}-{key}.txt'
    listing.write_text(''.join(f"file '{p}'\n" for p in parts))
    run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy', str(joined))
    lufs, peak = loudness(joined)
    gain = min(TARGET_LUFS - lufs, PEAK_DB - peak)
    out = OUT / f'guide-{who}-{key}.mp3'
    run('ffmpeg', '-v', 'error', '-y', '-i', str(joined), '-af', f'volume={gain:.2f}dB', '-ar', '44100', '-ac', '1', '-b:a', '128k', str(out))
    dur = float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)).stdout)
    return {'file': f'outside-assets/voice/{out.name}', 'duration': round(dur, 3), 'source': [p[0] for p in pieces],
            'gain_db': round(gain, 2)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    takes, missing = discover()
    manifest = {}
    for old in OUT.glob('guide-*.mp3'):
        old.unlink()                       # only lines with a current take keep a file
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for who, keys in takes.items():
            for key, pieces in keys.items():
                manifest.setdefault(who, {})[key] = entry = build(who, key, pieces, tmp)
                print('%-8s %-9s %5.2fs  %+5.1f dB  %s' % (who, key, entry['duration'], entry['gain_db'], ', '.join(entry['source'])))
    (OUT / 'guide-voices.json').write_text(json.dumps(manifest, indent=1) + '\n')
    if missing:
        print('No take yet (subtitles only):', ', '.join(missing))


if __name__ == '__main__':
    main()
