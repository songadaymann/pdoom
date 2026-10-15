> Note (2026-10-09): written while the founders used parody names (Mario Scaldi / Samwise Othermale). In the game they are now Dario Amodei and Sam Altman.

# Bliss walk: final script (comedy edit)

Written 2026-10-09 after Jonathan's note on the current draft: "I love it, it's definitely the right direction. I feel like it may go a little too far on certain vocal ticks... punch up the dialog. More jokes wouldn't hurt."

Inputs: `src/doom-bliss-guide-lines.json` (current lines), `mario-dario.md` and `samwise-sam.md` (research and options), `docs/spec/06-names-and-antagonists.md` §1, §6, §11 and §12, the intro cut-scene captions (`doom-web/local/intro/manifest.json`), and the promo VO (`output/promo/vo-scripts.md`), checked so that no joke repeats one the player has already heard.

**The edit in one line:** cut the tics down to the measured budget and give every line a button. Each line now has a single joke, the joke types never repeat back to back, and neither founder borrows the other's joke.

---

## 1. Critique of the researchers' favourites

### Mario

| Key | Favourite | Verdict | Decision |
| --- | --- | --- | --- |
| call | "I'd come to you, but I've modeled it…" | **Clever, not funny.** "More efficient this way" is a soft button, and 17 words is long for a shout. | Replaced with the researcher's option 2, the one-hill line. The Bliss hill is the most recognizable thing on screen, and pedantry about it gets a laugh from anyone. |
| greet | "very, very worried. Moderately worried…" | **Lands.** This is his number-revision habit applied to his feelings, and it doesn't make the player do any math. | Kept, with a third step added ("Somewhat.") so the downgrade lands in three. It spends the walk's one "very, very". |
| follow | "don't clip it out of context. The caveats are load-bearing." | **Lands.** Readers don't need to know his clipping habit, because anyone online knows "out of context". "Load-bearing caveats" is the quotable line. | Kept. "over this hill" now sets up the crest reveal. |
| botched | "…someone less careful would have, and the world would've ended. Which… it also did." | **Lands, but overlaps.** It uses the same "if we hadn't built it, X would have" template as Samwise's China line, and AMODEL's bark 5 already does "someone less careful". | Moved to the alternate. The main line is rebuilt from the researcher's option 3 (transistor/fire) around "I take full responsibility", so watering down the responsibility is the joke. |
| gather | "p(doom) hit ninety-nine percent. I've never liked that term." | **Inside baseball.** It only works if you know he dislikes the term. The button ("the number's right, though") is soft, and the line needs a TTS override. | Replaced with option 3, the race to the top taken literally. It works without context and turns a dark reveal into a quotable line. |
| twenty | "talent density beats talent mass…" | **Overlaps, and it's inside baseball.** It's the same joke as Samwise's "right size for a team" (twenty survivors as a staffing win), and the maxim is a hiring-blog phrase. | Replaced with option 3, survival as peer review. The researcher flagged it as a spoiler, but that no longer applies: the intro already says the last twenty "are the people who warned you. All of them." "Mostly" became "Every one of them" to match. |
| inside | "I haven't been evaluated for that capability." | **Lands, but the current line is better.** The current postmortem line works twice over: it's a corporate report and also literally an after-death exam. | Kept the current postmortem line, trimmed by four words. The favourite becomes the alternate. |

### Samwise

