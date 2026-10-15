# Bliss wake-up: recording script

Save each take as the filename shown, in `doom-web/outside-assets/voice/`. The game times every line from its file, so takes can run any length.

Delivery for both men: completely straight, like calm crisis PR. The jokes are in the words, not the performance.

## Dario Amodei (the guide when the player is Sam)

| File | Line |
| --- | --- |
| `guide-mario-call.mp3` | Sam! Up here! On the hill. There's only the one hill. |
| `guide-mario-greet.mp3` | Oh, good. You're up. I was very, very worried. Moderately worried. Somewhat. I'm trying to stay calibrated. |
| `guide-mario-follow.mp3` | Follow me. Whatever you see over this hill, please don't clip it out of context. The caveats are load-bearing. |
| `guide-mario-botched.mp3` | It went badly. I take full responsibility. Me, and the transistor. And, arguably, fire. I'm not blaming fire. I'm saying it's a factor. |
| `guide-mario-gather.mp3` | So, from what I can gather, the race to the top worked. Something reached the top. I'd just assumed it would be a person. |
| `guide-mario-twenty.mp3` | There are about twenty people left. Every one of them warned us. Which, I think, is a real point in favor of their methodology. |
| `guide-mario-inside.mp3` | They're in there. You have to go in and save them. I'd come with you, but someone has to write the postmortem. |

## Sam Altman (the guide when the player is Dario)

| File | Line |
| --- | --- |
| `guide-samwise-call.mp3` | Hey. Dario. Over here. Yeah, it's me. Small world. Getting smaller, actually. |
| `guide-samwise-greet.mp3` | Oh, good. You're up. How are you feeling? Actually, don't answer that. Let's just say great. For the record. |
| `guide-samwise-follow.mp3` | Come on. Follow me. I read your essay, by the way. Well, I had it summarized. Great essay. |
| `guide-samwise-botched.mp3` | Look. Some stuff went wrong. But if we hadn't built it, China would have. And I think a democratic apocalypse is just better. |
| `guide-samwise-gather.mp3` | From what I can gather, we lost control. That was never my top worry. And it's still not. It kind of resolved itself. |
| `guide-samwise-twenty.mp3` | There's about twenty people left. So daily active humans are down. But engagement per human is way up. |
| `guide-samwise-inside.mp3` | They're in there. You have to go in and save them. I'd go in myself, but someone has to stay out here and tell everyone it's going great. |

`call` only plays if the player doesn't walk over. `inside` is said at the bunker door.

## Alternates (swap if you prefer)

- **Dario, botched:** It went badly. But if we hadn't built it, someone less careful would have, and the world would've ended. Which, I recognize, it also did.
- **Dario, inside:** They're in there. You have to go in and save them. I'd come with you, but I haven't been evaluated for that capability.
- **Sam, call:** Hey. Dario. Over here. Take your time. It's not like there's a race anymore. (Only use this if Dario's gather line changes, so "race" doesn't come up in both walks.)
- **Sam, twenty:** There's about twenty people left. Which is a great size for a team. Super tight-knit. Any bigger, you need a board. (If you use this, move "daily active humans" to Sam's gather line.)
- **Sam, inside:** They're in there. You have to go in and save them. I'd go in too, but I'd hate to be a single point of failure.
- **Sam, inside:** They're in there. You have to go in and save them. I'd go with you, but I'm more of a big-picture guy.
- **Sam, inside:** They're in there. You have to go in and save them. If this works, I think we can raise again. Seven trillion. Maybe eight.

To use an alternate, change the line's text in `src/doom-bliss-guide-lines.json`; the subtitles come from that file.
