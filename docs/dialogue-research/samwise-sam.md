> Note (2026-10-09): written while the founders used parody names (Mario Scaldi / Samwise Othermale). In the game they are now Dario Amodei and Sam Altman.

# Samwise Othermale: speech-pattern guide and Bliss-walk punch-up

Research for the Bliss wake-up walk lines in `src/doom-bliss-guide-lines.json`, Samwise's version, which plays when the player is Mario. Samwise is a fictional parody. This guide tracks the real speaker's cadence, so the jokes come from the content and not from a pile of tics.

## Sources and method

- **Lex Fridman #419** ([transcript](https://lexfridman.com/sam-altman-2-transcript)), read in full. I extracted only Sam's turns: 240 turns, about 11,800 words. Then I counted phrases per 1,000 words and measured sentence lengths. The published transcript has been lightly cleaned, so "um", "uh" and some filler "like"s are under-counted.
- **Lex Fridman #367.** `lexfridman.com/sam-altman-transcript` returns "Page not found" as of 2026-10-09, and podscripts.co refused the connection. I used the auto-caption transcript on [rosetta.to](https://rosetta.to/u/lexfridman/sam-altman-openai-ceo-on-gpt-4-chatgpt-and-the-future-of-ai-lex-fridman-podcast) instead. It is raw and unpunctuated, with no speaker labels, so I used it for spot checks: filler density in his unedited speech, and a few answers about mistakes, fear and critics.
- **China.** China never comes up in either Lex interview: there are zero mentions in 11.8k words. His public China framing comes from the July 2024 Washington Post op-ed "Who will control the future of AI?" I read it through [Fortune's coverage](https://fortune.com/2024/07/27/sam-altman-openai-democratic-authoritarian-ai-china-russia-us-coalition), because the original is paywalled.
- Timestamps below are from #419 unless marked #367. I quote the source verbatim only once and paraphrase everything else, so check the timestamp if you want the exact wording.

---

## 1. Speech-pattern guide

### Sentence architecture
- **Plain and short.** Median sentence: **12 words**. **27%** of his sentences are 6 words or fewer. Long answers are chains of simple clauses joined with "and" and "but", with little nesting. A typical shape is one long explanatory sentence followed by two or three flat short ones.
- **Terse status-update triplets.** Asked whether the new board is final, he gives three tiny sentences: not final yet, some added, more to come (00:07:53). This is the most "him" rhythm in the transcript, and it suits crisis PR well.
- **One-word answers are common.** Standalone "Yeah." (16), "Maybe." (6), "For sure." (4), "Yes.", "No.", "Neither." After being fired he sums up his mood that night as excited, then "Onward." (00:14:22).
- **He lands lines flat.** He states things declaratively, with no uptalk and few flourishes. His humour is deadpan literalism. He answers a joke about "lots" of data labellers with "more than three people" (00:38:21), tells Lex an analogy doesn't stretch that far (00:12:36), and flatly denies a secret nuclear facility before adding he'd love one (01:02:50). **Jokes should come from flat literal statements, not from tics.**

### How he reframes bad news (the comedic engine)
1. **Name the pain plainly, then pivot to the upside.** He calls the board firing the most painful professional experience of his life, then in the next breath says it had good parts too and he's glad it happened early (00:01:13). He says what he mostly felt that weekend was love rather than hate (00:16:04). Within hours he was looking for the blessing in disguise (00:12:53).
2. **Zoom out until the disaster is a rounding error.** When Lex dwells on the weekend he says, verbatim: **"OpenAI is really about the other seven years."** (00:17:58)
3. **Every step was reasonable.** On the structure Elon attacks: they kept patching it until it looked eyebrow-raising, but each decision made sense at the time, and nobody hands you an oracle in advance (00:25:31).
4. **Abstract, passive failure.** The board could fire him on paper but in practice it didn't work, which he files as a governance failure in its own right (01:38:14). He describes the saga as a weird perfect storm (00:22:04).
5. **Mistakes in bulk, never one specific mistake, and always netted against wins.** On Gemini: mistakes have been made, more will come (01:24:06). On his record: many bad calls, many good ones, proud of the whole (01:40:12). In #367: get your mistakes out of the way while little is at stake (#367, 00:19:23).
6. **Absorbing criticism in advance.** He accepts being misunderstood about regulatory capture and expects time to vindicate him (01:40:12).
7. **Reassurance by historical analogy.** Artists panicked about photography, and it became an art form (00:41:36). Bill Gates couldn't imagine needing more memory (00:51:06). Punch cards (01:30:29).

### Deflection and hard questions
- **Reframe the question:** asked about copyright, he swaps in the deeper question he'd rather answer (00:40:14). He calls the AGI-timeline question badly formed (01:32:31) and the search question boring (01:18:12).
- **The balance hedge:** he refuses to either downplay or overstate GPT-4, both in one sentence (00:47:40).
- **The calm refusal:** on Q*, he just says they aren't ready to discuss it (01:03:16). On state actors he says only that they're trying, then that he shouldn't go into further details (01:28:20).
- **Certain about the arc, vague on specifics.** GPT-5: he doesn't know, and that's the honest answer. Then: an amazing new model this year, name unknown (01:06:15–01:06:30).
- **"Not my top worry."** He says it three times in one answer about losing control of AGI (01:41:45). He also calls those dramatic risks "theatrical" and compares them with slow-burn harms like air pollution versus nuclear (01:13:38).

### Competitors
- **Gracious with a blade.** He praises Elon as one of the great builders, then says that's exactly why the lawsuit saddens him (00:31:01). He misses the old Elon (00:31:22). He notes that collaboration isn't really what Elon is famous for (01:16:26). He expects Google to learn from its mistake and then make new ones (01:24:06). In #367, Elon is a jerk on Twitter, but he's glad Elon exists.
- **On competition generally:** the pros are obvious, and the con is an arms race he's nervous about (01:14:56).

### China and geopolitics
- **On Lex:** nothing beyond that short refusal about state actors. He never names China.
- **Elsewhere (2024 op-ed):** the choice is a democratic vision of AI versus an authoritarian one, and he says there's no third option. His version is abstract and euphemistic, so he says "authoritarian" rather than naming China. "China would have done it" is a fair comic compression of that argument. The version truest to his voice keeps the euphemism (see botched ★, "a democratic apocalypse").

### Compute, iterative deployment, the mission, AGI
- **Compute:** compute will be the future's currency, maybe the world's most precious commodity, and energy is the hardest part (01:10:01–01:11:20). He memes about "$7T, maybe eight" without quite owning it (01:09:41).
- **Iterative deployment:** he thinks AI and surprises don't mix. Shocking the world is what they're trying to avoid (01:04:22–01:05:08). In #367: deploy early while the systems are weak, so people have time to adapt.
- **The mission:** short, as the reason to keep going (back to the mission after the firing, 00:04:20). It comes up only 6 times, so it's not a drumbeat.
- **AGI:** he dislikes the timeline question, then commits loosely to the end of the decade or sooner. AGI isn't an ending, it's nearer a beginning (01:32:31). His preferred quadrant is short timelines with a slow takeoff (01:15:25).
- **His own mortality:** if he were shot tomorrow he'd find it sad, but mainly he'd think what a curious, interesting time it is (01:53:58). He is serene about personal doom.

### Certainty vs uncertainty
- **Certainty:** "For sure." (8), "Totally." (7), a flat statement of belief (twice, about fusion), "I expect…" (8).
- **Uncertainty:** "maybe" is everywhere (39, or 3.3 per 1k). "I don't know" (14). "I suspect". "It seems to me". He hedges specifics with "maybe" and "I think", never with "honestly".

### Verbal habits by frequency (Sam's turns in #419, about 11,800 words)
A 7-line scene is about 120–140 words, so multiply the per-1k rate by about 0.13 to get the expected count per scene.

| Habit | Count | Per 1k | Expected in a 130-word scene | Verdict |
|---|---|---|---|---|
| "I think" | 148 | 12.5 | **1–2** | His real signature. It often sits mid-sentence as a soft hedge ("it was, I think, …"). Use it in 2 lines, 3 at most. |
| "really" / "very" | 64 / 66 | 5.4 / 5.6 | ~1 | His ordinary intensifiers. More common than "super". |
| "a lot" | 57 | 4.8 | ~1 | Natural. |
| "maybe" | 39 | 3.3 | 0–1 | Underused in the draft. "Maybe. Maybe." is very him. |
| "I mean" (opener) | 27 (12 turn-openers) | 2.3 | 0–1 | A good way into an answer. |
| "Yeah" (opener) | 30 (21 turns open with it) | 2.5 | 0–1 | A good beat before a line. |
| "like" | 30 "like," + 27 quotative ("I was like, …") | ~2.5 filler | 0–1 | The raw #367 captions show more: about 14 per 1k in his answers, some of them verbs. The **quotative** "I was like, 'okay'" is more him than "there's, like, twenty". |
| "whatever" / "or something" | 15 / 9 | 1.3 / 0.8 | 0–1 | Trailing vagueness. More distinctive than "honestly". |
| "kind of" / "sort of" | 15 / 5 | 1.3 / 0.4 | **0–1** | Real but light. Once per scene. |
| "super" (intensifier) | 14 | 1.2 | **0–1** | "super important", "super hard", "super-cool". **Once per scene, maximum.** |
| "Look," (opener) | 7 | 0.6 | **≤1** | Used right before a candid or hard answer, as in the AGI-power answer (01:38:14). "So, look." before the confession beat is correct. |
| "For sure." / "Totally." | 8 / 7 | 0.7 / 0.6 | 0–1 | Short certainty beats. |
| "honestly" | **1** (plus 3 "honest") | **0.08** | **0** | **Practically never a filler for him.** "Honest" shows up in set phrases like "that's the honest answer". Cut it. |
| "incredible" / "amazing" | 2 / 8 | 0.2 / 0.7 | 0–1 | "Amazing" is for products. He's less superlative than the caricature. |
| "the mission" / "iterative" / "compute" | 3 / 3 / 19 | low | topic words | Use them as joke content, not texture. "compute" is concentrated in one answer. |
| "China" | **0** | 0 | 1 | It's the game's running joke. Keep it to **one** line. |

**Use sparingly or avoid:** "honestly" (cut it), uptalk endings ("kind of exciting?"), more than one of super / kind of / like in the same line, and stacked hedges (two or more of "I think", "kind of", "like" in 20 words). **Lean on instead:** short flat sentences, "Look," before a confession, "Yeah." / "For sure." / "Maybe." beats, "Onward.", reframes, metric euphemisms, the netted mistakes formula, and gracious digs.

---

## 2. Notes on the current lines

The current draft is about 120 words. Across it: "I think" ×5 (about 3× his real rate), "honestly" ×2 (about 200× his rate), filler "like" ×2, "super" ×1, "kind of" ×1, "really" ×2. Most of the excess is packed into [twenty] and [greet].

| Key | Verdict |
|---|---|
| call | Fine as a shout, but it's a free slot for a joke. It only plays when the player dawdles, so it can comment on that. |
| greet | "Honestly" is the wrong tic, since he basically never says it. "I think you look great" is a pleasant non sequitur but only a small joke. The player has just died in the Last Stand, which is a much better setup. |
| follow | "I think you're going to really like this. Mostly." "Mostly." is a decent button, but the first 9 words are generic filler. Since the player is Mario, this is a chance for a rival dig. |
| botched | **Good.** "So, look." is the right tic in the right place. "Some stuff went wrong" is great understatement. It runs 26 words, slightly long. "Their apocalypse would've been way worse" is fine, but his real framing (democratic vs authoritarian) gives a sharper punch with the same China beat. |
| gather | **The strongest existing line.** "From what I can gather" reads like news he's hearing, which is very good blame distance, and "the models are doing incredibly well" is on-model. The joke can be tighter: "the people part" is vague, and a metrics joke lands harder. Keep the models-up, people-down idea. The Mario research doc says that idea belongs to Samwise, and Mario's [gather] is the one that should change. |
| twenty | **The main tic pile-up:** "like", "honestly", "super", "I think", "kind of" and a rising "?" add up to 5 tics in 19 words, against about 1 expected. The "tight-knit team" joke underneath is good. The minimal fix is *"There's only twenty people left. Which is a super tight-knit team."* |
| inside | **A good joke** ("a really great story for the next raise"). At 27 words with "in there… in there" it's a bit long. It's fine to keep as a fallback; the ★ below pushes the raise joke further. |

**Overlap check with `mario-dario.md`:** Mario's [twenty] option 3 is "mostly the ones who warned us…", so I left the "survivors were the doomers" joke out of Samwise's set. One guide plays per run, but people who replay will hear both. The "essay" gag already appears in AMODEL barks and the Mario lines. Samwise's [follow] ★ approaches it from the other side (Samwise didn't read it); if that's one essay joke too many, use follow 2 or 3.

