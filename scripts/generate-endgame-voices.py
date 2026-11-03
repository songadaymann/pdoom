"""Generate a resumable, exact-key synthetic WAV batch against the recovered Breeze API."""
import argparse
import array
import hashlib
import json
import math
import os
import time
import urllib.parse
import urllib.request
import wave
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--only', nargs='*')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--force', action='store_true', help='Regenerate selected keys; keep the old WAV in retakes/')
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    out = args.out or args.plan.parent / 'voices'
    out.mkdir(parents=True, exist_ok=True)
    manifest = out / 'manifest.json'
    data = json.loads(args.plan.read_text())
    previous = json.loads(manifest.read_text()) if manifest.exists() else {'lines': []}
    prior = {line['key']: line for line in previous['lines']}
    for line in data['lines']:
        direction = {key: line[key] for key in ('instruction', 'delivery', 'cfg_scale', 'synthesis_text', 'postprocess') if key in line}
        if line['key'] in prior and prior[line['key']]['text'] == line['text']:
            line.update(prior[line['key']])
        line.update(direction)
    def save():
        staging = manifest.with_suffix('.tmp')
        staging.write_text(json.dumps(data, indent=2) + '\n')
        staging.replace(manifest)
    save()
    api = os.environ.get('VOICE_LAB_API', 'http://127.0.0.1:8138')
    with urllib.request.urlopen(api + '/v1/voices', timeout=10) as response:
        voices = {entry['id'] for entry in json.load(response)}
    selected = [line for line in data['lines'] if not args.only or line['key'] in args.only]
    missing = {line['voice'] for line in selected} - voices
    if missing:
        raise SystemExit('Missing saved voice profiles: ' + ', '.join(sorted(missing)))
    generated = 0
    for line in selected:
        dest = out / line['file']
        if not args.force and line.get('status') == 'generated' and dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() == line.get('sha256'):
            continue
        if args.limit is not None and generated >= args.limit:
            break
        style = 'Speak clearly in English. Urgent natural game dialogue, preserve every word. Do not add words or sounds.'
        if line['voice'] == 'elon':
            style = 'Speak in English. Smug and self-satisfied, deadpan villainous corporate menace. He thinks his joke is hilarious. Clear precise diction.'
        elif line['voice'] == 'grok':
            style = 'Speak in English. Cheerful, blunt, slightly smug synthetic assistant. Helpful urgent warnings, crisp clear diction.'
        elif line['voice'] == 'dario':
            style = 'Speak in English. Measured and dry, controlled urgency during a fight. Plain practical directions with understated humor. Clear diction.'
        elif line['voice'] == 'sam':
            style = 'Speak in English. Conversational and upbeat, urgent calls during a fight, understated self-justifying humor. Clear diction.'
        style = line.get('instruction', style)
        start = time.monotonic()
        for attempt in range(3):
            try:
                spoken = line.get('synthesis_text', line['text'])
                if line['voice'] == 'elon':
                    spoken = spoken.capitalize()
                max_seconds = max(4.0, len(spoken.split()) * .9 + 1.5)
                fields = dict(text=spoken, voice_id=line['voice'], instruction=style,
                              cfg_scale=line.get('cfg_scale', 2), seed=args.seed + attempt,
                              max_new_tokens=min(1500, math.ceil(max_seconds * 12.5) + 20))
                request = urllib.request.Request(api + '/v1/audio/speech', data=urllib.parse.urlencode(fields).encode())
                with urllib.request.urlopen(request, timeout=600) as response:
                    pcm = response.read()
                assert pcm and len(pcm) % 2 == 0, 'Incomplete PCM'
                assert len(pcm) / 48000 <= max_seconds, 'Take ran too long for its words; retry with a different seed'
                samples = array.array('h', pcm)
                rms = math.sqrt(sum(v * v for v in samples) / len(samples))
                assert rms > 100, 'Silent take'
                temp = dest.with_suffix('.tmp.wav')
                with wave.open(str(temp), 'wb') as audio:
                    audio.setnchannels(1)
                    audio.setsampwidth(2)
                    audio.setframerate(24000)
                    audio.writeframes(pcm)
                if args.force and dest.exists():
                    archive = out / 'retakes'
                    archive.mkdir(exist_ok=True)
                    dest.replace(archive / (dest.stem + '-' + str(time.time_ns()) + '.wav'))
                temp.replace(dest)
                line.update(status='generated', audio_seconds=round(len(pcm) / 48000, 3),
                            generation_seconds=round(time.monotonic() - start, 2), rms=round(rms, 2),
                            sha256=hashlib.sha256(dest.read_bytes()).hexdigest(), synthetic=True,
                            words_checked=False, seed=args.seed + attempt, instruction=style,
                            cfg_scale=line.get('cfg_scale', 2))
                save()
                generated += 1
                print(f"{sum(e.get('status') == 'generated' for e in data['lines'])}/{len(data['lines'])} {line['key']} {line['audio_seconds']}s", flush=True)
                break
            except Exception as error:
                line.update(status='error', error=str(error))
                save()
                if attempt == 2:
                    raise
    print(f'Batch saved: {out}', flush=True)


if __name__ == '__main__':
    main()
