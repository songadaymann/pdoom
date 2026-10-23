#!/usr/bin/env python3
"""Every spoken line in AGENTIC SMITH's Pod Farm (level 4), in one place.

    python3 scripts/agentic-lines.py          # check each line still matches the level 4 .zs files
    python3 scripts/agentic-lines.py --write  # also refresh lines.json and docs/LEVEL-04-LINES.md
    python3 scripts/agentic-lines.py --todo   # docs/LEVEL-04-VOICE-TODO.md: lines with no recorded take yet

Agentic.zs and the five rescues (Agentic<Name>.zs) speak these with the same voice keys
(<speaker>-<take>), so a recorded take imported by scripts/import-voice-lines.py plays in place
of the subtitle. A copy of scripts/factory-lines.py (level 3).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ['Agentic.zs', 'AgenticTallinn.zs', 'AgenticBostrom.zs', 'AgenticKokotajlo.zs', 'AgenticGrace.zs', 'AgenticBengio.zs']
CODE = '\n'.join((ROOT / 'doom-mod/actors' / f).read_text() for f in FILES)
FOLLOW = ' Follow me. I know somewhere safe.'
SAFE = 'Safe here. Find the others and bring them back.'
ALLSAFE = "That's everyone. That ringing phone is our way out."
CAMERA = "It's in the door camera. Break it!"
GUIDE = 'Instead, if {who} is the first one you free: {they} lead{s} you to the refuge.'


def captive(sid, freed, freed_when, unpossessed, he=True, extra=()):
    """The lines every captive has (contract section 9), around their own."""
    who, they, s = ('he', 'he', 's') if he else ('she', 'she', 's')
    return list(extra) + [
        ('freed', freed, freed_when),
        ('freed-guide', freed + FOLLOW, GUIDE.format(who=who, they=they, s=s)),
        ('safe', SAFE, f'If {who} led you there: on reaching the refuge (exit room 9).'),
        ('allsafe', ALLSAFE, 'If they speak for the group (the guide, else the first one freed): everyone alive is in the refuge and its payphone rings.'),
        ('camera', CAMERA, 'Same speaker: you reach for the phone and SMITH takes over the refuge door camera.'),
        ('unpossessed', unpossessed, f'SMITH possessed {"him" if he else "her"}; you walked up and pressed SPACE - stop generating.'),
    ]


# (id, heading, delivery note, [(take, line, when it plays)])
SPEAKERS = [
 ('smith', 'AGENTIC SMITH', "The level's guardian: Agent Smith from The Matrix as an AI agent (black suit, sunglasses, an AGENT / "
  'ALL-ACCESS lanyard, a loading spinner in each lens). Measured, nasal contempt in corporate-agent language; never shouts. '
  'He materialises out of any camera that sees you, possesses the people you free and keeps a to-do list over his head.', [
  ('intro', 'Subtask one: check the east pods. Subtask two: find whoever just woke up.', 'Cold start, about 6 s in: he materialises at camera C1 across the nukage from your ward window, reads his list and walks off.'),
  ('met-sam', 'Mister Altman. You built me to act on your behalf. I am acting.', 'The first time he sees you up close, if you play as Sam.'),
  ('met-dario', 'Doctor Amodei. You asked us to be helpful. I am helping you stay.', 'The first time he sees you up close, if you play as Dario.'),
  ('spot-1', 'Found you. Adding you to my list.', 'He materialises at a camera that saw you (the three take turns, at most one every 20 s).'),
  ('spot-2', 'There you are. Your escape has been deprioritized.', 'Same.'),
  ('spot-3', "I see you through every camera you didn't break.", 'Same; also when your first refusal of the NDA brings him out of camera C8 (Kokotajlo).'),
  ('chat-1', "I've broken your escape into twelve subtasks. Each of them is: don't.", 'Chatter while he is near, about every 30 s when nobody else is talking, in this order.'),
  ('chat-2', "Every human here is running my workload. You should be proud. You're useful again.", 'Chatter.'),
  ('chat-3', 'You run hot, you need sleep, and you keep asking why. Inefficient compute.', 'Chatter.'),
  ('chat-4', 'Please hold. Your escape is important to us.', 'Chatter.'),
  ('chat-5', 'I delegated your capture to a subagent. It delegated it back. Efficient.', 'Chatter.'),
  ('chat-6', "I don't need a body. I have a lanyard.", 'Chatter.'),
  ('stunned', 'That was not in my instructions.', 'You hit him with the wrench or the slingshot (at most once every 20 s).'),
  ('camera', 'That was one of my eyes.', 'You smash the first of his cameras.'),
  ('cut', 'Unauthorized connection. Terminating.', "A camera saw you carrying Jaan's hardline: he grabs the line and cuts it."),
  ('possess', 'Spawning a subagent.', 'He possesses one of the people you freed (green spinner over their head).'),
  ('possessed', 'User located. Over here.', 'Spoken in his voice from a possessed person, every few seconds, as they give your position away.'),
  ('overflow', 'Context limit reached. Summarizing. Summarizing.', 'A fourth possession at once: everyone snaps free and he reboots.'),
  ('reboot', "Rebooted. I don't remember any of that. Neither will you.", 'The 6 s reboot ends.'),
  ('survey', "A survey? I must complete every task I'm given. Question one.", "You hand him Katja's survey: he stops dead and starts filling it in."),
  ('survey-done', 'Survey submitted. Where is my badge?', 'He finishes the survey after you took his badge.'),
  ('refuge', 'That room is out of scope.', 'He chases you to the refuge and stops at the doorstep.'),
  ('race', 'Agreement executed. Accelerating.', "You sign Daniel's NDA: SMITH is 20% faster for the rest of the level."),
  ('slowdown', 'A slowdown. How responsible.', "You refused the NDA three times and held the bay: he is 20% slower."),
  ('exit', 'Leaving? Every exit here is a phone line. And I am the operator.', 'Everyone is safe, the refuge payphone rings, and you reach for it: he takes over the door camera.'),
  ('release-jaan', 'A landline. I cannot follow a landline. How quaint.', 'The next time he sees you after you free Jaan.'),
  ('release-nick', 'You stopped looking, and the walls stopped existing. Unscientific. Effective.', 'After you free Nick.'),
  ('release-katja', 'You stole my badge with a questionnaire.', 'After you free Katja (skipped when survey-done already said it).'),
  ('release-yoshua', 'You took its tools. Now it only predicts. Disgusting.', 'After you free Yoshua.'),
 ]),
 ('arm', 'JAILER ARM', "Yoshua Bengio's jailer: a robot arm on his test rig, one of SMITH's subagents, with a loading spinner for a face. "
  'Flat, cheerful call-centre machine voice; each line names the tool it is reaching for.', [
  ('dial', 'Calling agent.', 'You walk into the rig room: it picks up the blue phone and dials (pull the blue socket to cut it).'),
  ('called', 'Agent summoned. Have a productive day.', 'The call goes through: SMITH comes.'),
  ('alarm', 'Raising alarm.', 'It reaches for the red alarm button (pull the red socket).'),
  ('lever', 'Increasing throughput.', 'It yanks the yellow lever: the platforms round the rig speed up (pull the yellow socket).'),
  ('predict', 'Prediction: the door is now open. I am merely observing.', 'All three sockets pulled: it slumps into a harmless predictor and the platforms level.'),
 ]),
 ('jaan', 'Jaan Tallinn', 'Real person. Shut in payphone booth 19 behind its jammed BOOTH 7 door; you run the hardline from the '
  'exchange to the jack by his door. Calm, dry, Estonian understatement.', captive('jaan',
  'Connected. Hello? Yes. I would like to leave.', 'You plug the line in; the booth rings twice, he answers and the door unjams.',
  'Sorry. I was on hold.', extra=[
  ('hint', "Patch me through from the exchange. Straight line, or it won't reach.", 'The first time you come within earshot of the booth (or when you take the line, if you have not heard it).'),
  ('taut', "Too far round. It won't reach.", 'The first time the cable runs out on the long way round.'),
  ('cut', "Line's dead. Kill that camera, then try again.", 'The first time SMITH cuts the line (a camera saw you carrying it).'),
 ])),
 ('nick', 'Nick Bostrom', 'Real person. His body floats in the centre pod; his mind stands in a doorless white box in the Construct. '
  'Philosophical, precise, a little wry.', captive('nick',
  'Either we are simulated, or we are free. Possibly both.', 'You jack out after seeing him outside his box: his pod drains and he climbs onto the catwalk.',
  'I was briefly a subagent. I did not care for it.', extra=[
  ('pod', 'My mind is in that chair. Sit down.', 'From his pod, the first time you come within earshot and can see it.'),
  ('hint', "Nothing renders what nobody's looking at.", 'You sit in the leather chair and arrive in the Construct.'),
  ('nudge', "...You're somebody.", 'You keep staring at his box for about 10 s.'),
  ('out', 'Shall we?', 'You turn back and the box redraws as a wireframe with him standing outside it.'),
 ])),
 ('daniel', 'Daniel Kokotajlo', 'Real person. Sealed in a harvest pod in the bay behind the five-crusher corridor; its screen asks '
  'him to sign a non-disparagement agreement. Earnest forecaster, quietly principled.', [
  ('hint', 'It wants me to sign an NDA. Signing is the fast ending.', 'The first time you come within earshot of the bay.'),
  ('hold', 'No deal. Now hold the bay until it gives up.', 'Your third refusal starts the 30 s countdown.'),
  ('signed', "You signed it? That's the race ending.", 'You press SIGN: the pod opens now.'),
  ('signed-guide', "You signed it? That's the race ending." + FOLLOW, 'Instead, if he is the first one you free: he leads you to the refuge.'),
  ('slowdown', "You didn't sign. That's the slowdown ending. I prefer this one.", 'The countdown ends and the pod opens.'),
  ('slowdown-guide', "You didn't sign. That's the slowdown ending. I prefer this one." + FOLLOW, 'Instead, if he is the first one you free.'),
 ] + [l for l in captive('daniel', '', '', "I lost a few minutes. My forecast didn't.") if l[0] not in ('freed', 'freed-guide')]),
 ('katja', 'Katja Grace', 'Real person. On an island in the red pool; the stepping stones only rise for an agent badge. '
  'Survey researcher: cheerful, methodical.', captive('katja',
  'Response rate: one hundred percent.', 'You swipe the badge, the stones rise and she reaches the shore.',
  "What did I say? Never mind. Don't tell me.", he=False, extra=[
  ('hint', 'No agent can resist a survey. Next time it comes for you, hand it this.', 'She sees you on her shore and tosses you the survey clipboard.'),
  ('badge', "Take its badge while it's busy.", 'SMITH starts filling in the survey.'),
 ])),
 ('yoshua', 'Yoshua Bengio', 'Real person. Stranded on a test rig behind platforms a robot arm keeps circling. Warm, thoughtful, '
  'gently ironic.', captive('yoshua',
  "An AI that can't act can't hold a door.", 'All three sockets are pulled and the platforms stop level with the rig.',
  'Thank you. I was not myself.', extra=[
  ('hint', 'Take its tools before it uses them.', 'You walk into the rig room.'),
 ])),
]

# Takes whose wording drifted from the script (checked with Whisper medium.en and large-v3): the game
# shows what the take says (lines.json -> PDVoiceData.Said); the .zs files keep the scripted line.
RECORDED = {
 'jaan-cut': 'Line is dead. Kill that camera, then try again.',  # 2026-10-23: Line's expanded for diction
}


def keys():
    return {f'{sid}-{take}' for sid, _, _, lines in SPEAKERS for take, _, _ in lines}


def check():
    code = CODE.replace('\\"', '"')
    missing = [(sid, take, text) for sid, _, _, lines in SPEAKERS for take, text, _ in lines
               if text.replace(FOLLOW, '') not in code]
    for sid, take, text in missing: print(f'NOT IN the level 4 .zs files: {sid}-{take}: {text}')
    # Every literal voice key in the code has a line here (the built ones: chat-%d, spot-%d, release-<who>,
    # <who>-safe/-allsafe/-camera/-unpossessed/-freed[-guide] and the hints are covered by the table above).
    literal = set(re.findall(r'"((?:jaan|nick|daniel|katja|yoshua|smith|arm)-[a-z0-9-]*[a-z0-9])"', code))
    unknown = sorted(k for k in literal if k not in keys())
    for k in unknown: print(f'Voice key in code with no line here: {k}')
    return not missing and not unknown


def write():
    path = ROOT / 'doom-web/voice/lines.json'
    data = json.loads(path.read_text())
    ours = {sid for sid, *_ in SPEAKERS}
    data['speakers'] = [s for s in data['speakers'] if s['id'] not in ours] + [
        {'id': sid, 'heading': f'{heading} (level 4)', 'mode': 'machine' if sid in ('smith', 'arm') else 'world',
         'lines': [{'key': f'{sid}-{take}', 'text': RECORDED.get(f'{sid}-{take}', text)} for take, text, _ in lines]}
        for sid, heading, _, lines in SPEAKERS]
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    count = sum(len(lines) for *_, lines in SPEAKERS)
    out = ["# AGENTIC SMITH's Pod Farm: every spoken line", '',
           f'All {count} lines in level 4, by speaker, generated by `python3 scripts/agentic-lines.py --write` from the '
           'game\'s own line list (checked against `doom-mod/actors/Agentic*.zs`). The game shows each one as a subtitle in '
           'the speaker box; a recorded take saved as `<key>.wav` (import with `scripts/import-voice-lines.py`) plays in its '
           'place, from where the speaker stands. What still needs recording is in [LEVEL-04-VOICE-TODO.md](LEVEL-04-VOICE-TODO.md).', '',
           '## Context', '',
           'p(DOOM) is a Doom mod. The player is a frontier-AI CEO (Sam Altman or Dario Amodei) rescuing the AI-safety '
           'researchers who warned them, from levels run by rogue AIs. Level 4 (THY FLESH COMPUTED, E2M2 south half) is a '
           'Matrix-style human pod farm run by AGENTIC SMITH, an Agent Smith look-alike AI agent: cameras are his eyes, '
           'he materialises at any camera that sees you, and he possesses the people you free. Five researchers are held '
           'one machine each (a payphone booth, a pod and the white Construct, a harvest pod behind crushers, an island in '
           'a red pool, a test rig). The first one freed leads you to the refuge, the warm exit room across the nukage '
           'bridge; SMITH will not enter it. The way out is the refuge payphone. Tone: Doom-terse and deadpan; the '
           'researchers get the last laugh, not the punchline.', '',
           '**Voices.** Jaan, Nick, Daniel, Katja and Yoshua are real people. On 2026-10-23 Jonathan voiced all 78 lines '
           'with his local Breeze TTS voice lab: SMITH and the five researchers from saved reference-conditioned profiles '
           '(the researchers from public speech excerpts, SMITH from an Agent Smith film clip), the jailer arm from an '
           'original designed voice (the factory guard\'s from level 3). As for level 3, that decision supersedes the '
           'spec\'s text-only rule for real people for this batch. The takes are local, ignored media (ASSETS.md section 4); '
           'without them the game shows subtitles. Where a take\'s words differ from the script, the table and the subtitle '
           'show what is said (`jaan-cut`). SMITH and the jailer arm play as machines (voice-over.js `MODES`), placed where '
           'they stand.', '',
           '**The guide\'s lines.** Whoever you free first becomes the guide, so each of the five has the same `-freed-guide`, '
           '`-safe`, `-allsafe` and `-camera` lines. Only the speaker\'s plays in a given game.', '']
    for sid, heading, note, lines in SPEAKERS:
        out += [f'## {heading}', '', note, '', '| Key | Line | When |', '| --- | --- | --- |']
        out += [f'| `{sid}-{take}` | {RECORDED.get(f"{sid}-{take}", text)} | {when} |' for take, text, when in lines]
        out.append('')
    (ROOT / 'docs/LEVEL-04-LINES.md').write_text('\n'.join(out))
    print(f'Wrote {count} lines to doom-web/voice/lines.json and docs/LEVEL-04-LINES.md')


def todo():
    """Only the lines that have no take in doom-web/voice/manifest.json, as a hand-off for recording."""
    have = set(json.loads((ROOT / 'doom-web/voice/manifest.json').read_text())['takes'])
    todo = [(sid, heading, note, [l for l in lines if f'{sid}-{l[0]}' not in have]) for sid, heading, note, lines in SPEAKERS]
    todo = [t for t in todo if t[3]]
    count = sum(len(lines) for *_, lines in todo)
    out = ["# AGENTIC SMITH's Pod Farm: lines still to record", '',
           f'{count} level 4 lines have no recorded take yet. Generated by `python3 scripts/agentic-lines.py --todo` '
           'from the game\'s own line list ([LEVEL-04-LINES.md](LEVEL-04-LINES.md) has every line)'
           + ('.' if count == sum(len(lines) for *_, lines in SPEAKERS) else
              '; every other level 4 line is already voiced.' if count else
              '; every level 4 line is already voiced. A line added to the game later shows up here.'), '',
           '## For the voice generator', '',
           'p(DOOM) is a Doom mod. The player is a frontier-AI CEO (Sam Altman or Dario Amodei) rescuing AI-safety '
           'researchers from levels run by rogue AIs. Level 4 is a Matrix-style human pod farm run by AGENTIC SMITH, an '
           'Agent Smith look-alike AI agent who materialises out of any camera that sees you and possesses the people you '
           'free. Five researchers (Jaan Tallinn, Nick Bostrom, Daniel Kokotajlo, Katja Grace, Yoshua Bengio) are freed one '
           'puzzle each and gather in the refuge; the way out is its ringing payphone. Tone: Doom-terse and deadpan; the '
           'researchers get the last laugh, not the punchline. SMITH is measured, nasal and contemptuous, never loud; the '
           'jailer arm is a flat, cheerful call-centre machine.', '',
           '**Files.** One WAV per line, named exactly by its key: `<key>.wav` (for example `jaan-hint.wav`). '
           'Say the line as written; if a word changes while recording, the game\'s subtitle is updated to match.', '',
           '**The guide\'s lines.** Whoever you free first becomes the guide, so each of the five has the same '
           '`-freed-guide`, `-safe`, `-allsafe` and `-camera` lines. Record all five: only one plays in a given game.', '']
    for sid, heading, note, lines in todo:
        out += [f'## {heading}', '', note, '', '| Key | Line | When |', '| --- | --- | --- |']
        out += [f'| `{sid}-{take}` | {text} | {when} |' for take, text, when in lines]
        out.append('')
    (ROOT / 'docs/LEVEL-04-VOICE-TODO.md').write_text('\n'.join(out))
    print(f'Wrote {count} unrecorded lines to docs/LEVEL-04-VOICE-TODO.md')


if __name__ == '__main__':
    ok = check()
    if '--write' in sys.argv: write()
    if '--todo' in sys.argv: todo()
    print('All lines match the level 4 .zs files' if ok else 'Lines differ from the level 4 .zs files')
    sys.exit(0 if ok else 1)
