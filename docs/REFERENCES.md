# p(DOOM): reference and asset findings

Checked 2026-10-04. These are source findings and prototype decisions, not blanket permission for unreviewed assets. No reference software or third-party artwork was downloaded or executed during this research.

## Linked procedural-dungeon reference

The supplied [X post](https://x.com/majidmanzarpour/status/2073880053536940501?s=20) and its `twitter.com` equivalent both failed retrieval. I could not read that exact post, watch its clip, verify what it demonstrated, or confirm a download/license attached to the post itself.

There is a public [Dungeon Forge repository by majidmanzarpour](https://github.com/majidmanzarpour/threejs-procedural-dungeon). Its [README](https://raw.githubusercontent.com/majidmanzarpour/threejs-procedural-dungeon/main/README.md) links the same X profile and a [live demo](https://procedural-dungeon.netlify.app/). This is a strong related lead, **not proof that it is the exact linked clip**. The repository and documentation were inspected; the demo was not run.

The README describes seeded room placement, separation, Delaunay triangulation, a minimum spanning tree plus loops, semantic room labels, tile carving, and generated decoration. It says the renderer and generator share one tightly coupled JavaScript module. Its procedural textures and geometry are documented as generated in-browser. These are documented capabilities, not independently tested performance or correctness claims. This is a layout/rendering demonstration, not a drop-in first-person survival game or navigation solution.

The actual [LICENSE file](https://raw.githubusercontent.com/majidmanzarpour/threejs-procedural-dungeon/main/LICENSE) is MIT, copyright 2026 Majid Manzarpour. Reuse of software/substantial portions requires keeping the copyright and permission notice. No repository code has been incorporated into this slice. If adopted later, pin a revision, retain its notice, inspect its dependencies, and verify generated maps against the game's traversal and rescue requirements. Do not inherit advertised frame-rate claims without measurement.

**Useful design inference:** its loops and seeded layouts are relevant to creating alternate routes. Begin with an authored test map; later require every generated seed to contain a visible primary route, a breachable alternate, a surveillance choice and an outside rescue connection. Random rooms alone will not produce those decisions.

## Humans: MakeHuman / MPFB

The user's [official license page](https://static.makehumancommunity.org/about/license.html) explicitly says both projects use a split license: **core assets are CC0**, MPFB source is GPL, and MakeHuman source is AGPL. The core-asset grant permits modifying and using those assets without payment or attribution. That asset grant is the relevant route for exported game characters; it does not mean every community upload or external animation has the same license.

Availability is verified: the official [MPFB download page](https://static.makehumancommunity.org/mpfb/downloads.html) recommends the Blender extension platform and notes that optional asset packs are separate. The [rigging guide](https://static.makehumancommunity.org/mpfb/docs/characters/rig.html) documents Default, GameEngine, CMU and Mixamo rigs. The [closed-source game FAQ](https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html) is also available. This is a practical source for varied adult humans on one chosen skeleton.

Proposed asset workflow: author several unmistakably adult character presets, choose one rig and bone naming scheme for all, export glTF/GLB, and reuse a small in-place locomotion/interaction set. Keep a provenance list of every mesh, skin, body part and animation. Test scale, held-object sockets, deformation, and animation sharing in the actual runtime. “A shared rig is supported” does not establish that any particular export is ready or tested.

**Prototype gap:** locally generated articulated bodies are temporary; they are not imported MakeHuman meshes, skin weights or production animation. The naked adult crowd must remain explicit when replacing them. No clothing substitution or loss of the crowd gag is implied by the placeholder.

## Original Doom content versus open engine code

The [id Software DOOM repository](https://github.com/id-Software/DOOM) identifies its current code license as GPL-2.0 and its readme separately says real Doom data is needed. The old readme's historical non-profit wording is not a substitute for inspecting the current license. [Freedoom's official explanation](https://freedoom.github.io/about.html) explicitly distinguishes open Doom program code from proprietary graphics, audio, levels, setting and characters.

**Original Doom textures/maps are not licensed by the engine's source release.** This task supplied no owned IWAD or explicit artwork grant. The slice therefore does not bundle extracted original Doom materials. A later local mod could require the player's own installed game data; that is a different distribution model from copying Doom textures into a browser game's public asset folder. This research does not establish permission for that copying.

The [GZDoom repository](https://github.com/ZDoom/gzdoom) describes a modder-oriented Doom source port with OpenGL/Vulkan rendering and scripting, under GPL v3. Its docs pages encountered an anti-bot challenge. A literal mod remains technically plausible; exact human-model, dynamic-map, bot and forecast requirements have not been proven in it. The standalone selection is a project judgment about this small test, not a claim that modern Doom ports cannot support the concept.

## Lawful Doom-like alternative: Freedoom

[Freedoom](https://freedoom.github.io/about.html) offers original reusable textures, sounds and music. Its actual [COPYING file](https://raw.githubusercontent.com/freedoom/freedoom/master/COPYING.adoc) permits source and binary redistribution with or without modification subject to retaining the copyright, conditions and disclaimer, and forbids implied endorsement using project/contributor names without permission. This is a BSD-style license, not CC0.

Freedoom is a credible next material source, with its credits and license retained. It is **not the original Doom art** and cannot be described as satisfying that exact fidelity request. No Freedoom assets are included in the current procedural-art slice. Textures from arbitrary WADs require their own asset/license audit; a freely downloadable WAD is not automatically a freely reusable art pack.

## Windows XP Bliss landscape

Microsoft's [own account of Bliss](https://www.microsoft.com/en-us/copilot/blog/2021/07/08/get-nostalgic-with-new-microsoft-teams-backgrounds/) identifies Charles O'Rear's 1996 photo, says Microsoft bought its rights, and confirms its use as the Windows XP wallpaper. The page offers a modified version for Teams backgrounds. That stated use does not establish a game-asset redistribution grant.

Microsoft's [copyrighted-content policy](https://www.microsoft.com/en-us/legal/intellectualproperty/copyright/permissions) requires an applicable license or permission for uses of its content and contains specific, limited allowed uses. No broad reusable-game license for the original Bliss bitmap was verified. Microsoft-hosted community Q&A contains conflicting informal ownership claims; those are not a rights grant and are not relied upon here.

**Local decision:** construct original terrain, sky and clouds to test the uncanny reveal. Do not embed the Windows wallpaper or logos. Preserve the requested saturated green hill, low rolling silhouette, bright blue sky and recognizable composition as an art target. The current procedural field is a stand-in; exact image fidelity remains unresolved. A highly faithful final reproduction and any public release need a settled asset/rights plan, not an assumption that a famous desktop image is public domain.

## Terminator-like hunter

No specific hunter asset was provided, so its availability, rig quality and rights cannot be verified. “Terminator-like” can guide the physical threat: upright metal machine, steady motion, severe silhouette and an overwhelming gun. The temporary hunter should be an original construction.

A future supplied asset needs its actual license and provenance checked, including any franchise or actor-likeness restrictions; a listing's “free download” or a purchased mesh by itself does not answer all those questions. No commercial character asset was purchased or copied. The slice does not claim to contain a licensed Terminator/T-800 character.

## Standalone engine rights and decision

[Three.js's license](https://github.com/mrdoob/three.js/blob/dev/LICENSE) is MIT. [Godot's official license page](https://godotengine.org/license/) likewise describes an MIT engine and separates engine notices from ownership of original game content. Godot's [3D navigation overview](https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_introduction_3d.html) documents integrated pathfinding components. Neither license grants rights to third-party art imported into a project.

The local slice uses Three.js to make the interaction loop, outdoor connection and cloned-state forecast readily reviewable in a browser. Godot remains a serious candidate for a larger version with skeletal characters and richer physical manipulation. A literal Doom mod should be chosen if genuine Doom data and mod compatibility become the highest priority, after a small feasibility test for the character crowd and the exact forecast architecture. These are engineering judgments, not benchmark results.

## Consequential unresolved items

| Item | Current evidence | What remains |
| --- | --- | --- |
| Exact X clip | Direct retrieval failed; same-author MIT repository exists | Verify the actual post/video before claiming a match |
| MakeHuman adult crowd | Official CC0 core assets and supported rigs verified | Produce/import/export-test the actual shared-rig models |
| Genuine Doom materials | Source/data separation verified | Authorized source and a distribution strategy; currently placeholders |
| Faithful Bliss reveal | Original identity verified; no game-redistribution grant found | Final original-art direction or explicit image rights; currently procedural |
| Terminator asset | None supplied | Inspect the chosen asset and license; currently original proxy |
| Physical sandbox | Standalone permits it architecturally | Current route/object rules are a small test, not arbitrary physical simulation |

No public deployment, push, purchase, or third-party asset redistribution is part of this task.
