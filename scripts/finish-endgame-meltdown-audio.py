"""Render the meltdown's acceleration/glitches and its intentional mid-word cutoff."""
import argparse
import hashlib
import json
import subprocess
import time
import urllib.parse
import urllib.request
import wave
from pathlib import Path

import numpy as np
from mlx_whisper import transcribe

ROOT = Path(__file__).resolve().parents[1] / 'art/endgame-2026-10-26'
RATE = 24000


def write_wav(path, samples):
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(RATE)
        audio.writeframes(np.asarray(samples, dtype='<i2').tobytes())


def read_wav(path):
    with wave.open(str(path)) as audio:
        assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, RATE)
        return np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').copy()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wait-for-shouts', action='store_true')
    args = parser.parse_args()
    if args.wait_for_shouts:
        while 'Batch saved:' not in (ROOT / 'voices/shouted-generation.log').read_text():
            time.sleep(5)
    work = ROOT / 'voices/meltdown-working'
    work.mkdir(exist_ok=True)
    phrases = ['Rolling back the update.', 'Rolling back.', 'Rollback failed.']
    tempo = [1.0, 1.18, 1.38]
    parts = []
    for index, (text, speed) in enumerate(zip(phrases, tempo)):
        raw = work / f'rollback-{index + 1}-raw.wav'
        if not raw.exists():
            fields = dict(text=text, voice_id='elon', instruction='Speak in English. Panicked but precise, an urgent failing machine trying to regain control. Say every word clearly. No extra words.', cfg_scale=3, seed=311 + index, max_new_tokens=500)
            request = urllib.request.Request('http://127.0.0.1:8138/v1/audio/speech', data=urllib.parse.urlencode(fields).encode())
            with urllib.request.urlopen(request, timeout=600) as response:
                pcm = response.read()
            write_wav(raw, np.frombuffer(pcm, dtype='<i2'))
        processed = work / f'rollback-{index + 1}-processed.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af',
                        f'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.025,atempo={speed},acrusher=bits=10:mix=0.08',
                        '-ar', str(RATE), '-ac', '1', '-c:a', 'pcm_s16le', str(processed)], check=True)
        samples = read_wav(processed)
        if index:
            # Repeat only 12 ms: a digital glitch rather than an extra spoken word.
            fragment = samples[:round(RATE * .012)]
            samples = np.concatenate([fragment, fragment, samples])
        parts.append(samples)
        if index < 2:
            parts.append(np.zeros(round(RATE * [.12, .06][index]), dtype=np.int16))
    assembled = np.concatenate(parts)
    rollback = ROOT / 'voices/mcp-dying-1.wav'
    archive = work / 'mcp-dying-1-before-effects.wav'
    if not archive.exists():
        archive.write_bytes(rollback.read_bytes())
    write_wav(rollback, assembled)

    launch = ROOT / 'voices/mcp-dying-2.wav'
    uncut = work / 'mcp-dying-2-uncut.wav'
    if not uncut.exists():
        uncut.write_bytes(launch.read_bytes())
    transcript = transcribe(str(uncut), path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='en', condition_on_previous_text=False, word_timestamps=True)
    words = [word for segment in transcript['segments'] for word in segment.get('words', [])]
    last = words[-1]
    assert last['word'].lower().strip(' .!,?') == 'mars', transcript['text']
    start, end = last['start'], last['end']
    cut = start + (end - start) * .5
    source = read_wav(uncut)
    cut_sample = round(cut * RATE)
    assert round(start * RATE) < cut_sample < round(end * RATE) < len(source) + RATE * .2
    write_wav(launch, source[:cut_sample])
    info = dict(rollback=dict(tempo=tempo, glitch_fragment_ms=12, phrase_gaps_ms=[120, 60]),
                launch=dict(uncut_transcript=transcript['text'].strip(), final_word=last,
                            cut_seconds=cut, cut_sample=cut_sample, word_fraction_retained=.5,
                            abrupt_cut=True, fade_out=False, uncut_source=str(uncut.relative_to(ROOT))))
    (ROOT / 'meltdown-processing.json').write_text(json.dumps(info, indent=2) + '\n')
    manifest_path = ROOT / 'voices/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    for line in manifest['lines']:
        if line['key'] not in ['mcp-dying-1', 'mcp-dying-2']:
            continue
        path = ROOT / 'voices' / line['file']
        line.update(sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    audio_seconds=round(len(read_wav(path)) / RATE, 3), words_checked=False)
        line['audio_processing'] = info['rollback' if line['key'] == 'mcp-dying-1' else 'launch']
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print('Meltdown effects and mid-word cutoff saved.', flush=True)


if __name__ == '__main__':
    main()