---

## 3. Alternatives per key (★ = favourite; [n] = word count)

Joke types: **U** understatement · **E** corporate euphemism · **B** blame-shifting · **P** product-launch / fundraising framing · **S** serene misreading of the situation.

### [call] (shouted; only if the player hasn't come over)
1. ★ "Hey. Mario. Over here. Take your time. It's not like there's a race anymore." [14] *S. It's gracious, it comments on the dawdling, and the AI race is over because everybody lost.*
2. "Hey. Mario. Over here. Yeah, it's me. Small world. Getting smaller, actually." [12] *U*
3. "Mario! Over here. The guy waving. Should be easy to spot. There aren't a lot of guys." [17] *U*

### [greet]
1. ★ "Oh, good. You're up. You were gone for a while there. I'm a big believer in comebacks." [17] *S. The player just died in the Last Stand, and Samwise's own famous comeback hangs over the line without being named.*
2. "Oh, good. You're up. You were in kind of a fugue state. I had one once. Forty-five days. You'll be fine." [21] *U, a deep cut: he described a fugue state of about 45 days after the firing (00:03:38).*
3. "Oh, good. You're up. How are you feeling? Actually, let's just say great. For the record." [16] *E. Crisis PR manages the message before the patient answers.*

### [follow]
1. ★ "Come on. Follow me. I read your essay, by the way. Well. I had it summarized. Great essay." [18] *A gracious-with-a-blade rival dig, his Elon register (00:31:01) aimed at Mario.*
2. "Come on. Follow me. It's bad over there. I don't want to downplay it. I don't want to overstate it either." [21] *U, his balance hedge (00:47:40) applied to the end of the world.*
3. "Come on. Follow me. It's been a weird week. Really painful. But there were great things about it too. Onward." [20] *S, the board-saga pivot (00:01:13) plus "Onward." (00:14:22).*

