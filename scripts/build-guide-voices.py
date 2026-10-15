#!/usr/bin/env python3
"""Placeholder spoken lines for the Bliss wake-up guide, generated with fal.ai (MiniMax speech).

Superseded by Jonathan's recordings (scripts/import-guide-voices.py); it skips any
guide whose voice is marked "recorded".

Reads src/doom-bliss-guide-lines.json, writes one MP3 per line to
doom-web/outside-assets/voice/ plus guide-voices.json (durations the game uses to
space the lines). Unchanged lines are not regenerated.

    python3 scripts/build-guide-voices.py                  # missing / changed lines
    python3 scripts/build-guide-voices.py --force mario    # redo one guide
    python3 scripts/build-guide-voices.py --clone samwise path/to/consented-voice.wav

--clone uploads a reference recording to fal's MiniMax voice-clone and stores the
returned voice id for that guide. Only clone a voice whose owner has agreed to it.
The key is read from FAL_API_KEY in .env.local and never printed.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINES = ROOT / 'src' / 'doom-bliss-guide-lines.json'
OUT = ROOT / 'doom-web' / 'outside-assets' / 'voice'
MANIFEST = OUT / 'guide-voices.json'


def fal_key():
    for line in (ROOT / '.env.local').read_text().splitlines():
        if line.strip().startswith(('FAL_API_KEY=', 'FAL_KEY=')):
            return line.split('=', 1)[1].strip().strip('"\'')
    raise SystemExit('No FAL_API_KEY in .env.local')


def fal(model, payload):
    req = urllib.request.Request('https://fal.run/' + model, data=json.dumps(payload).encode(), method='POST',
                                 headers={'Authorization': 'Key ' + fal_key(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit('%s failed: HTTP %d %s' % (model, e.code, e.read()[:600].decode(errors='replace')))


def download(url, path):
    with urllib.request.urlopen(url, timeout=120) as r:
        path.write_bytes(r.read())


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         check=True, capture_output=True, text=True).stdout
    return round(float(out.strip()), 3)


def clone(data, who, source):
    """Reference audio -> 64 kbps mono MP3 data URI -> MiniMax voice clone."""
    with tempfile.TemporaryDirectory() as tmp:
        mp3 = Path(tmp) / 'ref.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-ac', '1', '-ar', '32000', '-b:a', '64k', str(mp3)], check=True)
        uri = 'data:audio/mpeg;base64,' + base64.b64encode(mp3.read_bytes()).decode()
    r = fal('fal-ai/minimax/voice-clone', {'audio_url': uri, 'noise_reduction': True, 'need_volume_normalization': True})
    voice = data[who]['voice']
    voice.update(voice_id=r['custom_voice_id'], placeholder=False, cloned_from=str(Path(source).name))
    LINES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print('%s: cloned voice stored (%s)' % (who, Path(source).name))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('who', nargs='?', choices=['mario', 'samwise'], help='only this guide')
    ap.add_argument('--force', action='store_true', help='regenerate even if unchanged')
    ap.add_argument('--clone', metavar='AUDIO', help='clone a consented reference recording for WHO first')
    args = ap.parse_args()
    data = json.loads(LINES.read_text())
    if args.clone:
        if not args.who:
            raise SystemExit('--clone needs WHO (mario or samwise)')
        clone(data, args.who, Path(args.clone).expanduser())
        args.force = True
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    for who in ([args.who] if args.who else ['mario', 'samwise']):
        voice = data[who]['voice']
        if 'recorded' in voice:
            # Real recordings (scripts/import-guide-voices.py) are never overwritten.
            print('%s: recorded lines in place; skipping generated placeholders' % who)
            continue
        entry = manifest.setdefault(who, {})
        for line in data[who]['lines']:
            spoken = line.get('tts', line['text'])
            settings = {k: voice[k] for k in ('voice_id', 'speed', 'pitch')}
            sha = hashlib.sha256(json.dumps([voice['model'], settings, spoken]).encode()).hexdigest()[:16]
            name = 'guide-%s-%s.mp3' % (who, line['key'])
            path = OUT / name
            if not args.force and path.exists() and entry.get(line['key'], {}).get('sha') == sha:
                continue
            r = fal(voice['model'], {'text': spoken, 'voice_setting': {**settings, 'vol': 1.0},
                                      'audio_setting': {'sample_rate': 44100, 'bitrate': 128000, 'format': 'mp3', 'channel': 1},
                                      'language_boost': 'English', 'output_format': 'url'})
            download(r['audio']['url'], path)
            entry[line['key']] = {'file': 'outside-assets/voice/' + name, 'duration': duration(path), 'text': line['text'],
                                  'sha': sha, 'placeholder_voice': bool(voice.get('placeholder'))}
            print('%s %-8s %5.2fs  %s' % (who, line['key'], entry[line['key']]['duration'], line['text']))
            MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
