// Generated from art/campaign-v2/roster.json by import-campaign-art.py.
export const CAST_IDS=["liron", "stuart", "eliezer", "hinton", "holly", "rob", "dan", "nate", "roman", "beth"];
export const LEVEL_CAST={"five-prisons": ["liron", "stuart", "eliezer", "hinton", "holly"], "hal-station": ["rob", "dan", "nate", "roman", "beth"]};
export function castForLevel(level){return LEVEL_CAST[level]||LEVEL_CAST["five-prisons"];}
