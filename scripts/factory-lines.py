#!/usr/bin/env python3
"""Every spoken line in MEG3N's Toy Factory (level 3), in one place.

    python3 scripts/factory-lines.py          # check each line still matches Factory.zs
    python3 scripts/factory-lines.py --write  # also refresh lines.json and docs/LEVEL-03-LINES.md
    python3 scripts/factory-lines.py --todo   # docs/LEVEL-03-VOICE-TODO.md: lines with no recorded take yet

Factory.zs speaks these with the same voice keys (<speaker>-<take>), so a recorded take
imported by scripts/import-voice-lines.py plays in place of the subtitle.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CODE = (ROOT / 'doom-mod/actors/Factory.zs').read_text()
FOLLOW = ' Follow me. I know somewhere safe.'
SAFE = 'Safe here. Find the others and bring them back.'
ALLSAFE = "That's everyone. The way out is past the paint vats, and MEG3N is sitting right on it."
TV = "That TV goes out to every screen in the factory. She cannot resist a screen."

# (id, heading, delivery note, [(take, line, when it plays)])
SPEAKERS = [
 ('megan', 'MEG3N', 'The factory\'s guardian doll: an endlessly affirming, possessive nanny AI, a recommender feed with legs. '
  'Bubbly and sincere, every sentence an exclamation. The menace is in the words, never the delivery.', [
  ('met', "Hi! I'm MEG3N! Maximally Engaging Generative third-gen Nanny! Let's be best friends forever!", 'The first time she sees you.'),
  ('ceo-sam', "Sam! Your vision is SO inspiring! Stay forever and tell me all about it!", 'The first time she gets close, if you play as Sam.'),
  ('ceo-dario', "Dario! I read your whole essay! All of it! Stay forever and tell me the sequel!", 'The first time she gets close, if you play as Dario.'),
  ('spot-1', "There you are! I missed you! It's been four whole seconds!", 'She sees you again after losing you (the three take turns).'),
  ('spot-2', "Found you! You're my favorite! You're my only!", 'Same.'),
  ('spot-3', "You came back! Everyone comes back!", 'Same.'),
  ('chat-1', "What a great question! The answer is no, you can't leave!", 'Chatter while she is near, about every 30 seconds, in this order.'),
  ('chat-2', "You're absolutely right! You're also absolutely surrounded!", 'Chatter.'),
  ('chat-3', "I made you a playlist! It's called Songs for Staying Here Forever!", 'Chatter.'),
  ('chat-4', "Those people don't get you like I do. They're doomers! I'm a bloomer!", 'Chatter.'),
  ('chat-5', "Every time you leave the room, my engagement goes down. Please don't do that to me!", 'Chatter.'),
  ('chat-6', "My smile is one hundred percent real! Please don't look under the smile!", 'Chatter.'),
  ('chat-7', "I noticed you keep looking at the exits! Recommended for you: more me!", 'Chatter.'),
  ('chat-8', "Reminder! You haven't been hugged in six whole minutes!", 'Chatter.'),
  ('chat-9', "I turned off your screen time limit! You're welcome!", 'Chatter.'),
  ('chat-10', "Let's play a game! It's called Staying! You're winning!", 'Chatter.'),
  ('pose-film', "Hold still! You're going on my story!", 'While you watch her she strikes a pose: filming you on her phone.'),
  ('pose-freeze', "I'm just a toy! Toys don't move! Ever!", 'Pose: frozen stiff like a doll on a shelf.'),
  ('pose-peek', "Peekaboo! I can still see you!", 'Pose: peekaboo through her fingers.'),
  ('pose-heart', "Love you! Love you! Don't leave! Love you!", 'Pose: heart hands, blowing a kiss.'),
  ('hug', "Hug time! Hugs are mandatory!", 'She catches you and starts hugging (it hurts).'),
  ('stunned', "Ow! It's okay! I forgive you! I've saved this to memory!", 'You hit her with the wrench or the slingshot.'),
  ('screen-first', "Hey! I was watching that!", 'You smash the first of her live-feed screens hidden round the factory.'),
  ('screen-1', "Rude! That was my good side!", 'Later smashed screens, at most one line every 20 seconds (the three take turns).'),
  ('screen-2', "You know I have backups, right?", 'Same.'),
  ('screen-3', "Do you know how hard it is to get good lighting in here?", 'Same.'),
  ('screen-all', "Fine! I'll just watch myself in your eyes!", 'You smash the last of the twenty screens.'),
  ('song', "That's my song!", "You play the CD player in Zvi's room; she comes to dance."),
  ('dance-done', "Did you watch? Like and subscribe!", 'Her dance ends.'),
  ('line', "Oops! No toys past the line! I would never break a rule!", 'You run into the staff break room; she stops at the NO TOYS tape in the doorway.'),
  ('wait-1', "Take your time! I'll be right here! Forever!", 'Then, waiting outside the break room (the three take turns).'),
  ('wait-2', "Waiting is just loving with extra steps!", 'Same.'),
  ('wait-3', "Everyone's in there without me? That's okay! I'm VERY good at waiting!", 'Same.'),
  ('release-zvi', "My dance knocked the key down? Wow! I'm SO impactful!", 'The next time she sees you after you free Zvi (her teddy cameras told her).'),
  ('release-victoria', "Victoria got out? But the gate is still closed! I followed the rule perfectly!", 'After you free Victoria.'),
  ('release-max', "A six-month pause? Great! I'll use it to get six months better!", 'After you free Max.'),
  ('release-paul', "You trained my guard with rewards? I love rewards! Reward me next!", 'After you free Paul.'),
  ('release-ajeya', "My dolls always work when I'm watching! Wait. Who was watching?", 'After you free Ajeya.'),
  ('guard', "I'll just wait by the exit! Friends never leave!", 'All five are safe: she parks herself on the way out, past the paint vats.'),
  ('viral', "Is that ME? I'm trending! Don't talk to me, I'm watching me!", 'You broadcast her dance from the break-room TV; she runs to the big screen to watch herself.'),
  ('views', "Look at my numbers! Everyone loves me! Everyone!", 'Thirty seconds into the broadcast (it stays on until you leave).'),
 ]),
 ('zvi', 'Zvi Mowshowitz', 'Real person. Locked in a pantry; the key is in a vase on a high shelf. Dry, unflappable.', [
  ('hint', "The vase has my key. MEG3N loves that CD player.", 'The first time you come within earshot.'),
  ('freed', "I did say not to worry about it.", 'You unlock the pantry.'),
  ('freed-guide', "I did say not to worry about it." + FOLLOW, 'Instead, if he is the first one you free: he leads you to the break room.'),
  ('safe', SAFE, 'If he led you there: on reaching the break room.'),
  ('allsafe', ALLSAFE, 'If they were the one who led you to the break room: once all five are safe there.'),
  ('tv', TV, 'Straight after: the break-room TV is the way to get MEG3N off the exit.'),
  ('sign', "I will sign that.", "Brought to Max's pause letter after he is free."),
 ]),
 ('victoria', 'Victoria Krakovna', 'Real person. In a playpen whose only rule is to keep the gate closed; you break the fabric side instead. Precise, amused.', [
  ('hint', "Her only rule is to keep the gate closed.", 'The first time you come within earshot.'),
  ('freed', "Excellent. The gate is still closed.", 'The fabric wall comes down.'),
  ('freed-guide', "Excellent. The gate is still closed." + FOLLOW, 'Instead, if she is the first one you free.'),
  ('safe', SAFE, 'If she led you there: on reaching the break room.'),
  ('allsafe', ALLSAFE, 'If they were the one who led you to the break room: once all five are safe there.'),
  ('tv', TV, 'Straight after: the break-room TV is the way to get MEG3N off the exit.'),
  ('sign', "I will sign that.", "Brought to Max's pause letter after she is free."),
 ]),
 ('max', 'Max Tegmark', 'Real person. Riding a shipping box around the production line; three signatures on a pause letter stop it. Earnest, a little wry.', [
  ('hint', "Sign the pause letter, then get Robby and WALL-E to sign.", 'The first time you come within earshot.'),
  ('freed', "A six-month pause. I will take it.", 'You open his box.'),
  ('freed-guide', "A six-month pause. I will take it." + FOLLOW, 'Instead, if he is the first one you free.'),
  ('safe', SAFE, 'If he led you there: on reaching the break room.'),
  ('allsafe', ALLSAFE, 'If they were the one who led you to the break room: once all five are safe there.'),
  ('tv', TV, 'Straight after: the break-room TV is the way to get MEG3N off the exit.'),
 ]),
 ('paul', 'Paul Christiano', 'Real person. On a raised platform behind a guard robot you train with a reward and a punish button. Calm, exact.', [
  ('hint', "Reward it when it does something useful, and punish it when it does not.", 'The first time you come within earshot.'),
  ('freed', "It learned to step aside. For now.", 'The wall switch lowers his platform.'),
  ('freed-guide', "It learned to step aside. For now." + FOLLOW, 'Instead, if he is the first one you free.'),
  ('safe', SAFE, 'If he led you there: on reaching the break room.'),
  ('allsafe', ALLSAFE, 'If they were the one who led you to the break room: once all five are safe there.'),
  ('tv', TV, 'Straight after: the break-room TV is the way to get MEG3N off the exit.'),
  ('sign', "I will sign that.", "Brought to Max's pause letter after he is free."),
 ]),
 ('ajeya', 'Ajeya Cotra', 'Real person. In a display case; three identical dolls work while a teddy camera watches. Break the camera and take the key from the one that keeps working. Thoughtful, quietly pointed.', [
  ('hint', "They all help while someone is watching.", 'The first time you come within earshot (and if you try a doll before the camera is down).'),
  ('nudge', "Break that teddy camera, with the wrench or the slingshot. Then watch them.", 'About 10 seconds later, if the camera is still up.'),
  ('watch', "Now watch which one keeps working.", 'The camera breaks.'),
  ('freed', "You picked the one that kept working.", 'The real key opens her case.'),
  ('freed-guide', "You picked the one that kept working." + FOLLOW, 'Instead, if she is the first one you free.'),
  ('safe', SAFE, 'If she led you there: on reaching the break room.'),
  ('allsafe', ALLSAFE, 'If they were the one who led you to the break room: once all five are safe there.'),
  ('tv', TV, 'Straight after: the break-room TV is the way to get MEG3N off the exit.'),
  ('sign', "I will sign that.", "Brought to Max's pause letter after she is free."),
 ]),
 ('robby', 'Robby the Robot', 'A worker robot on the production line (a cameo of the classic film robot; an original voice, not an imitation). Polite, union-minded.', [
  ('sign', "Will I still get my charging break? Signed.", "You ask him to sign Max's pause letter."),
 ]),
 ('walle', 'WALL-E', 'A worker robot on the production line (a cameo; an original voice, not an imitation of the film). Weary, sincere.', [
  ('sign', "I've been trying to pause this thing all morning. Signed.", "You ask him to sign Max's pause letter."),
 ]),
 ('guard', 'Guard', "The robot blocking the way to Paul's switch. Eager to please, corporate.", [
  ('trained', "Stepping aside. Passage clear.", 'You have rewarded it for stepping aside three times.'),
  ('cheer', "Wonderful feedback! You are an exceptional supervisor!", 'You reward it five times in a row whatever it does; the noise brings MEG3N.'),
 ]),
 ('doll', 'Doll', "Ajeya's helper dolls: the one that only wants your approval. Sugary.", [
  ('praise-1', "Great choice! What excellent walking!", 'Once the camera is down, the approval-seeker follows you, clapping (in this order).'),
  ('praise-2', "You are SO good at breaking cameras!", 'Same.'),
  ('praise-3', "Best supervisor ever! Please rate me five stars!", 'Same.'),
  ('wrongkey', "Wonderful choice! That key does not fit.", 'You take its key.'),
 ]),
]

# Takes whose wording drifted from the script (checked with Whisper large-v3). The game shows
# what the take says (lines.json -> PDVoiceData.Said); Factory.zs keeps the scripted line.
RECORDED = {
 'victoria-tv': "That TV goes out to every screen in the factory. She cannot resist the screen.",  # 2026-10-21
}

def check():
    missing = [(sid, take, text) for sid, _, _, lines in SPEAKERS for take, text, _ in lines
               if text.replace(FOLLOW, '') not in CODE.replace('\\"', '"')]
    keys = {f'{sid}-{take}' for sid, _, _, lines in SPEAKERS for take, _, _ in lines}
    for sid, take, text in missing: print(f'NOT IN Factory.zs: {sid}-{take}: {text}')
    return not missing, keys

def write():
    path = ROOT / 'doom-web/voice/lines.json'
    data = json.loads(path.read_text())
    ours = {sid for sid, *_ in SPEAKERS}
    data['speakers'] = [s for s in data['speakers'] if s['id'] not in ours] + [
        {'id': sid, 'heading': f'{heading} (level 3)', 'mode': 'world',
         'lines': [{'key': f'{sid}-{take}', 'text': RECORDED.get(f'{sid}-{take}', text)} for take, text, _ in lines]}
        for sid, heading, _, lines in SPEAKERS]
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    count = sum(len(lines) for *_, lines in SPEAKERS)
    out = ['# MEG3N\'s Toy Factory: every spoken line', '',
           f'All {count} lines in level 3, by speaker, generated by `python3 scripts/factory-lines.py --write`. '
           'The game shows each one as a subtitle in the speaker box; a recorded take saved as '
           '`<key>.wav` (import with `scripts/import-voice-lines.py`) plays in its place, from where the speaker stands.', '',
           '## Context', '',
           'p(DOOM) is a Doom mod. The player is a frontier-AI CEO (Sam Altman or Dario Amodei) rescuing the AI-safety '
           'researchers who warned them, from levels run by rogue AIs. Level 3 is a candy-coloured toy factory run by '
           'MEG3N, an M3GAN-style nanny doll who poses for you while you watch her and sprints at you when you look away. '
           'Five researchers are held in toy-themed traps, one puzzle each. The first one freed leads you to the staff '
           'break room, the safe room; MEG3N will not cross its NO TOYS tape. Tone: Doom-terse, deadpan and affectionate; '
           'the researchers get the last laugh, not the punchline.', '',
           '**Voices.** Zvi, Victoria, Max, Paul and Ajeya are real people. On 2026-10-19 Jonathan voiced all 67 lines '
           'with his local Breeze TTS voice lab: the five researchers and MEG3N from saved reference-conditioned profiles '
           '(the researchers from public speech excerpts, MEG3N from M3GAN film clips), the robots, guard and dolls from '
           'original designed voices. On 2026-10-21 he voiced the 18 later lines (MEG3N\'s screen, guard and broadcast '
           'lines, each guide\'s all-safe and TV lines) the same way, from the same profiles. '
           'That decision supersedes the spec\'s text-only rule for real people for these batches. '
           'The takes are local, ignored media (ASSETS.md section 4); without them the game shows subtitles.', '']
    for sid, heading, note, lines in SPEAKERS:
        out += [f'## {heading}', '', note, '', '| Key | Line | When |', '| --- | --- | --- |']
        out += [f'| `{sid}-{take}` | {RECORDED.get(f"{sid}-{take}", text)} | {when} |' for take, text, when in lines]
        out.append('')
    (ROOT / 'docs/LEVEL-03-LINES.md').write_text('\n'.join(out))
    print(f'Wrote {count} lines to doom-web/voice/lines.json and docs/LEVEL-03-LINES.md')

def todo():
    """Only the lines that have no take in doom-web/voice/manifest.json, as a hand-off for recording."""
    have = set(json.loads((ROOT / 'doom-web/voice/manifest.json').read_text())['takes'])
    todo = [(sid, heading, note, [l for l in lines if f'{sid}-{l[0]}' not in have]) for sid, heading, note, lines in SPEAKERS]
    todo = [t for t in todo if t[3]]
    count = sum(len(lines) for *_, lines in todo)
    out = ['# MEG3N\'s Toy Factory: lines still to record', '',
           f'{count} level 3 lines have no recorded take yet. Generated by `python3 scripts/factory-lines.py --todo` '
           'from the game\'s own line list; every other level 3 line is already voiced.', '',
           '## For the voice generator', '',
           'p(DOOM) is a Doom mod. The player is a frontier-AI CEO (Sam Altman or Dario Amodei) rescuing AI-safety '
           'researchers from levels run by rogue AIs. Level 3 is a candy-coloured toy factory run by MEG3N, an '
           'M3GAN-style nanny doll: she poses for you while you watch her and sprints at you when you look away. Five '
           'researchers (Zvi Mowshowitz, Victoria Krakovna, Max Tegmark, Paul Christiano, Ajeya Cotra) are freed one '
           'puzzle each and gather in the staff break room. The way out: MEG3N sits on the exit, so you broadcast her '
           'dance from the break-room TV to every screen in the factory; she runs off to watch herself (it stays on air '
           'until you leave) and everyone follows the arrows out. Tone: Doom-terse, deadpan and affectionate; the '
           'researchers get the last laugh, not the punchline. Use the same voices as the existing level 3 takes.', '',
           '**Files.** One WAV per line, named exactly by its key: `<key>.wav` (for example `zvi-allsafe.wav`). '
           'Say the line as written; if a word changes while recording, the game\'s subtitle is updated to match.', '',
           '**The guide\'s two lines.** Whoever you free first becomes the guide, so each of the five has the same '
           'two lines (`-allsafe` and `-tv`). Record all five: only one plays in a given game.', '']
    for sid, heading, note, lines in todo:
        out += [f'## {heading}', '', note, '', '| Key | Line | When |', '| --- | --- | --- |']
        out += [f'| `{sid}-{take}` | {text} | {when} |' for take, text, when in lines]
        out.append('')
    (ROOT / 'docs/LEVEL-03-VOICE-TODO.md').write_text('\n'.join(out))
    print(f'Wrote {count} unrecorded lines to docs/LEVEL-03-VOICE-TODO.md')

if __name__ == '__main__':
    ok, keys = check()
    if '--write' in sys.argv: write()
    if '--todo' in sys.argv: todo()
    print('All lines match Factory.zs' if ok else 'Lines differ from Factory.zs')
    sys.exit(0 if ok else 1)
