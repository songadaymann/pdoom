#!/usr/bin/env python3
"""Word timing for a new voiceover take, in the shape scripts/build-promo.py --vo reads.

Transcribes the take with whisper (small.en, word timestamps, the model the original
timings used), then splits it into the ten beats by aligning its words against the
original take's beats (doom-web/local/promo/vo/<ceo>-timing.json).  Lines cut from the
new take simply leave their beat shorter; words added inherit the beat of the word
before them.

    python3 scripts/promo-vo-timing.py sam ../../../GADtrailers/pdoom/sam-mixed.wav --take mixed
    python3 scripts/build-promo.py --vo sam --take mixed

Writes doom-web/local/promo/vo/<ceo>-<take>.json (raw whisper) and <ceo>-<take>-timing.json.
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VO_DIR = ROOT / 'doom-web' / 'local' / 'promo' / 'vo'
BASE = ROOT.parents[2]            # the Dropbox folder that holds GADtrailers/


def norm(w):
    return re.sub(r'[^a-z0-9]', '', w.lower())


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def transcribe(src, raw_path):
    import whisper
    model = whisper.load_model('small.en')
    r = model.transcribe(str(src), language='en', word_timestamps=True, fp16=False)
    raw_path.write_text(json.dumps(r, indent=1, default=float) + '\n')
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ceo', choices=['sam', 'mario'])
    ap.add_argument('audio', help='the new take (wav, mov, ...)')
    ap.add_argument('--take', required=True, help='short name used in the output file names, e.g. "mixed"')
    ap.add_argument('--whisper-json', help='reuse an existing whisper JSON for this audio instead of transcribing')
    args = ap.parse_args()

    src = Path(args.audio).expanduser().resolve()
    raw_path = VO_DIR / ('%s-%s.json' % (args.ceo, args.take))
    if args.whisper_json:
        raw = json.loads(Path(args.whisper_json).read_text())
        raw_path.write_text(json.dumps(raw, indent=1) + '\n')
    else:
        raw = transcribe(src, raw_path)
    new = [dict(t=round(float(w['start']), 2), end=round(float(w['end']), 2), word=w['word'].strip())
           for s in raw['segments'] for w in s['words']]

    ref = json.loads((VO_DIR / ('%s-timing.json' % args.ceo)).read_text())
    old = [(b['beat'], w) for b in ref['beats'] for w in b['words']]
    sm = difflib.SequenceMatcher(None, [norm(w['word']) for _, w in old], [norm(w['word']) for w in new], autojunk=False)
    beat_of = [None] * len(new)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op in ('equal', 'replace'):
            for j in range(j1, j2):
                beat_of[j] = old[min(i1 + (j - j1), i2 - 1)][0]
    for j in range(len(new)):                       # inserted words join the beat before them
        if beat_of[j] is None:
            beat_of[j] = beat_of[j - 1] if j else 1
    for j in range(1, len(new)):                    # beats never run backwards
        beat_of[j] = max(beat_of[j], beat_of[j - 1])

    dur = duration(src)
    beats = []
    for b in ref['beats']:
        ws = [w for w, n in zip(new, beat_of) if n == b['beat']]
        if not ws:
            raise SystemExit('beat %d ("%s") is missing from the new take entirely' % (b['beat'], b['text'][:60]))
        beats.append(dict(beat=b['beat'], start=0.0 if b['beat'] == 1 else ws[0]['t'], words=ws,
                          text=' '.join(w['word'] for w in ws)))
    for a, b in zip(beats, beats[1:]):
        a['end'] = b['start']
    beats[-1]['end'] = dur
    try:
        rel = str(src.relative_to(BASE))
    except ValueError:
        rel = str(src)
    out = dict(ceo=args.ceo, source=rel, duration=dur, beats=[dict(beat=b['beat'], start=b['start'], end=b['end'],
                                                                     text=b['text'], words=b['words']) for b in beats])
    path = VO_DIR / ('%s-%s-timing.json' % (args.ceo, args.take))
    path.write_text(json.dumps(out, indent=1) + '\n')
    print('wrote', path)
    for b in beats:
        print('  %2d %6.2f-%6.2f  %s' % (b['beat'], b['start'], b['end'], b['text']))


if __name__ == '__main__':
    main()
