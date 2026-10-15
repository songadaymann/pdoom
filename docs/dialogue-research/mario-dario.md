> Note (2026-10-09): written while the founders used parody names (Mario Scaldi / Samwise Othermale). In the game they are now Dario Amodei and Sam Altman.

# Mario Scaldi (Dario cadence): research and Bliss-walk punch-up

Written 2026-10-09 for the Bliss wake-up walk (`src/doom-bliss-guide-lines.json`, `mario.lines`). Mario guides when the player is Samwise. Mario is fictional and every line below is written for the game. Allusions stay at phrase level, following the rules in `docs/spec/06-names-and-antagonists.md` §12: no real p(doom) numbers, no long quotes.

**Method.** I took the Lex Fridman #452 transcript, kept only Dario's own turns (about 23,900 words), and counted phrases per 1,000 words. The published transcript has been cleaned up, with the "um"s and "uh"s removed, so filler words are under-counted. For his written voice and his justifications I also read *Machines of Loving Grace* (Oct 2024, ~14,700 words) and *The Adolescence of Technology* (Jan 2026, ~21,700 words). For how he handles the p(doom) question I used Axios's coverage of the AI+ DC Summit (Sept 2025).

---

## 1. Speech-pattern guide

### 1.1 What he actually says, and how often (Lex #452, Dario only)

| Habit | Count | Rate | Verdict |
| --- | --- | --- | --- |
| "So" / "And so" to chain cause and effect | 245 / 83 | 10 / 3.5 per 1k | The skeleton of his speech. A free, invisible opener. |
| "I think" | 203 | 8.5 per 1k (about one every 2–3 sentences) | His main hedge. Natural once per line. It only sounds like a tic if a single line uses it twice. |
| "very" | 109 | 4.6 per 1k | Heavy, but the plain version. |
| Doubled intensifier ("very, very", "really, really", "truly, truly") | ~10 | ~1 per 2,400 words | **Signature, but rare.** Use it once in the whole walk. |
| Answer opens with "Yeah" / "Yeah, so" | 34 / 5 | | Natural opener for a reply. Doesn't fit the lines where he speaks first. |
| "really" / "actually" | 63 / 54 | 2.6 / 2.3 per 1k | Filler. Use it if it helps the rhythm. |
| "kind of" | 43 | 1.8 per 1k | His softener. |
| **"sort of"** | **1** | ~0 | **Not his.** The current [gather] uses it. |
| "again," to re-anchor to an earlier point | 34 | 1.4 per 1k | Real, but it needs a previous point to point back to. |
| "Look," before a firm statement or reframe | 15 | 0.6 per 1k | Good for a pivot. Once or twice per walk. |
| "right?" as a tag | 24 | 1.0 per 1k | Once per walk at most. |
| "I don't know," inside a sentence as a softener | 21 | 0.9 per 1k | He says it *inside* a sentence, as a pause before an example, not as an answer. |
| "in some ways" / **"in a sense"** | 8 / **0** | | The current [botched] uses "in a sense". He says "in some ways". |
| "careful" | 4 | 0.2 per 1k | Rarer than the caricature suggests. The current draft uses it three times in seven lines. |
| "race to the top" | 9 | | All in one cluster of answers. It's his theory of change, not a verbal tic. |
| Enumeration ("a couple things", "one is", "the second…") | ~15 | | How he structures a long answer. He often announces two things, delivers one, and wanders off. |
| Self-aware rambling ("a very long-winded way of saying / answer") | 2 | | Real, but rare. The promo already uses it. |
| "plus or minus a factor of three" | **1** | | A memorable one-off, not a habit. The promo uses it twice. |
| Saying "very frightening" twice in a row | 1 moment | | Saying the same short line twice for emphasis is real. Use it once at most. |
| "to be clear" | 1 in speech; **15 in *Adolescence*** | 0.7 per 1k in writing | A *writing* tic. Fine once, as Mario reading from his own essay. |

### 1.2 How he builds an answer

