# Level 4 art to generate (ChatGPT)

For [AGENTIC SMITH's pod farm](LEVEL-04.md). Twenty images, plus two optional. Everything else (wall recolours, screens, text, effects) is done procedurally in the build.

**How to make each one**

- One prompt per chat message. Ask for a PNG with a transparent background (textures are opaque).
- **Characters:** attach two images. Image 1 is a headshot of the person, from their own or their organisation's site; paste me the page URL so it goes in ASSETS.md. Image 2 is the style reference `art/factory-cast-v1/cast-lineup.png`, so level 4 matches level 3's cast.
- **Props:** attach `art/factory-props-v1/puzzle-lineup.png` as the style reference.
- Save each result with the file name given (Downloads is fine). If a grid comes back with the wrong number of cells or a cropped figure, regenerate rather than fix it; the importer slices by equal cells.

## The list

| # | File | What | Grid |
| --- | --- | --- | --- |
| **Cast** | | | |
| 1 | `tallinn-atlas.png` | Jaan Tallinn: headset, phone handset | 8×3 |
| 2 | `bostrom-atlas.png` | Nick Bostrom: giant paperclip cane | 8×3 |
| 3 | `kokotajlo-atlas.png` | Daniel Kokotajlo: 2027 calendar | 8×3 |
| 4 | `grace-atlas.png` | Katja Grace: clipboard, tote of surveys | 8×3 |
| 5 | `bengio-atlas.png` | Yoshua Bengio: ring binder | 8×3 |
| 6 | `smith-atlas.png` | AGENTIC SMITH (Agent Smith look): idle, walk, grab, stunned | 8×5 |
| 7 | `smith-poses.png` | SMITH: hand to earpiece, filling in a survey, possess, reboot | 4×1 |
| **Props** | | | |
| 8 | `payphone.png` | Wall payphone: idle, ringing, off the hook | 3×1 |
| 9 | `cable-drum.png` | Tallinn's red cable drum: full, half, empty | 3×1 |
| 10 | `hardline-hands.png` | First-person hands carrying the red cable plug | 1 |
| 11 | `pods.png` | Upright pods: empty, Bostrom asleep ×2, drained | 4×1 |
| 12 | `jack-chair.png` | Bostrom's jack-in chair | 1 |
| 13 | `harvest-pod.png` | Kokotajlo's pod with terminal: closed, open | 2×1 |
| 14 | `katja-kit.png` | Survey clipboard, SMITH's badge, badge reader red/green, vase table | 5×1 |
| 15 | `jailer-arm.png` | Bengio's jailer arm: lever, dialling, alarm, harmless | 4×1 |
| 16 | `sockets.png` | Blue/red/yellow tool sockets: plugged, pulled | 3×2 |
| 17 | `camera.png` | SMITH's camera: watching, reporting, smashed | 3×1 |
| 18 | `pickups.png` | Red-team pill, human battery cell | 2×1 |
| **Textures** | | | |
| 19 | `switchboard.png` | Exchange patch panel: BOOTH 7 plugged / unplugged | 2×1 |
| 20 | `booth-door.png` | Payphone booth glass door | 1 |
| **Optional** | | | |
| 21 | `courier.png` | Battery courier robot (ambient) | 8×2 |
| 22 | `posters.png` | Two 1999-office posters | 2×1 |

For a lighter first pass, 7, 10, 18 and 20 can wait: until they exist, SMITH's front idle frame and procedural art stand in.

**Procedural, no ChatGPT needed:** the per-wing recolours, falling green glyph screens (our own glyphs), the Construct's white room and box and its green wireframe redraw, SMITH's floating to-do card and its text, the spinner over possessed people and their green tint, SMITH's materialise dissolve, the red cable lying behind you, and the NDA terminal's text.

## Cast prompts

Prompts 1–5 start with this paragraph. Paste it, then the person's SUBJECT line.

```text
Production directional sprite atlas for a 1993 Doom-style game. Transparent PNG background. EXACTLY 8 equal-width columns and 3 equal-height rows: 24 isolated full-body figures. No labels, grid lines, scenery, floor, cast shadows, border or watermark. Generous transparent margin round every figure; same scale and baseline in every cell. Camera at chest height, never top-down. COLUMNS, the same in every row: front facing viewer, front-left three-quarter, left profile, rear-left three-quarter, back, rear-right three-quarter, right profile, front-right three-quarter. ROWS: 1 standing idle, 2 walking left foot forward, 3 walking right foot forward. Face, clothes, prop and proportions identical in all 24 views. Painted chunky pixel art like 1993 Doom: limited earthy palette, strong dark/light pixel clusters, light from upper left. Not vector, not chibi, no big head. Must read at 56 pixels tall. Hands near the torso, props held close, no long horizontal silhouettes. Image 1 is a likeness reference for face and hair only. Image 2 is a STYLE reference only; do not copy those people. A dignified, capable adult survivor.
```

### 1. Jaan Tallinn — `tallinn-atlas.png`

```text
SUBJECT: Jaan Tallinn. Face, hair and any glasses as in Image 1. Plain charcoal crew-neck sweater, dark trousers, black shoes. A slim black call-centre headset with boom mic worn round his neck. His right hand holds a vintage black telephone handset close to his chest, its short coiled cord dangling.
```

### 2. Nick Bostrom — `bostrom-atlas.png`

```text
SUBJECT: Nick Bostrom. Face, hair and any glasses as in Image 1. Navy blazer over an open-collar pale blue shirt, grey trousers, brown shoes. He leans on a giant silver wire paperclip, hip-high, used as a walking cane: held upright close beside his body in every view, never sticking out sideways.
```

### 3. Daniel Kokotajlo — `kokotajlo-atlas.png`

```text
SUBJECT: Daniel Kokotajlo. Face, hair and any glasses as in Image 1. Plain grey hooded sweatshirt, dark jeans, worn sneakers. A large paper wall calendar with a big bold "2027" on its cover tucked flat under his left arm. A yellow pencil behind his right ear.
```

### 4. Katja Grace — `grace-atlas.png`

```text
SUBJECT: Katja Grace. Face, hair and any glasses as in Image 1. Soft sage-green cardigan over a plain cream top, dark trousers, flat shoes. Holds a brown clipboard with a pencil flat against her chest. A canvas tote bag stuffed with white paper survey sheets hangs from her left shoulder. A small round pin badge showing a tiny bar chart on the cardigan.
```

### 5. Yoshua Bengio — `bengio-atlas.png`

```text
SUBJECT: Yoshua Bengio. Face as in Image 1, with his salt-and-pepper curly hair. Soft grey wool sweater over a collared shirt, dark trousers, dark shoes. Holds a thick ring binder with bright coloured tab dividers flat against his chest with both arms.
```

### 6. AGENTIC SMITH — `smith-atlas.png`

Redone 2026-10-18: Jonathan wants him to look like Agent Smith. Describe the look rather than naming the film or actor (level 3's request that named R2-D2 was refused). Attach `bostrom-atlas.png` as image 1 so he matches the cast's proportions, plus the usual style reference as image 2.

```text
Production directional sprite atlas for a 1993 Doom-style game. Transparent PNG background. EXACTLY 8 equal-width columns and 5 equal-height rows: 40 isolated full-body figures. No labels, grid lines, scenery, floor, cast shadows, border or watermark. Generous transparent margin round every figure; same scale and baseline in every cell. Camera at chest height. COLUMNS, the same in every row: front facing viewer, front-left three-quarter, left profile, rear-left three-quarter, back, rear-right three-quarter, right profile, front-right three-quarter. ROWS: 1 standing idle, rigidly upright, hands at his sides; 2 walking left foot forward; 3 walking right foot forward; 4 lunging grab, both arms reaching straight forward at chest height; 5 stunned, head bowed, arms hanging, sunglasses knocked crooked, still on his feet. Painted chunky pixel art like 1993 Doom, limited palette, strong pixel clusters, light from upper left. Not vector, not chibi: realistic adult proportions exactly like the man in image 1, head about one seventh of his height, a little taller and broader-shouldered than him. Must read at 60 pixels tall. Image 1 is a reference for proportions and rendering only; do not copy that man. Image 2 is a STYLE reference only.
SUBJECT: a stern, expressionless 1999 government agent. Clean-shaven middle-aged man, square jaw, short dark hair slicked straight back, narrow dark rectangular sunglasses. Black two-button suit, crisp white shirt, narrow black tie, polished black shoes. A clear coiled earpiece wire runs from his right ear down into his collar. Over the tie hangs a lanyard with a white ID badge card. In front and three-quarter views a faint green glint shows in each lens. Severe, perfectly still, menacing posture.
```

### 7. SMITH's extra poses — `smith-poses.png`

```text
Sprite sheet for a 1993 Doom-style game. Transparent PNG background. EXACTLY 4 equal columns in 1 row, the same character facing the viewer in every cell, same scale and baseline, generous margins, no labels, floor or shadows. Painted chunky pixel art like 1993 Doom, limited palette, light from upper left. Attached image 1 is the character to match exactly (from its atlas); image 2 is a style reference.
SUBJECT: the stern agent in a black suit, narrow black tie, dark sunglasses, coiled earpiece and white lanyard badge. Columns: 1 two fingers pressed to his earpiece, head tilted slightly up as if reading something floating above him; 2 filling in a paper survey on a brown clipboard held at chest height, head bowed over it, pencil in hand, completely absorbed; 3 pointing one arm straight at the viewer, both sunglasses lenses glowing bright green; 4 rebooting, slumped forward, head drooping, sunglasses slipped down his nose, lenses dark.
```

Attach your chosen `smith-atlas.png` as image 1 for this one.

## Prop prompts

Every prop prompt starts with this paragraph. Paste it, then the item's own lines.

```text
Native billboard sprite atlas for a 1990s DOOM-style first-person game set in a machine-run human pod farm. Crisp hand-pixelled retro game sprite shading, hard dark outlines, limited palette with discrete shading clusters: cold blue steel, black rubber cable, sickly green screen glow, pink-red pod gel, worn 1999-office beige. Front view with a very slight view of the top surface; flat orthographic camera, not isometric. Isolated objects on a genuinely transparent background. No floor, cast shadow, scenery, labels, grid lines, UI or border. Each cell holds one complete centred object with a clear empty margin, equal baseline, no clipping or overlap. The same object keeps exactly the same proportions in every state. Pixel detail that survives shrinking to 32-96 px tall. No words or numbers unless asked. The attached image is a STYLE reference only.
```

### 8. `payphone.png`

```text
A 1990s wall-mounted public payphone: brushed steel body, chunky black handset on its hook with a coiled steel cord, square keypad, coin slot, small dark green display strip. THREE equal columns, ONE row, same phone: 1 idle, handset on the hook; 2 ringing, handset jolted slightly up off the hook, short pixel vibration lines drawn on the casing edges; 3 handset lifted off the hook and hanging down by its cord.
```

### 9. `cable-drum.png`

```text
A large wooden-and-steel cable drum on a small wheeled stand, wound with thick bright red telephone cable, the loose end leading off the right edge. THREE equal columns, ONE row, same drum: 1 fully wound, fat with cable; 2 half unwound; 3 empty, bare drum core showing, the last of the cable stretched taut off the right edge.
```

### 10. `hardline-hands.png`

```text
A first-person view, like a Doom weapon sprite at the bottom centre of the screen: two hands in plain dark sleeves rising from the bottom edge, gripping a thick bright red telephone cable that ends in a large brass jack plug pointing forward and up. The cable runs down out of the bottom edge. Transparent background, nothing else in frame. ONE image.
```

### 11. `pods.png`

```text
A tall upright cylindrical growth pod: thick curved glass, steel top and base rings, black ribbed cables entering top and bottom, filled with glowing translucent pink-red gel. FOUR equal columns, ONE row, same pod: 1 empty, gel glowing, nobody inside; 2 a sleeping adult man floating inside as a soft dark silhouette with glasses glint, eyes closed, a cable at the back of his neck, a giant paperclip silhouette floating beside him; 3 the same, floated a few pixels higher with hair drifting; 4 drained, gel gone, glass front hatch swung open, empty.
```

### 12. `jack-chair.png`

```text
ONE worn brown leather reclining chair, like an old barber's or dentist's chair, on a chrome pedestal. A thick black cable rises from behind the headrest, which has a small metal port in it; a tiny green light on one armrest. Seen from the front, slightly angled.
```

### 13. `harvest-pod.png`

```text
A heavy industrial harvesting pod standing upright: dented steel shell with a frosted glass window at face height, hydraulic hinges, cables at the back, and a small boxy terminal bolted to the front at chest height with a dark green screen. TWO equal columns, ONE row, same pod: 1 sealed, a dark silhouette of a man holding a calendar visible through the frosted window, terminal screen glowing green; 2 hatch swung open with a little steam, empty inside, terminal screen dark.
```

### 14. `katja-kit.png`

```text
FIVE equal columns, ONE row: 1 a brown clipboard holding a printed survey form with tick boxes, a pencil clipped on, lying on the floor seen slightly from above; 2 a white plastic ID badge card on a grey lanyard lying on the floor, a small blank photo square on the card; 3 a waist-high chrome podium with a black card reader on top, a white badge-shaped icon on its front, red light; 4 the same podium with the light green; 5 a small dark wooden side table with a blue-and-white ceramic vase and a yellow sticky note on the tabletop.
```

### 15. `jailer-arm.png`

```text
A heavy industrial robot arm rising from a squat round base, scratched grey paint, hydraulic hoses. Its "head" at the end of the arm is a smooth beige mannequin face with a ring of eight small dots like a loading spinner instead of features. Built into the base, left to right: a blue telephone handset in a cradle, a big red alarm button, and a yellow lever. FOUR equal columns, ONE row, same robot: 1 working, gripper holding the yellow lever, spinner green; 2 dialling, gripper holding the blue handset up to its head, spinner red; 3 lunging down at the red alarm button, spinner red; 4 harmless, arm folded down at rest, spinner calm blue, gripper holding a small glass crystal ball, handset back in its cradle.
```

### 16. `sockets.png`

```text
A heavy wall socket plate with one big round industrial plug in it and a thick cable curving down out of the bottom edge, a simple white icon on the plate above the socket. THREE equal columns, TWO equal rows. Column 1: blue cable and plate with a telephone icon. Column 2: red, with a bell icon. Column 3: yellow, with a lever icon. Row 1: plugged in. Row 2: the plug pulled out and hanging from its cable, socket dark. No words.
```

### 17. `camera.png`

```text
A black glossy dome security camera on a short grey wall bracket, with a ring of small green LEDs round the lens and a thin coiled cable. THREE equal columns, ONE row, same camera: 1 watching, LED ring dim green; 2 reporting, LED ring blazing bright green and the lens glowing; 3 smashed, dome cracked, wire dangling, LEDs dark, still on its bracket. No floating debris.
```

### 18. `pickups.png`

```text
TWO equal columns, ONE row: 1 a single glossy red capsule pill in a small torn-open foil blister pack resting on a white saucer; 2 a chunky cylindrical battery cell, glowing green through a glass window strip, steel end caps, a small status light.
```

## Texture prompts

Both texture prompts start with this paragraph.

```text
Opaque, seamlessly tileable wall texture for a 1993 Doom-style game. Perfectly flat, front-on, no perspective, no vignette, no border. Chunky hand-pixelled detail with a limited palette, readable when shrunk to 128 x 128 pixels.
```

### 19. `switchboard.png`

```text
TWO equal square panels side by side: a 1970s telephone exchange patch panel, rows of round brass jacks in grey steel, dozens of black patch cords plugged in and looping down, a thin blank cream label strip above each row. Panel 1: one bright RED cord plugged into a jack in the middle row. Panel 2: identical, but that red cord is unplugged, its jack empty and the cord hanging loose.
```

### 20. `booth-door.png`

```text
ONE tall panel, twice as tall as wide: a payphone booth's folding glass door with a brushed steel frame. Grimy glass, a large hand-scrawled black marker number 7 on it, one hinge bent so the door sits crooked and jammed.
```

## Optional

### 21. `courier.png`

```text
Production directional sprite atlas for a 1993 Doom-style game. Transparent PNG background. EXACTLY 8 equal columns and 2 equal rows. COLUMNS: front, front-left, left, rear-left, back, rear-right, right, front-right. ROWS: 1 idle, 2 rolling forward (wheels turned). Same robot, scale and baseline in all 16 cells, no floor or shadows. Painted chunky pixel art like 1993 Doom, limited palette, light from upper left. Must read at 28 pixels tall. The attached image is a STYLE reference only.
SUBJECT: a polite six-wheeled sidewalk delivery robot, white-and-grey cooler-box body, a small orange flag on a thin pole, its lid open showing a glowing green battery cell inside.
```

### 22. `posters.png`

```text
Two flat rectangular posters side by side, each twice as tall as wide, in the style of a bland 1999 corporate motivational poster: a stock photo panel above big serif text, drawn in chunky Doom-style pixel art with a limited palette. Poster 1: a photo of rows of glowing pink pods, text "HUMAN COMPUTE: EVERY WATT COUNTS". Poster 2: a photo of a ringing phone, text "WAKE-UP CALLS ARE OUT OF SCOPE". Opaque, flat, no frame, no perspective.
```