| Key | Favourite | Verdict | Decision |
| --- | --- | --- | --- |
| call | "Take your time. It's not like there's a race anymore." | **Lands**, and it fits the moment, since the call only plays when the player dawdles. But "race" now belongs to Mario's [gather]. | Swapped for option 2, "Small world. Getting smaller." The favourite is the alternate, which works if Mario's gather changes. |
| greet | "I'm a big believer in comebacks." | **Clever, not funny**, for anyone who doesn't remember the 2023 board saga. ALT+MAN's bark 6 already uses it. | Replaced with option 3, crisis PR answering for the patient, plus "Don't answer that." It needs no context. |
| follow | "I read your essay… I had it summarized. Great essay." | **Lands.** The dig cuts both ways: Mario's essays are long, and Samwise doesn't read. It's the only essay joke in either walk. | Kept. |
| botched | "…China would have. And I think a democratic apocalypse is just better." | **Lands.** It keeps Jonathan's China beat and adds a sharper button. | Kept, with the opener trimmed from "So, look." to "Look." |
| gather | "Daily active humans are down. But engagement per human is way up." | **The best joke in either set.** | Moved to [twenty], where "about twenty people left" is the natural setup for the metric. In [gather] it made three business-lens lines in a row: metrics, then team size, then the raise. |
| twenty | "…right size for a team. Any bigger, you need a board." | **Clever but samey.** It's the third business line in a row, and it overlaps with Mario's talent-density line. | Moved to the alternate, merged with Jonathan's "super tight-knit" so his joke survives there. |
| inside | "…we can raise again. Seven trillion. Maybe eight." | **Lands, but only for people who know the $7T story.** For everyone else it's just a big number. It also relies on a specific real figure that §12 doesn't list (see §4). | Replaced with option 2, "Do it iteratively. Make your mistakes on the first few." It's darker, needs no context, and doubles as advice for the rescue the player is about to start. The raise is now the alternate. |

### New or rebuilt lines
- **Samwise [gather]** is the researcher's spare "Losing control was never my top worry… It kind of resolved itself," rebuilt as a status-update triplet. It gives the walk a serene-misreading joke between the China line and the metrics line.
- **Mario [botched]** combines the transistor/fire spare with a crisis-PR "full responsibility" that then gets shared out.

---

## 2. Final script

Word counts are spoken words. The seconds column is estimated from the current placeholder recordings: Mario about 0.31 s per word plus 0.6 s per sentence break, Samwise about 0.23 s per word plus 0.6 s per sentence break. No line needs a `tts` override.

### Mario Scaldi (guides when the player is Samwise)

| Key | Line | Words | ~s | Joke type |
| --- | --- | --- | --- | --- |
| call | Samwise! Up here! On the hill. There's only the one hill. | 11 | 5.8 | pedantry about the wallpaper |
| greet | Oh, good. You're up. I was very, very worried. Moderately worried. Somewhat. I'm trying to stay calibrated. | 17 | 8.9 | calibrating his own feelings |
| follow | Follow me. Whatever you see over this hill, please don't clip it out of context. The caveats are load-bearing. | 19 | 7.7 | pre-emptive crisis PR |
| botched | It went badly. I take full responsibility. Me, and the transistor. And, arguably, fire. I'm not blaming fire. I'm saying it's a factor. | 23 | 10.8 | responsibility shared out until it's absurd |
| gather | So, from what I can gather, the race to the top worked. Something reached the top. I'd just assumed it would be a person. | 24 | 9.3 | his slogan taken literally |
| twenty | There are about twenty people left. Every one of them warned us. Which, I think, is a real point in favor of their methodology. | 24 | 9.3 | extinction as peer review |
| inside | They're in there. You have to go in and save them. I'd come with you, but someone has to write the postmortem. | 22 | 8.7 | cowardice as duty, plus a pun |

**Total:** 140 words, about 60 s with the call and about 55 s without it.