1. **He frames the question before answering it.** He opens by saying he wants to separate out a couple of things, numbers them, and then often doesn't finish the list. A one-line version: announce two things, deliver the second as the punchline.
2. **Claim, then qualifier, then "but", then principle.** The RSP answer is the model: the risk isn't here today, but it's coming fast, so the rules are if-then triggers. He always ends on a rule or a principle, never on a feeling.
3. **Numbers come as ranges, and he revises them mid-breath.** He gives "2026 or 2027" and "two to three years". He says a benchmark will "probably" hit 90% next year, then adds that he doesn't know and it might be less. On headcount he says roughly 800 to 900, maybe 950, and asks not to be quoted on the exact numbers. He hedges *sizes*, not just odds. That is the real basis for the misplaced-precision joke.
4. **Optimism and fear arrive as a balanced pair, not a swing.** He says he is optimistic about meaning but worries about economics. He says most people underestimate the upside just as they underestimate the risk, and calls benefit and risk two sides of one coin. The joke: perfectly balanced sentences about a very unbalanced situation.
5. **He sees the clip coming.** Before giving his AGI timeline, he predicts that people on Twitter will cut out his caveats and keep only the number, and then gives the number anyway.
6. **On competitors he never names a villain.** He moves up to "the ecosystem" and "incentives", says it doesn't matter who wins, calls the drama profoundly uninteresting, and declines to litigate what other companies did. Pride slips in under the abstraction: he thinks his company has done the best of anyone, though still far from perfect. **A humble sentence with a boast in the middle is the most useful real pattern for this brief.**
7. **His analogies come from engineering and medicine**: airplane, car and drug safety; chemical reagents; a strong base model being like reaching low earth orbit; risks as landmines between here and the good future; running the gauntlet; risks as ghosts coming at you fast; whack-a-mole; grad students and a lab PI. Never sports, never war glory.
8. **He is pedantic about terms and knows it.** He calls "AGI" a meaningless buzzword with sci-fi baggage and prefers "powerful AI". He admits it's a pointless semantic point and keeps making it. He told Axios he hates the term p(doom).
9. **Rhythm.** Long, chained, self-interrupting sentences with doubled words at the restart, then one short declarative. He is earnest and doesn't tell jokes. Every laugh has to come from the earnestness.

### 1.3 What his self-justification sounds like (the comic engine)

Drawn from Lex #452 and *The Adolescence of Technology*, it runs in this order:

1. **A general concession.** He's sure they've made plenty of mistakes, and the imperfect people include him.
2. **Then refuses to dwell on it.** Being imperfect doesn't mean giving up; there's better and there's worse.
3. **Counterfactual inevitability.** The key sentence in the essay: *"If one company does not build it, others will do so nearly as fast."* The same passage says AI was probably inevitable once humanity invented the transistor, or arguably once it learned to control fire.
4. **The paper trail.** He testified to the Senate. The system cards run to hundreds of pages. There are the essays.
5. **Process over outcome.** It's not a perfect framework; they've had to change it. They don't define the next safety level until they reach the current one.
6. **Zoom out to the system.** The point isn't to be virtuous; the point is a better equilibrium.
7. **Awkward candour.** He says it is somewhat awkward, as an AI CEO, to name AI companies as a risk, and then names them.

For Mario: run steps 1 and 3 in a single breath, and let the logic fall apart audibly while he stays calm.

### 1.4 Use sparingly, or don't use

For a seven-line walk of about 70 seconds:

- **Use each of these once in the whole walk:** "very, very"; enumeration ("two things"); "right?"; "to be clear"; a number range with a self-revision.
- **Two or three times in the walk:** "I think"; an opener ("So," / "Look,"), with no more than one per line.
- **Don't use:** "sort of" (not his), "in a sense" (not his), "sub-optimally" (too corporate; he says things "go wrong" or "go badly"), and a good-news/bad-news frame (he never uses it; he enumerates instead). Also cut throat-clearing such as "I want to say…" and "I want to be careful here…": he does it, but only once per long answer, not once per sentence.
- **Already used elsewhere in the game:** AMODEL's barks (§6.2) already have "someone less careful", the "very long essay", "country of geniuses", "updated the policy" and "deeply worried. Anyway". The promo already has "factor of three" (twice), "very frightening", "two sides of the same coin" and "long-winded". The Bliss walk can use one of these. It shouldn't lean on all of them.
- **Never:** a real p(doom) number. That rules out his public ranges, under spec §12.

---

## 2. Notes on the current lines

