"""Bring Jonathan's recorded voice lines into the game.

    python3 scripts/import-voice-lines.py <folder> [--speaker liron] [--dry-run]

Lines and their order are doom-web/voice/lines.json (the "p(DOOM) Voice Lines" doc).
A take is matched by its name -- `liron-3.wav`, `Liron Shapira 03.m4a`, `hal-angry.mp3` --
or, when the name is a recorder timestamp, by transcribing it with Whisper (small.en)
against that speaker's lines. The speaker comes from --speaker, the file name or its
folder (`hal/`, `Rob Miles/`). The newest take of a line wins. Each take is trimmed,
levelled to -16 LUFS and saved as doom-web/voice/<key>.mp3; Bliss founder shouts go to
outside-assets/voice/ and guide-voices.json. Writes doom-web/voice/manifest.json and
doom-mod/actors/VoiceData.zs (take lengths, so subtitles stay up while a take plays).
Run `python3 scripts/build-doom-mod.py` afterwards.
"""
import argparse, difflib, json, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'doom-web'
LINES = json.loads((WEB / 'voice/lines.json').read_text())
AUDIO = {'.wav', '.mp3', '.m4a', '.aif', '.aiff', '.flac', '.ogg', '.caf'}

def norm(text):
    return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()

SPEAKERS = {s['id']: s for s in LINES['speakers']}
ALIASES = {}
for s in LINES['speakers']:
    for name in {s['id'], s['heading'], s['heading'].split(' (')[0], s['heading'].split(':')[-1].split(' (')[0]}:
        ALIASES[norm(name).replace(' ', '')] = s['id']
for first, sid in [('liron', 'liron'), ('stuart', 'stuart'), ('eliezer', 'eliezer'), ('geoffrey', 'hinton'), ('geoff', 'hinton'),
                   ('holly', 'holly'), ('rob', 'rob'), ('dan', 'dan'), ('nate', 'nate'), ('roman', 'roman'), ('beth', 'beth'),
                   ('hal3000', 'hal'), ('hal', 'hal'), ('terminator', 'inferminator'), ('inferminator', 'inferminator'), ('arnold', 'inferminator'),
                   ('radio', 'radio'), ('soldier', 'radio'), ('ed404', 'ed404'), ('robot', 'ed404'), ('lead', 'lead')]:
    ALIASES.setdefault(first, sid)

def speaker_of(path, forced):
    if forced: return forced
    for part in [path.stem, path.parent.name]:
        squashed = norm(part).replace(' ', '')
        for alias in sorted(ALIASES, key=len, reverse=True):
            if squashed.startswith(alias): return ALIASES[alias]
    return None

def by_name(path, sid):
    """liron-3 / Liron Shapira 03 / hal-angry -> a line, without listening."""
    stem = norm(path.stem)
    number = re.search(r'(\d+)\s*$', stem)
    lines = SPEAKERS[sid]['lines']
    if number and not re.match(r'^\d{6,}', number.group(1)):
        n = int(number.group(1))
        if 1 <= n <= len(lines): return lines[n - 1]
    for line in lines:
        if norm(line['key']) in stem or stem.endswith(norm(line['key'].split('-', 1)[1])): return line
    return None

_model = None
def transcribe(path):
    global _model
    if _model is None:
        import whisper
        _model = whisper.load_model('small.en')
    return _model.transcribe(str(path), language='en', fp16=False)['text']

def by_voice(path, sid):
    heard = norm(transcribe(path))
    scored = sorted(((difflib.SequenceMatcher(None, heard, norm(l['text'])).ratio(), l) for l in SPEAKERS[sid]['lines']), key=lambda x: -x[0])
    best, line = scored[0]
    return (line if best >= .55 else None), heard, best

def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())

def render(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    trim = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse'
    # Two passes: ffmpeg 7.1 aborts (best_input assertion) on some takes when areverse feeds loudnorm.
    with tempfile.TemporaryDirectory() as tmp:
        trimmed = Path(tmp) / 'trimmed.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-af', trim, '-c:a', 'pcm_f32le', str(trimmed)], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(trimmed), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100',
                        '-codec:a', 'libmp3lame', '-b:a', '96k', str(target)], check=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folder', type=Path)
    ap.add_argument('--speaker', choices=sorted(SPEAKERS))
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    files = sorted((p for p in args.folder.rglob('*') if p.suffix.lower() in AUDIO), key=lambda p: p.stat().st_mtime)
    chosen, skipped = {}, []
    for path in files:
        sid = speaker_of(path, args.speaker)
        if not sid: skipped.append((path, 'no speaker in --speaker, file or folder name')); continue
        line = by_name(path, sid)
        how = 'name'
        if not line:
            line, heard, score = by_voice(path, sid)
            how = f'heard "{heard}" ({score:.2f})'
            if not line: skipped.append((path, how)); continue
        chosen[line['key']] = (path, how)          # newest take wins (files sorted by time)
        print(f"{line['key']:24} <- {path.name}  [{how}]")
    for path, why in skipped: print(f"skipped {path.name}: {why}", file=sys.stderr)
    if args.dry_run: return
    manifest_path = WEB / 'voice/manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'takes': {}}
    guide_path = WEB / 'outside-assets/voice/guide-voices.json'
    guide = json.loads(guide_path.read_text())
    texts = {l['key']: l['text'] for s in LINES['speakers'] for l in s['lines']}
    for key, (path, _) in chosen.items():
        if key.startswith('guide-'):
            who, take = re.match(r'guide-(mario|samwise)-(.+)', key).groups()
            target = WEB / f'outside-assets/voice/guide-{who}-{take}.mp3'; render(path, target)
            guide.setdefault(who, {})[take] = {'file': f'outside-assets/voice/guide-{who}-{take}.mp3', 'duration': round(duration(target), 3), 'source': [path.name]}
        else:
            target = WEB / f'voice/{key}.mp3'; render(path, target)
            manifest['takes'][key] = {'file': f'{key}.mp3', 'seconds': round(duration(target), 3), 'text': texts[key], 'source': path.name}
    for key, take in manifest['takes'].items():    # lines.json text follows the takes; keep older takes in step
        take['text'] = texts.get(key, take['text'])
    manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True) + '\n')
    guide_path.write_text(json.dumps(guide, indent=1) + '\n')
    takes = sorted(manifest['takes'].items())
    cases = ''.join(f'        if (key == "{k}") return {round(v["seconds"] * 35)};\n' for k, v in takes)
    quoted = lambda s: s.replace('\\', '\\\\').replace('"', '\\"')
    said = ''.join(f'        if (key == "{k}") return "{quoted(v["text"])}";\n' for k, v in takes)
    (ROOT / 'doom-mod/actors/VoiceData.zs').write_text(
        '// Generated by scripts/import-voice-lines.py from the recorded takes in doom-web/voice/.\n'
        "// Tics(key) is a take's length, so the subtitle stays up while it plays. 0 = not recorded.\n"
        '// Said(key) is what the take says (lines.json), shown instead of the scripted text. "" = not recorded.\n'
        'class PDVoiceData\n{\n    static int Tics(String key)\n    {\n' + cases + '        return 0;\n    }\n'
        '    static String Said(String key)\n    {\n' + said + '        return "";\n    }\n}\n')
    missing = [l['key'] for s in LINES['speakers'] for l in s['lines'] if l['key'] not in manifest['takes'] and not l['key'].startswith('guide-')]
    print(f"{len(manifest['takes'])} in-game takes; {len(missing)} lines still unrecorded. Now: python3 scripts/build-doom-mod.py")

if __name__ == '__main__':
    main()