### [botched] (we botched it)
1. ★ "So, look. Some stuff went wrong. But if we hadn't built it, China would have. And I think a democratic apocalypse is just better." [24] *B + E. It keeps the creator's China beat and folds in his real democratic-vs-authoritarian framing.*
2. "Look. We were aiming for the safest quadrant. Short timelines, slow takeoff. And we really nailed the short timelines part." [20] *U + P. His real preferred quadrant (01:15:25), reviewed like a launch.*
3. "Look, I've made some bad decisions. A lot of good ones. I'm proud of the track record overall. Also, China." [20] *B. His netted mistakes formula (01:40:12) with the blame tacked on as a two-word tag.*

### [gather] (here's what's going on)
1. ★ "From what I can gather, the models are doing incredibly well. Daily active humans are down. But engagement per human is way up." [23] *E + P. It keeps the current line's frame and turns extinction into a metrics deck.*
2. "From what I can gather, the models are doing incredibly well. Usage is way up. It's mostly the users that are down." [21] *E. The smallest change to the current line.*
3. "So this is what I'd call a theatrical risk. Great climax scene. But historically, way more people have died of air pollution." [22] *S + B. His real theatrical-risk argument (01:13:38), unbothered by the fact that it's no longer true.*

### [twenty] (only ~20 people left)
1. ★ "There's about twenty people left. Which is about the right size for a team. Any bigger, you need a board." [20] *S + P. It's startup-founder logic, and the board is the thing that once fired him.*
2. "There's about twenty people left. That's not a final number. We've lost some. We may lose more." [17] *E. His board-update triplet (00:07:53) applied to humanity.*
3. "Twenty people left. Sounds low. But I always say ignore the Y-intercept, look at the slope. Okay. The slope's also not great." [22] *S. His slope-over-intercept line (00:12:00), checked live.*