| Key | Verdict |
| --- | --- |
| call | Fine and does its job. "Yes. Here." is a nice beat. There's no character in it yet, which is acceptable for an optional shout. |
| greet | **The best-calibrated line in the draft.** The 60-then-70 self-revision is exactly how he handles a number. Its only problem is that it's the first of three number jokes in seven lines. |
| follow | The essay is real: *Machines of Loving Grace* grew to 40–50 pages. But "And I want to say, before you see it," clears its throat in front of the joke, and AMODEL bark 6 already does the essay gag. It needs a specific punch. |
| botched | **Overdoes the tics.** Three hedges are stacked ("So." / "I think we'd have to say" / "in a sense"), it runs 30 words (about 12 s), and two of its words aren't his ("sub-optimally", "in a sense"). The button, "this is the careful version", is excellent. Keep it if this line stays. |
| gather | **The weakest line.** 31 words; "I want to be careful here" plus "sort of" plus a good-news/bad-news frame are three things that aren't Dario. "We won the race" is also off-model: his whole position is that it doesn't matter who wins. And Samwise's [gather] runs on the same models-up, people-down logic, so the two founders feel interchangeable here. |
| twenty | Good idea, but it's the third number joke in the walk and the promo's "factor of" gag reused. The punch also makes the listener divide 8 billion by 20 in real time to get it. |
| inside | **The strongest line.** Clean, true to the character (of course he'd write the postmortem), and a good button. A swap is optional. |

---

## 3. Alternatives (★ = favorite)

Word counts are in brackets. Every option keeps its beat. Joke types are varied within each key and across the walk.

### call (optional shout)
1. ★ "Samwise! Over here! I'd come to you, but I've modeled it, and it's more efficient this way." [17] *(rigor as laziness)*
2. "Samwise! Over here! By the hill. There's, there's only the one hill." [12] *(a Bliss joke on what the player can see; his real false start)*
3. "Samwise! Here! I'll keep waving. I don't know if it helps. I haven't measured it." [15] *(an empiricist who can't commit to waving)*

### greet (you're up)
1. ★ "Oh, good. You're up. I was very, very worried. Moderately worried. I want to stay calibrated about this." [18] *(his number self-correction applied to his own feelings; spends the walk's one "very, very")*
2. "Oh, good, you're up. You were out for about three days. Or three years. The error bars on everything are very wide right now." [24] *(misplaced precision that hints at the apocalypse)*
3. "Oh, good. You're up. Can you tell me your name? Sorry. I like to run a few evals before anything gets deployed." [22] *(treats Samwise like a model)*

### follow (follow me)
1. ★ "Follow me. And whatever you see, I'd ask you not to clip it out of context. The caveats are load-bearing." [20] *(his real habit of anticipating the clip, turned into crisis PR before the reveal)*
2. "Follow me. It's about a ten-minute walk. I've also written it up, if you'd rather read it. It's about forty pages." [21] *(the essay joke made specific, without saying "essay")*
3. "Follow me. And watch your step. I used to call the risks 'landmines.' That was a metaphor. Mostly." [18] *(his own closing metaphor taken literally)*

### botched (we botched it)
1. ★ "It went badly. But if we hadn't built it, someone less careful would have, and the world would've ended. Which, I'll recognize, it also did." [25] *(the core justification, with a counterfactual that collapses into what actually happened; "I'll recognize" is his phrase)*
2. "Look, it went badly. I own that. But if we hadn't built it, someone less careful would have. So this is the careful version." [24] *(the current line, trimmed: one hedge instead of three, same great button)*
3. "So, it went badly. But honestly, this was inevitable once we invented the transistor. Arguably fire. I'm not blaming fire. I'm saying it's a factor." [25] *(blame-shifting, alluding to the essay's inevitability passage)*

### gather (here's what's going on)
1. ★ "From what I can gather, p(doom) hit ninety-nine percent. I've never liked that term. Too much baggage. I think the number's right, though." [23] *(terminology pedantry in the face of extinction; sets up the game's title; TTS: "pee doom")*
2. "So, from what I can gather, two things happened. The first is the model became extremely capable. The second is everything else." [22] *(his enumeration used for understatement)*
3. "From what I can gather, the race to the top worked. Something reached the top. I'd just assumed it would be a person." [23] *(his own theory of change, read earnestly)*

### twenty (only about twenty left)
1. ★ "There are about twenty people left. Which, look, I've always said talent density beats talent mass. I didn't mean it like this." [22] *(an earnest misreading using his real hiring maxim; mild walk-back at the end)*
2. "There are about twenty people left. That was in our forecast, to be clear. Way out in the tail. But we did draw the tail." [25] *(credit-taking through forecasting; spends the walk's one "to be clear")*
3. "There are about twenty people left. Mostly the ones who warned us. Which, I'd say, is a real point in favor of their methodology." [24] *(treats survival as peer review. Flag: this gives away the "survivors are the people who warned us" premise. Skip it if that reveal is saved for later.)*

### inside (go in and save them)
1. ★ "They're in there. You have to go in and save them. I'd come with you, but I haven't been evaluated for that capability." [23] *(safety process used as cowardice)*
2. "They're in there. You have to go in and save them. I'll be out here, publishing your results. All of them. Including the failures." [24] *("we share our results publicly", read as a threat)*
3. "They're in there. You have to go in and save them. I'll stay here in the meadow. Someone has to represent the upside." [23] *(the *Machines of Loving Grace* optimism, sincerely, in an empty meadow)*

The current postmortem line is still a keeper if you'd rather not swap.

---

## 4. Recommended set (favorites, in walk order)

| Key | Line | Words | TTS override |
| --- | --- | --- | --- |
| call | Samwise! Over here! I'd come to you, but I've modeled it, and it's more efficient this way. | 17 | none |
| greet | Oh, good. You're up. I was very, very worried. Moderately worried. I want to stay calibrated about this. | 18 | none |
| follow | Follow me. And whatever you see, I'd ask you not to clip it out of context. The caveats are load-bearing. | 20 | none |
| botched | It went badly. But if we hadn't built it, someone less careful would have, and the world would've ended. Which, I'll recognize, it also did. | 25 | none |
| gather | From what I can gather, p(doom) hit ninety-nine percent. I've never liked that term. Too much baggage. I think the number's right, though. | 23 | "…pee doom hit ninety-nine percent…" |
| twenty | There are about twenty people left. Which, look, I've always said talent density beats talent mass. I didn't mean it like this. | 22 | none |
| inside | They're in there. You have to go in and save them. I'd come with you, but I haven't been evaluated for that capability. | 23 | none |

**Tic budget for the set:** one "very, very"; "I think" once; one "Look"; one self-correction (an emotion, not a number); no "sort of", "in a sense" or good-news/bad-news; "careful" once.

**Joke types, one per line:** rigor as laziness · calibrated feelings · pre-emptive PR · a collapsing counterfactual · terminology pedantry · misapplied management maxim · process as cowardice.

**Even-handedness check against Samwise:** "China would have done it" pairs with "someone less careful would have". "Next raise" pairs with "haven't been evaluated". The bite is about equal.

## 5. Spares (idle barks, or swaps if a favorite tests flat)

- "I don't want to litigate who did what. It's profoundly uninteresting. I'll just note our safety report was four hundred pages." [21] *(the only jab aimed at Samwise, through his refusal-to-litigate move)*
- "Our policy said we wouldn't define the next safety level until we reached the last one. Those turned out to be the same afternoon." [24]
- "I've always worried about the concentration of power. And, look, it is very concentrated now." [15]
- "There are about twenty people left. Don't quote me. Eighteen to twenty-two, something like that." [15] *(his real don't-quote-me hedge on a number anyone could count)*

## 6. If these ship: add to spec §12 (phrase-level allusions only)

| Allusion | Used in | Source |
| --- | --- | --- |
| He dislikes the term p(doom) (Axios AI+ DC Summit, Sept 2025) | gather ★ | [Axios](https://www.axios.com/2025/09/17/anthropic-dario-amodei-p-doom-25-percent) |
| "Talent density beats talent mass" | twenty ★ | [Lex Fridman #452](https://lexfridman.com/dario-amodei-transcript) |
| Twitter clipping his caveats; "don't quote me on the exact numbers" | follow ★, spare | [Lex Fridman #452](https://lexfridman.com/dario-amodei-transcript) |
| "If one company does not build it, others will…"; inevitable since the transistor or fire; system cards of hundreds of pages | botched ★/3, spare | [The Adolescence of Technology](https://www.darioamodei.com/essay/the-adolescence-of-technology) |
| Risks as "landmines"; won't litigate competitors; drama "profoundly uninteresting"; ASL-4 isn't defined until ASL-3 | follow 3, spares | [Lex Fridman #452](https://lexfridman.com/dario-amodei-transcript) |
| "Sci-fi baggage" of terms like AGI; the essay grew to 40–50 pages | gather ★, follow 2 | [Machines of Loving Grace](https://darioamodei.com/machines-of-loving-grace) · Lex #452 |

Sources:
- [Lex Fridman Podcast #452 transcript](https://lexfridman.com/dario-amodei-transcript)
- [Machines of Loving Grace](https://darioamodei.com/machines-of-loving-grace)
- [The Adolescence of Technology](https://www.darioamodei.com/essay/the-adolescence-of-technology)
- [Axios: Amodei on p(doom)](https://www.axios.com/2025/09/17/anthropic-dario-amodei-p-doom-25-percent)
