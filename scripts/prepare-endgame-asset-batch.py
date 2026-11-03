"""Expand Jonathan's boss brief into exact-key voice jobs and individual sprite prompts."""
import argparse
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAST = ['liron', 'stuart', 'eliezer', 'hinton', 'holly', 'rob', 'dan', 'nate',
        'roman', 'beth', 'zvi', 'victoria', 'max', 'paul', 'ajeya', 'jaan',
        'nick', 'daniel', 'katja', 'yoshua']
VOICES = dict(zip(CAST, ['liron', 'stuart', 'eliezer', 'geoffrey', 'holly', 'rob',
    'dan', 'nate', 'roman', 'beth', 'zvi', 'victoria', 'max', 'paul', 'ajeya',
    'tallinn', 'bostrom', 'kokotajlo', 'katja', 'bengio']))


def clean(text):
    return re.sub(r'\s*\(kept(?:,[^)]*)?\)\s*$', '', text).strip().strip('"')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('brief', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'art/endgame-2026-10-26')
    args = parser.parse_args()
    source = args.brief.read_text()
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / 'source-brief.txt').write_text(source)
    lines, captions = [], []
    section = subsection = ''
    extra = 0

    def add(key, voice, text, when, speaker):
        lines.append(dict(key=key, file=key + '.wav', voice=voice, text=clean(text),
                          when=when, speaker=speaker, status='pending'))

    for row in source.splitlines():
        if row.startswith('## '):
            section = row[3:]
        if row.startswith('### '):
            subsection = row[4:]
        if not row.startswith('|'):
            continue
        cells = [c.strip() for c in row.strip('|').split('|')]
        if not cells:
            continue
        keymatch = re.fullmatch(r'`([^`]+)`', cells[0])
        if keymatch:
            key = keymatch[1]
            if section == 'Elon (the MCP)':
                if key == 'mcp-hurt-3':
                    captions.append(dict(key=key, text=cells[1], reason='caption only, no take'))
                else:
                    add(key, 'elon', cells[1], cells[2] if len(cells) > 2 else subsection, 'MCP')
            elif section == 'Grok':
                add(key, 'grok', cells[1], cells[2], 'Grok')
            elif section == 'Dario and Sam':
                for guide, voice, text in [('mario', 'dario', cells[2]), ('samwise', 'sam', cells[3])]:
                    add(f'guide-{guide}-{key}', voice, text, cells[1], guide)
            elif section == 'The prisoners':
                if subsection.startswith('Core'):
                    speakers = CAST
                elif subsection.startswith('Extra'):
                    # Rotate four voices per extra across all twenty, with equal participation.
                    speakers = [CAST[(extra * 4 + n) % len(CAST)] for n in range(4)]
                    extra += 1
                else:
                    continue
                for speaker in speakers:
                    add(f'{speaker}-{key}', VOICES[speaker], cells[1], cells[2], speaker)
        elif section == 'The prisoners' and len(cells) >= 4 and re.fullmatch(r'`[^`]+`', cells[1]):
            key = cells[1].strip('`')
            speaker = key.removesuffix('-fight')
            add(key, VOICES[speaker], cells[2], cells[3], speaker)

    keys = [line['key'] for line in lines]
    assert len(keys) == len(set(keys)), 'Duplicate audio filename'
    assert len(lines) == 408, len(lines)
    manifest = dict(source='source-brief.txt', synthetic=True, model='Breeze TTS 2 / MLX mixed',
                    counts=dict(collections.Counter(line['voice'] for line in lines)),
                    captions=captions, lines=lines)
    (out / 'voice-plan.json').write_text(json.dumps(manifest, indent=2) + '\n')

    # Keep one complete prompt per file, in the order the brief specifies.
    blocks = re.findall(r'```text\n(.*?)\n```', source, re.S)
    assert len(blocks) == 13, len(blocks)
    face, expressions, mouths, eyes, prop, doge, robot_subject, robot_poses, grok, hands, fight, sink, roadster = blocks
    prompts = [('mcp-face', face + '\n' + expressions, [4, 2], False),
               ('mcp-mouths', face + '\n' + mouths, [4, 2], False),
               ('mcp-eyes', face + '\n' + eyes, [3, 2], False),
               ('doge', prop + '\n' + doge, [5, 2], True),
               ('optimus-poses', robot_poses, [4, 1], True),
               ('grok-avatar', grok, [3, 1], True), ('floppy-hands', hands, [5, 1], True),
               ('sink', prop + '\n' + sink, [2, 1], True),
               ('roadster', prop + '\n' + roadster, [2, 1], True)]
    artdoc = ROOT / '.claude/worktrees/endgame-tron-finale-15dc4f/docs/LEVEL-04-ART.md'
    arttext = artdoc.read_text()
    robot_base = re.search(r'```text\n(Production directional.*?)\n```', arttext, re.S)[1]
    robot_base = robot_base[:robot_base.index('Image 1 is a likeness')] + 'Image 1 is a reference for proportions and rendering only; do not copy that man. Image 2 is a STYLE reference only.'
    prompts.append(('optimus-atlas', robot_base + '\n' + robot_subject, [8, 3], True))
    atlas_names = {'jaan': 'tallinn', 'nick': 'bostrom', 'daniel': 'kokotajlo', 'yoshua': 'bengio', 'katja': 'grace'}
    jobs = []
    for speaker in CAST + ['guide-mario', 'guide-samwise']:
        atlasname = atlas_names.get(speaker, speaker)
        if speaker.startswith('guide-'):
            atlas = ROOT / 'art/bliss-guide-v2' / ('dario-atlas.png' if speaker == 'guide-mario' else 'sam-atlas.png')
        else:
            atlas = next((p for d in ['level-04-redo-2026-10-23', 'level-04-v1', 'factory-cast-v1', 'campaign-v2']
                          if (p := ROOT / 'art' / d / (atlasname + '-atlas.png')).exists()), None)
        prompt = fight + '\nSUBJECT: ' + speaker + '. Preserve the exact face, hair, clothes, build and proportions of the attached approved atlas. Their usual prop is set aside.'
        prompts.append((speaker + '-fight', prompt, [5, 1], True))
        jobs.append(dict(file=speaker + '-fight.png', reference=str(atlas) if atlas else None))
    prompt_dir = out / 'prompts'
    prompt_dir.mkdir(exist_ok=True)
    for name, prompt, grid, transparent in prompts:
        (prompt_dir / (name + '.txt')).write_text(prompt + '\n')
    (out / 'sprite-plan.json').write_text(json.dumps(dict(
        tool='image_gen.imagegen', cast_references=jobs,
        jobs=[dict(file=name + '.png', prompt='prompts/' + name + '.txt', grid=grid,
                   transparent=transparent, optional=name in ['sink', 'roadster'], status='pending')
              for name, prompt, grid, transparent in prompts]), indent=2) + '\n')
    print(f'{len(lines)} WAV jobs, {len(captions)} caption-only key, {len(prompts)} sprite sheets: {out}')


if __name__ == '__main__':
    main()
