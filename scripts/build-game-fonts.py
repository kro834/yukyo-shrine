"""Subset the official Noto JP sources for the game's current Japanese copy.
Requires fonttools[woff] 4.64.0 and brotli 1.2.0. Source TTFs live in
work/font-sources; see public/fonts/SOURCES.md for upstream URLs and licenses.
"""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'work/font-tools'))
from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
from fontTools.varLib.instancer import instantiateVariableFont

text = ''.join(p.read_text(encoding='utf-8-sig') for p in (ROOT / 'app').rglob('*') if p.suffix in ('.ts', '.tsx', '.css'))
characters = set(map(ord, text)) | set(range(32, 256)) | set(range(0x3000, 0x3100))
report = []
for source, family, output, weight in [
    ('NotoSansJP', 'Yukyo UI', 'yukyo-ui-v62.woff2', (400, 700)),
    ('NotoSerifJP', 'Yukyo Mincho', 'yukyo-mincho-v62.woff2', 600),
]:
    path = ROOT / 'work/font-sources' / (source + '.ttf')
    font = TTFont(path)
    covered = set(font.getBestCmap()) & characters
    options = Options()
    options.layout_features = ['kern', 'liga', 'clig', 'calt', 'locl', 'ccmp', 'mark', 'mkmk', 'palt', 'halt', 'tnum']
    options.name_IDs = ['*']
    subset = Subsetter(options=options)
    subset.populate(unicodes=covered)
    subset.subset(font)
    instantiateVariableFont(font, {'wght': weight}, inplace=True)
    names = {1: family, 2: 'Regular', 3: family + '-GameSubset-v62', 4: family, 6: family.replace(' ', '') + '-Regular', 16: family, 17: 'Regular', 25: family.replace(' ', '')}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.flavor = 'woff2'
    target = ROOT / 'public/fonts' / output
    font.save(target)
    # Re-open the actual distributable and verify every selected supported glyph.
    built = TTFont(target)
    assert covered <= set(built.getBestCmap()), 'subset lost a supported game character'
    report.append({'source': source, 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'file': output, 'bytes': target.stat().st_size, 'glyph_characters': len(covered)})
(ROOT / 'public/fonts/font-build.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
