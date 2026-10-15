Generators for `docs/spec/04-bliss-hub-world.md`: `python3 render_map.py && rsvg-convert -o ../../hub-map.png ../../hub-map.svg`; `python3 export_layout.py`.
`terrain.py` mirrors `src/bliss.ts` HILLS; `hub.py` holds the proposed hills, pads, structures and routes. Read-only with respect to the game source.
`hub.py`/`hubnp.py` also hold the **proposed continuous terrain fade** (revision 2): `h·smooth(0,14,distToApronRect)`, which replaces the z<0 / z≥0 split in `bliss.ts` and removes the seam at z = 0. `terrain.py` stays an exact copy of today's code for comparison.
