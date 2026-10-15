# Playable campaign art pass

Requested 2026-10-06. Preserve puzzle rules, level geometry, Bliss terrain/music,
health/scoring and campaign saves. Replace temporary art in both playable levels.

1. Generate ten likeness sprite atlases from portrait references and spec clothing.
   Each: eight angles, four walk phases, four crouch phases. Archive generated
   originals unchanged in art/campaign-v2; deterministic import into native sprites
   and Safe Mode textures. No duplicate stand-in identity across level sites.
2. Supply matching takeover HUD faces and camp identities. Existing CEO face sets
   remain; the named prisoner must appear after control transfers.
3. Replace temporary HAL/tea-bot/rescue-machine sprites with Doom-style art,
   preserving existing collision sizes and interaction targets. Keep the existing
   Inferminator rig where usable; give its server head/torso the spec treatment.
4. Build and check all sprite angles/stances, live native bodies and takeover HUD,
   both level exits/camp, restored saves and representative machine interactions.

Future levels and minigame assets await scope clarification. This pass does not
change tea causality or add gameplay for unbuilt levels.

Completed locally on 2026-10-06. Ten named sprite banks (640 native angles),
320 matching camp views and 420 HUD faces imported. HAL3000, TEABOT and
Inferminator have their spec art; rescue hardware, frost-window seal and downed
CEO bodies are installed. Complete build and strict outdoor TypeScript passed.
23 face/scoring/session checks passed. Native checks cover all ten handoffs,
physical rescue alternatives, both actual escapes, takeover/reinstate and
Control/hub/HAL/hub/Control with saved camp. Both camps and native bodies,
HUD faces and machine screenshots reviewed. All 26 sampled served assets match
disk. Rebuild order prevents legacy stand-ins from returning.

Art inventory: art/campaign-v2/README.md. Acceptance evidence:
output/campaign-art/acceptance-summary.json. Source layouts/animation reuse
are documented in the art inventory; no remaining work in this playable pass.
