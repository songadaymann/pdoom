"""Generate THE BOSS's recorded sound effects with Stable Audio Open, keep the best takes, and import them.

    <voice lab>/runtime/stable-audio-open/.venv/bin/python -I scripts/generate-endgame-sfx.py [--only bark,yelp] [--import-only]

The arena's hum, fans and ship engines are synthesized live in prototypes/endgame/kit.ts; this makes the
sounds a synth does badly: the doges' barks and yelps, the rocket a bonked doge rides, a sink smashing,
and the blast. Stable Audio Open 1.0 (Stability AI Community License: free under $1M a year in revenue;
outputs are ours; trained on CC0, CC-BY and CC Sampling+ recordings) runs locally on the GPU. It's gated:
accept its terms on Hugging Face and run `uvx hf auth login` once. Each effect gets several takes; LAION
CLAP (Apache-2.0) scores each against its description and against things it mustn't be (music, talking),
and the best are kept. Originals, seeds and scores go to art/endgame-sfx-2026-10-27/ in the main checkout
(ignored); the kept takes are trimmed, peak-normalized and encoded into ignored
doom-web/local/endgame/sfx/ with a manifest the prototype reads. A name with no takes stays synthesized.
"""
import argparse, hashlib, json, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
ART = Path('/Users/temp/Projects/pdoom/art/endgame-sfx-2026-10-27')
OUT = ROOT / 'doom-web/local/endgame/sfx'
MODEL = 'stabilityai/stable-audio-open-1.0'
NEGATIVE = 'music, melody, singing, speech, people talking, low quality, distorted, reverb, echo'
NOT = ['music', 'a person talking', 'silence', 'static noise']
# how close to its prompt a take must be to be kept (CLAP's raw score; 2026-10-27's growls, at 4-6, were
# scattered clicks, not growls, and stay synthesized)
MATCH_MIN = 8
# name: (prompt, seconds generated, takes made, takes kept, longest kept take in seconds)
SFX = {
    'bark': ('A small shiba inu dog barks twice, sharp yappy barks, close up, dry studio recording', 2.5, 10, 6, 1.4),
    'yelp': ('A small dog yelps once in surprise, a short high yelp, close up, dry studio recording', 2, 6, 3, .8),
    'growl': ('A small dog growls and snarls playfully, close up, dry studio recording', 2.5, 5, 3, 1.4),
    'rocket': ('A small firework rocket launches with a fizzing whoosh and crackling sparks', 4, 5, 2, 3),
    'sink': ('A heavy porcelain sink falls and smashes on a concrete floor, ceramic shattering', 3, 6, 3, 2.2),
    'blast': ('A huge explosion, deep booming blast with rumbling and falling metal debris', 8, 4, 2, 7),
}


class Gaussian:
    """Fresh Gaussian noise for each step of the SDE sampler, in place of diffusers' Brownian tree. On the
    Mac's GPU (no float64) the tree is asked for a step a hair outside its range and recurses until Python
    gives up. Its increments are Gaussian and independent anyway; the tree only makes runs repeatable
    across step counts."""
    def __init__(self, x, sigma_min, sigma_max, seed=None, transform=None):
        import torch
        self.shape, self.gen = x.shape, torch.Generator('cpu').manual_seed(seed if isinstance(seed, int) else 0)

    def __call__(self, sigma, sigma_next):
        import torch
        return torch.randn(self.shape, generator=self.gen)


def generate(names):
    import torch
    import diffusers.schedulers.scheduling_cosine_dpmsolver_multistep as cosine
    from diffusers import StableAudioPipeline
    cosine.BrownianTreeNoiseSampler = Gaussian
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    pipe = StableAudioPipeline.from_pretrained(MODEL, torch_dtype=torch.float32).to(device)
    rate = pipe.vae.sampling_rate
    made = {}
    for name in names:
        prompt, sec, takes, _, _ = SFX[name]
        (ART / name).mkdir(parents=True, exist_ok=True)
        made[name] = []
        # up to five takes a call, from one seed
        for first in range(0, takes, 5):
            seed, n = 1000 + first, min(5, takes - first)
            audios = pipe(prompt, negative_prompt=NEGATIVE, num_inference_steps=100, guidance_scale=7, audio_end_in_s=sec,
                          num_waveforms_per_prompt=n, generator=torch.Generator('cpu').manual_seed(seed)).audios
            for j, audio in enumerate(audios):
                path = ART / name / f'{name}-{seed}-{j}.wav'
                sf.write(path, audio.T.float().cpu().numpy(), rate)
                made[name].append({'file': str(path.relative_to(ART)), 'seed': seed, 'in_batch': j})
            print(f'{name} {first + n}/{takes}', flush=True)
    return made