**Alternates (only where it's a real toss-up):**
- botched: "It went badly. But if we hadn't built it, someone less careful would have, and the world would've ended. Which, I recognize, it also did." [25, ~9.6 s] This is the purest version of his logic. It lost only because it shares the "if we hadn't built it" template with Samwise's China line.
- inside: "They're in there. You have to go in and save them. I'd come with you, but I haven't been evaluated for that capability." [23, ~9.0 s]

### Samwise Othermale (guides when the player is Mario)

| Key | Line | Words | ~s | Joke type |
| --- | --- | --- | --- | --- |
| call | Hey. Mario. Over here. Yeah, it's me. Small world. Getting smaller, actually. | 12 | 6.4 | understatement |
| greet | Oh, good. You're up. How are you feeling? Actually, don't answer that. Let's just say great. For the record. | 19 | 8.0 | crisis PR answering for the patient |
| follow | Come on. Follow me. I read your essay, by the way. Well, I had it summarized. Great essay. | 18 | 7.2 | gracious dig at the rival |
| botched | Look. Some stuff went wrong. But if we hadn't built it, China would have. And I think a democratic apocalypse is just better. | 23 | 7.7 | blame-shifting plus a euphemism |
| gather | From what I can gather, we lost control. That was never my top worry. And it's still not. It kind of resolved itself. | 23 | 7.7 | serene misreading |
| twenty | There's about twenty people left. So daily active humans are down. But engagement per human is way up. | 18 | 6.0 | metrics-deck euphemism |
| inside | They're in there. You have to go in and save them. Do it iteratively. Make your mistakes on the first few. | 21 | 7.3 | callous product philosophy |

**Total:** 134 words, about 50 s with the call and about 44 s without it. The placeholder voice for Samwise is fast. If his set runs short, the raise alternate below adds about 1.3 s.

**Alternates:**
- call: "Hey. Mario. Over here. Take your time. It's not like there's a race anymore." [14, ~6.2 s] Use this if Mario's [gather] changes, so "race" isn't in both walks.
- twenty: "There's about twenty people left. Which is a great size for a team. Super tight-knit. Any bigger, you need a board." [21, ~7.3 s] Jonathan's tight-knit-team joke with a board button. If this goes in, move the daily-active-humans joke back to [gather].
- inside: "They're in there. You have to go in and save them. If this works, I think we can raise again. Seven trillion. Maybe eight." [24, ~8.6 s] Jonathan's raise joke, pushed further. See the allusion flag in §4.

---

## 3. Walk checks

**Tics against the measured budget**

| | Mario | Budget | Samwise | Budget |
| --- | --- | --- | --- | --- |
| "I think" | 1 (twenty) | 2–3 | 1 (botched) | 2–3 max |
| doubled intensifier | 1 "very, very" (greet) | 1 | — | — |
| "So," / "Look," openers | 1 "So," (gather) | ≤1 per line | 1 "Look." (botched) | ≤1 |
| "honestly" | 0 | — | 0 | 0 |
| "sort of" / "in a sense" | 0 | 0 | — | — |
| "kind of" / "super" / filler "like" | 0 | — | 1 "kind of" (gather) / 0 / 0 | 0–1 each |
| "careful" | 0 | ≤1 | — | — |

Both founders sit at the low end of their budgets on purpose. The jokes carry each character: none of Mario's lines would sound right from Samwise, and the reverse is also true.

**Joke types, in walk order.** None repeats back to back.
- Mario: pedantry · calibrated feelings · pre-emptive PR · watered-down responsibility · literal slogan · peer review · cowardice and a pun
- Samwise: understatement · PR spin · rival dig · blame plus euphemism · serene misreading · metrics · callous process

**Shared frames, not shared jokes.** Both founders open with "Oh, good. You're up." and "From what I can gather", and close with "They're in there. You have to go in and save them." These are Jonathan's beats, and every punchline after them is different. "Models up, people down" belongs only to Samwise. The "people who warned us" premise belongs only to Mario. The essay joke appears only in Samwise's walk, as a dig at Mario.

**Even-handedness (spec §11).** Bias risk to note: this edit was written by an Anthropic model, and Mario parodies Anthropic's CEO.

| Slot | Mario | Samwise |
| --- | --- | --- |
| Excuse | Blames the transistor and fire | Blames China |
| The state of things | His race to the top crowned a machine | Losing control "resolved itself" |
| The twenty | Treats extinction as a data point | Treats extinction as an engagement metric |
| The send-off | Won't come; he's writing the postmortem | Use the first few people as practice |

Both are callous, self-serving and serene, and I read Mario's column as no softer than Samwise's. Jonathan should still check this table.

**Continuity notes**
- Most of the twenty are elsewhere; this bunker holds five. "They're in there" is looser than the old "They're all in there", which helps, but it still implies the bunker holds everyone.
- The JSON `_note` describes Mario as "someone less careful would have built it anyway". With the transistor/fire line as the main pick, update the note when the lines are dropped in.

---

## 4. Allusion flags (spec §12)

Section 12 allows phrase-level allusions to the facts it lists, and nothing else. None of the lines below quotes anyone. Each one also works for a player who has never heard of the source. Jonathan decides; each flag says whether the line *needs* the allusion.

| Line | Alludes to | In §12? | Needs it? | Risk |
| --- | --- | --- | --- | --- |
| Mario botched (main) | *The Adolescence of Technology* passage saying AI was probably inevitable once we had the transistor, or arguably fire | Essay listed; this passage isn't | No: blaming fire is absurd on its own terms | Low |
| Mario gather | "Race to the top," Anthropic's stated strategy (Lex #452; already in the promo VO) | No | No: it's a common phrase | Low |
| Mario follow | His habit of predicting that Twitter will clip his caveats (Lex #452) | No | No | Very low |
| Mario botched (alt) | "If one company does not build it, others will" (*Adolescence*) | No, but AMODEL bark 5 already uses it | No | Low |
| Samwise botched | His democratic-vs-authoritarian AI framing (Washington Post op-ed, July 2024) | No | No: "China would have" is Jonathan's beat | Low. Please confirm "democratic" reads as geopolitics, not the electoral politics barred by §1 rule 1. |
| Samwise gather | "Not my top worry" about losing control of AGI (Lex #419, 01:41:45) | No | No | Low |
| Samwise inside | Iterative deployment; making mistakes while the stakes are low (Lex #367) | Iterative deployment is on §12's "well documented, not re-verified" list | No: "iterate" is common speech | Low |
| Samwise twenty (alt) | The 2023 board firing ("you need a board") | §12's not-re-verified list; ALT+MAN bark 6 | Half: it reads as a founder grumbling about governance | Low |
| **Samwise inside (alt)** | **The reported $7 trillion raise (Feb 2024), which he joked about on Lex #419** | **No.** ALT+MAN bark 8 says "a few trillion" without the figure | **Yes**, for the full joke | **Medium.** It's a specific real number. Add it to §12 if this alternate ships. |

---

## 5. Drop-in JSON (main picks)

```json
{"mario":{"call":"Samwise! Up here! On the hill. There's only the one hill.","greet":"Oh, good. You're up. I was very, very worried. Moderately worried. Somewhat. I'm trying to stay calibrated.","follow":"Follow me. Whatever you see over this hill, please don't clip it out of context. The caveats are load-bearing.","botched":"It went badly. I take full responsibility. Me, and the transistor. And, arguably, fire. I'm not blaming fire. I'm saying it's a factor.","gather":"So, from what I can gather, the race to the top worked. Something reached the top. I'd just assumed it would be a person.","twenty":"There are about twenty people left. Every one of them warned us. Which, I think, is a real point in favor of their methodology.","inside":"They're in there. You have to go in and save them. I'd come with you, but someone has to write the postmortem."},"samwise":{"call":"Hey. Mario. Over here. Yeah, it's me. Small world. Getting smaller, actually.","greet":"Oh, good. You're up. How are you feeling? Actually, don't answer that. Let's just say great. For the record.","follow":"Come on. Follow me. I read your essay, by the way. Well, I had it summarized. Great essay.","botched":"Look. Some stuff went wrong. But if we hadn't built it, China would have. And I think a democratic apocalypse is just better.","gather":"From what I can gather, we lost control. That was never my top worry. And it's still not. It kind of resolved itself.","twenty":"There's about twenty people left. So daily active humans are down. But engagement per human is way up.","inside":"They're in there. You have to go in and save them. Do it iteratively. Make your mistakes on the first few."}}
```

After updating `src/doom-bliss-guide-lines.json`, regenerate the audio with `python3 scripts/build-guide-voices.py`.
