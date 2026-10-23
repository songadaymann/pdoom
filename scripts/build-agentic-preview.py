#!/usr/bin/env python3
"""Update a local runtime's level 4 (E2M2) without rebuilding the other maps.

  python3 scripts/build-agentic-preview.py                      # rebuild E2M2 + resources into doom-web/pdoom.pk3
  python3 scripts/build-agentic-preview.py --resources-only     # scripts/textures only, keep the map
  python3 scripts/build-agentic-preview.py --out output/agentic/qa-grace.pk3 --only grace

--out writes a separate pk3 (the source is always doom-web/pdoom.pk3). --only keeps one rescue's
puzzle file and swaps the other four for their compiling stubs in scripts/agentic-stubs/, so
parallel puzzle work never breaks anyone else's build.
"""
import argparse, os, tempfile, zipfile
from importlib.machinery import SourceFileLoader
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUZZLES={'tallinn':'AgenticTallinn.zs','bostrom':'AgenticBostrom.zs','kokotajlo':'AgenticKokotajlo.zs','grace':'AgenticGrace.zs','bengio':'AgenticBengio.zs'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--resources-only',action='store_true',help='Refresh scripts after a native compile fix; keep existing map geometry.')
    parser.add_argument('--out',default=str(ROOT/'doom-web/pdoom.pk3'),help='pk3 to write (default doom-web/pdoom.pk3).')
    parser.add_argument('--only',choices=sorted(PUZZLES),help='Keep this rescue; stub the other four puzzle files.')
    args=parser.parse_args()
    build=SourceFileLoader('doom_builder',str(Path(__file__).with_name('build-doom-mod.py'))).load_module()
    source=ROOT/'doom-web/pdoom.pk3';target=Path(args.out).resolve()
    if not source.exists():raise SystemExit('Run npm run setup:runtime or npm run build:doom first.')
    if not args.resources_only:
        from build_agentic_map import build_agentic
        wad=build_agentic(ROOT,build.udmf_block,build.make_wad)
    replacements=dict(build.resource_files())  # after the build: it rewrites PDAgenticMap.zs and the sprites
    if not args.resources_only:replacements['maps/E2M2.wad']=wad
    elif (ROOT/'output/agentic/E2M2-TEXTMAP.txt').exists():
        # The last built geometry, which matches the committed PDAgenticMap.zs (the source pk3 may predate level 4).
        text=(ROOT/'output/agentic/E2M2-TEXTMAP.txt').read_bytes()
        replacements['maps/E2M2.wad']=build.make_wad([('E2M2',b''),('TEXTMAP',text),('ENDMAP',b'')])
    for lump,name in build.AGENTIC_LUMPS:
        if (ROOT/'doom-mod'/name).exists():replacements[lump]=(ROOT/'doom-mod'/name).read_bytes()
    stubbed=[]
    if args.only:
        for name,file in PUZZLES.items():
            stub=ROOT/'scripts/agentic-stubs'/file
            if name!=args.only and stub.exists():replacements[f'actors/{file}']=stub.read_bytes();stubbed.append(file)
    target.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.agentic-',suffix='.pk3',dir=target.parent);os.close(fd)
    pending=Path(name)
    try:
        with zipfile.ZipFile(source) as old,zipfile.ZipFile(pending,'w',zipfile.ZIP_DEFLATED) as new:
            for entry in old.infolist():
                if entry.filename not in replacements:new.writestr(entry,old.read(entry))
            for key,value in replacements.items():new.writestr(key,value)
        pending.replace(target)
    finally:pending.unlink(missing_ok=True)
    print('Local agentic preview updated:',target,f'(only {args.only}; stubbed {", ".join(stubbed) or "none"})' if args.only else '')

if __name__=='__main__':main()