def score(plan):
    """CLAP on each take: whether it's what its prompt says rather than music, talk, silence or hiss (`clap`,
    a gate: nearly every take passes), and how close it is to the prompt (`match`, which ranks them)."""
    import torch, torchaudio
    from transformers import ClapModel, ClapProcessor
    model, proc = ClapModel.from_pretrained('laion/clap-htsat-unfused'), ClapProcessor.from_pretrained('laion/clap-htsat-unfused')
    for name, takes in plan.items():
        texts = [SFX[name][0]] + NOT
        for t in takes:
            wav, rate = sf.read(ART / t['file'], always_2d=True)
            mono = torchaudio.functional.resample(torch.tensor(wav.mean(1), dtype=torch.float32), rate, 48000).numpy()
            try:
                inputs = proc(text=texts, audio=[mono], sampling_rate=48000, return_tensors='pt', padding=True)
            except TypeError:
                inputs = proc(text=texts, audios=[mono], sampling_rate=48000, return_tensors='pt', padding=True)
            with torch.no_grad():
                logits = model(**inputs).logits_per_audio[0]
            t['clap'], t['match'] = round(logits.softmax(-1)[0].item(), 3), round(logits[0].item(), 2)
        takes.sort(key=lambda t: (t['clap'] < .5, -t['match']))
        print(name, [t['match'] for t in takes], flush=True)


def encode(plan):
    """The kept takes: from the moment it hits (some lead in with a hum or blips) to where it dies away,
    peak at -3 dBFS, faded out, mono mp3."""
    OUT.mkdir(parents=True, exist_ok=True)
    clips = {}
    for name, takes in plan.items():
        keep, longest = SFX[name][3], SFX[name][4]
        clips[name] = []
        for t in [t for t in takes if t['match'] >= MATCH_MIN][:keep]:
            wav, rate = sf.read(ART / t['file'], always_2d=True)
            x = wav.mean(1)
            peak, win = np.abs(x).max() or 1, int(rate * .01)
            rms = np.sqrt(np.mean(x[:len(x) // win * win].reshape(-1, win) ** 2, axis=1))
            # the hit, found in the highs (a difference), so a low hum leading in doesn't count
            hi = np.abs(np.diff(x, prepend=x[0]))[:len(x) // win * win].reshape(-1, win).mean(axis=1)
            a = max(0, (np.flatnonzero(hi > hi.max() * .15)[0] - 1) * win)
            b = min(len(x), (np.flatnonzero(rms > rms.max() * .01)[-1] + 1) * win + int(rate * .08), a + int(rate * longest))
            x = x[a:b] / peak * .708
            fade = min(len(x), int(rate * .06))
            x[-fade:] *= np.linspace(1, 0, fade)
            mp3 = Path(t['file']).with_suffix('.mp3').name
            with tempfile.TemporaryDirectory() as tmp:
                sf.write(Path(tmp) / 'take.wav', x, rate)
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(Path(tmp) / 'take.wav'), '-ac', '1', '-b:a', '96k', str(OUT / mp3)], check=True)
            clips[name].append(mp3)
    manifest = OUT / 'manifest.json'
    old = json.loads(manifest.read_text())['clips'] if manifest.exists() else {}
    merged = {n: f for n, f in {**old, **clips}.items() if f}
    manifest.write_text(json.dumps({'source': str(ART), 'model': MODEL, 'clips': merged}, indent=1) + '\n')
    print(f'{sum(map(len, clips.values()))} takes -> {manifest.relative_to(ROOT)}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated names: ' + ','.join(SFX))
    ap.add_argument('--import-only', action='store_true', help='re-score and re-encode the takes already made')
    args = ap.parse_args()
    names = args.only.split(',') if args.only else list(SFX)
    if unknown := set(names) - set(SFX):
        sys.exit(f'unknown: {", ".join(sorted(unknown))}')
    record = ART / 'takes.json'
    plan = json.loads(record.read_text()) if record.exists() else {}
    if args.import_only:
        plan = {n: plan[n] for n in names if n in plan}
    else:
        plan.update(generate(names))
    score(plan)
    for takes in plan.values():
        for t in takes:
            t['sha256'] = hashlib.sha256((ART / t['file']).read_bytes()).hexdigest()
    ART.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps({**(json.loads(record.read_text()) if record.exists() else {}), **plan}, indent=1) + '\n')
    (ART / 'README.txt').write_text(
        'THE BOSS sound effects, generated 2026-10-27 by scripts/generate-endgame-sfx.py in the p(DOOM) repo\n'
        f'with {MODEL} (Stability AI Community License) on this Mac; takes.json has each take\'s prompt\n'
        'name, seed, LAION CLAP score and sha256. Prompts are in the script.\n')
    encode({n: plan[n] for n in names if n in plan})