### [inside] (go in there and save them)
1. ★ "They're in there. You have to go in and save them. If this works, I think we can raise again. Seven trillion. Maybe eight." [24] *P. It pushes the current "next raise" joke further with the $7T meme (01:09:41).*
2. "They're all in there. You have to go in and save them. Do it iteratively. Make your mistakes on the first few." [22] *P + S. Iterative deployment, and making mistakes while the stakes are low (#367).*
3. "They're in there. You have to go in and save them. It'll be an amazing launch. I don't know what we'll call it." [23] *P. His GPT-5 non-answer (01:06:30).*

### Recommended run (all ★)
> **call** Hey. Mario. Over here. Take your time. It's not like there's a race anymore.
> **greet** Oh, good. You're up. You were gone for a while there. I'm a big believer in comebacks.
> **follow** Come on. Follow me. I read your essay, by the way. Well. I had it summarized. Great essay.
> **botched** So, look. Some stuff went wrong. But if we hadn't built it, China would have. And I think a democratic apocalypse is just better.
> **gather** From what I can gather, the models are doing incredibly well. Daily active humans are down. But engagement per human is way up.
> **twenty** There's about twenty people left. Which is about the right size for a team. Any bigger, you need a board.
> **inside** They're in there. You have to go in and save them. If this works, I think we can raise again. Seven trillion. Maybe eight.

That's 140 words, about 50–55 s at the promo's TTS pace. Tic budget: "I think" ×2, "Look" ×1, "honestly" / "super" / "kind of" / filler "like" ×0. That's close to his real density, so the jokes carry the character. If it reads too clean, add a single "Yeah." in front of [botched] or put "super" back into a tight-knit-team variant of [twenty].

### Spare jokes (drop-in swaps, all ≤24 words)
- *botched:* "Technically, the board had the power to shut it down. In practice, that didn't quite work. I actually really relate to that." *(01:38:14)*
- *botched:* "No one person built this. So I don't think any one person should be blamed for it. That feels really important." *(01:40:12, 01:52:40)*
- *botched:* "I know everyone's going to focus on the apocalypse. But that's not really what we were about. We were about the other seven years." *(00:17:58)*
- *botched:* "I'm willing to be misunderstood here. In the fullness of time, this gets proven out. The fullness of time is just shorter now." *(01:40:12)*
- *gather:* "We really tried not to surprise the world. And I think it worked. Nobody's surprised. There's nobody left to be surprised." *(01:04:22)*
- *gather:* "Losing control was never my top worry. And, to be fair, it's still not. It kind of resolved itself." *(01:41:45)*
- *gather:* "It's not an ending. It's closer to a beginning. It's just, kind of, not our beginning." *(01:32:31)*
- *gather:* "Looking back, I think this version of the world kind of sucks. But I expect the next one to be way better." *(00:45:06)*
- *twenty:* "Most people didn't make it. Which is sad. But what a curious time. What an interesting time." *(01:53:58)*
- *inside (deep cut):* "This isn't a secret nuclear facility, by the way. I would love to have one. This is just a bunker." *(01:02:50)*

**TTS notes:** none of these need a `tts` override. Avoid ellipses, because the placeholder voice rushes them; use full stops for his beats. Deliver every line flat and unhurried, with falling endings. No line should end on a rising "?".
