#!/usr/bin/env python3
"""Update the local runtime's factory without rebuilding the other three maps."""
import argparse, os, tempfile, zipfile
from importlib.machinery import SourceFileLoader
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--resources-only',action='store_true',help='Refresh scripts after a native compile fix; keep existing map geometry.')
    args=parser.parse_args()
    build=SourceFileLoader('doom_builder',str(Path(__file__).with_name('build-doom-mod.py'))).load_module()
    target=ROOT/'doom-web/pdoom.pk3'
    if not target.exists():raise SystemExit('Run npm run setup:runtime or npm run build:doom first.')
    if not args.resources_only:
        from build_factory_map import build_factory
        wad=build_factory(ROOT,build.udmf_block,build.make_wad)
    replacements=dict(build.resource_files())
    if not args.resources_only:replacements['maps/E2M7.wad']=wad
    replacements['textures.factory']=(ROOT/'doom-mod/factory-textures.txt').read_bytes()
    replacements['textures.factorytheme']=(ROOT/'doom-mod/factory-theme-textures.txt').read_bytes()
    replacements['animdefs.factory']=(ROOT/'doom-mod/factory-theme-animdefs.txt').read_bytes()
    replacements['gldefs.factory']=(ROOT/'doom-mod/factory-theme-gldefs.txt').read_bytes()
    replacements['trnslate.factory']=(ROOT/'doom-mod/factory-theme-trnslate.txt').read_bytes()
    fd,name=tempfile.mkstemp(prefix='.factory-',suffix='.pk3',dir=target.parent);os.close(fd)
    pending=Path(name)
    try:
        with zipfile.ZipFile(target) as old,zipfile.ZipFile(pending,'w',zipfile.ZIP_DEFLATED) as new:
            for entry in old.infolist():
                if entry.filename not in replacements and entry.filename!='patches/factory/textures.txt':new.writestr(entry,old.read(entry))
            for key,value in replacements.items():new.writestr(key,value)
        pending.replace(target)
    finally:pending.unlink(missing_ok=True)
    print('Local factory preview updated:',target)

if __name__=='__main__':main()
