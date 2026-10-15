# Existing levels: fear and machine life

The approved tone rules live in GAME-SPEC.md (Fear, whimsy, and a world that
keeps running) and spec/07-robots.md. The Control Problem retains the Terminator
as its only roaming robot. Confabulation Station introduces TEABOT and one quiet
civilian playing chess against itself. More robots are future-level decisions.

Both maps now have five of Claude's finished lab posters, two animated green
terminals, two irregular light fixtures and two intermittent floor-vent steam
leaks. Posters and terminals use fixed wall sprites on actual solid surfaces,
not view-facing billboards. No new decoration blocks player or escort movement.
Flicker is bounded to32 light units and does not alter rescue/refuge light tags.
Steam has no noise loop; particles last48tics and spawn only near the player.

The HAL chess lounge is off the north wall of the upper eastern corridor,
between the start and refuge approach. Stand around(560,216) facing north. Its
robot at(560,368) cycles thinking / moving a piece / celebrating / resetting.
Raised sill and blocking glass separate it from navigation. It does not attack,
report, offer an interaction, grant a shortcut, or trigger a discovery card.
The original piece tap is positional and only emitted within240u with sight.

Implementation: scripts/level-environment.py, scripts/build-environment-assets.py,
doom-mod/actors/LevelEnvironment.zs. Art: art/hal-civilian/chess-sheet.png (original
built-in image_gen output), prompt.txt, imported.png and manifest.json. Import
uses isolated cell crops, common nearest-neighbor scaling and floor alignment.
Posters stay in ignored doom-web/local/posters and are packed from there, using
textures.posters. Glass has a separate textures.environment lump so rebuilding
HAL's cell markings cannot erase its declaration.

Build: npm run build:doom. Acceptance: npm run test:doom:environment. Test pack
with floor-correct positioning is private under output/inhabited-levels/qa.pk3;
no QA handler or console binding enters the player pack. Runtime environment
counts, light levels and civilian poses are exposed in render_game_to_text.

Verified 2026-10-08: both maps' posters, steam and flicker; all four chess poses,
blocking glass and nearby-only taps; all nine HAL rescue scenarios; first-level
wrench pickup/camera destruction; normal browser startup and movement. Native
screenshots and reports are under output/inhabited-levels. Refresh and restart
the level to load the rebuilt pack from the existing local server.

Entrance/refuge flow revised 2026-10-08: hub visits keep the authored start
outside the refuge, with a fixed entrance retreat control. HAL now has an
interior bulkhead control too. First-rescue guidance is separate from solo
refuge discovery, and completed empty visits cannot trigger its finale seal.
The master spec and map/hub specialist docs record the same future-level rule.
Acceptance: npm run test:doom:refuge-flow; native reports under output/refuge-flow.
