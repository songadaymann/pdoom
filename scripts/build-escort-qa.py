"""Add native assertions to a private QA copy; never change the playable pack."""
from pathlib import Path
import zipfile,sys
ROOT=Path(__file__).resolve().parents[1]
output=ROOT/(sys.argv[1] if len(sys.argv)>1 else 'output/escort-polish/qa.pk3');output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(ROOT/'doom-web/pdoom.pk3') as source,zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as target:
    for item in source.infolist():
        data=source.read(item.filename)
        if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/EscortQA.zs"\n'
        if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDEscortQA", "PDThreatQA"',1)
        target.writestr(item.filename,data)
    target.writestr('actors/EscortQA.zs',(ROOT/'scripts/escort-qa.zs').read_bytes())
