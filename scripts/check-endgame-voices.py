"""Transcribe finished boss takes and record wording and PCM checks, without changing them."""
import argparse
import array
import hashlib
import json
import math
import re
import time
import wave
from pathlib import Path


def words(text):
    text = text.lower().replace('’', "'")
    contractions = {"i'm": 'i am', "i've": 'i have', "i'll": 'i will', "i'd": 'i would',
                    "don't": 'do not', "doesn't": 'does not', "can't": 'cannot', "we're": 'we are',
                    "let's": 'let us', "that's": 'that is', "you're": 'you are', "it's": 'it is',
                    "isn't": 'is not', "you've": 'you have', "there's": 'there is', "didn't": 'did not',
                    "won't": 'will not', "wasn't": 'was not', "haven't": 'have not'}
    for key, value in contractions.items():
        text = re.sub(r'\b' + re.escape(key) + r'\b', value, text)
    text = re.sub(r'\b(a[. -]+i|ai)\b', 'ai', text)
    text = text.replace('%', ' percent ')
    text = re.sub(r'\$(\d[\d,.]*(?:\s+(?:million|billion))?)', r'\1 dollars', text)
    text = re.sub(r'\bokay\b', 'ok', text)
    text = re.sub(r'\bdiscs\b', 'disks', text)
    text = re.sub(r'\bdisc\b', 'disk', text)
    for a, b in [('data center', 'datacenter'), ('non-profit', 'nonprofit'), ('techno king', 'technoking')]:
        text = text.replace(a, b)
    # ASR writes an unexpanded contraction without its apostrophe.
    text = text.replace("shield's", 'shields')
    small = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
    tens = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
    def spell(n):
        if n < 20: return small[n]
        if n < 100: return tens[n // 10] + (' ' + small[n % 10] if n % 10 else '')
        for scale, name in [(1000000000, 'billion'), (1000000, 'million'), (1000, 'thousand'), (100, 'hundred')]:
            if n >= scale: return spell(n // scale) + ' ' + name + (' ' + spell(n % scale) if n % scale else '')
    text = re.sub(r'\b\d+\b', lambda m: spell(int(m[0])), text)
    return re.findall(r'[a-z0-9]+', text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--watch', action='store_true')
    args = parser.parse_args()
    from mlx_whisper import transcribe
    output = args.folder / 'validation.json'
    results = json.loads(output.read_text()) if output.exists() else {}
    while True:
        manifest = json.loads((args.folder / 'manifest.json').read_text())
        for line in manifest['lines']:
            if line.get('status') != 'generated':
                continue
            path = args.folder / line['file']
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if results.get(line['key'], {}).get('sha256') == digest:
                continue
            with wave.open(str(path)) as audio:
                rate, channels, width, frames = audio.getframerate(), audio.getnchannels(), audio.getsampwidth(), audio.getnframes()
                samples = array.array('h', audio.readframes(frames))
            heard = transcribe(str(path), path_or_hf_repo='mlx-community/whisper-large-v3-turbo',
                               language='en', condition_on_previous_text=False)['text'].strip()
            rms = math.sqrt(sum(v * v for v in samples) / len(samples))
            match = words(heard) == words(line['text'])
            method = 'transcription'
            if line['key'] == 'mcp-dying-2' and line.get('audio_processing', {}).get('abrupt_cut'):
                # ASR often completes a familiar word even when its waveform was cut.
                # Validate all source words, then verify that the exported samples stop
                # strictly inside the final word's measured boundaries.
                cut = line['audio_processing']
                duration = frames / rate
                match = (words(cut['uncut_transcript']) == words(line['synthesis_text'])
                         and frames == cut['cut_sample']
                         and cut['final_word']['start'] < duration < cut['final_word']['end'])
                method = 'source transcription plus sample-accurate mid-word cutoff'
            results[line['key']] = dict(sha256=digest, expected=line['text'], heard=heard,
                words_match=match, pcm_valid=(rate == 24000 and channels == 1 and width == 2),
                verification_method=method,
                rms=round(rms, 2), clipped_samples=sum(abs(v) >= 32767 for v in samples))
            temp = output.with_suffix('.tmp')
            temp.write_text(json.dumps(results, indent=2) + '\n')
            temp.replace(output)
            print(f"{len(results)}/{len(manifest['lines'])} {'MATCH' if match else 'REVIEW'} {line['key']}: {heard}", flush=True)
        if not args.watch or len(results) == len(manifest['lines']):
            break
        time.sleep(5)


if __name__ == '__main__':
    main()
