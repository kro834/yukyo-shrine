import hashlib,json,subprocess
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
api_path=root/'work/hotel-wood-api-v64.json'
if not api_path.exists():subprocess.run(['curl.exe','-L','--fail','https://api.polyhaven.com/files/dark_wood','-o',str(api_path)],check=True)
api=json.loads(api_path.read_text(encoding='utf-8'))
out=root/'public/materials/hotel';out.mkdir(parents=True,exist_ok=True)
sources={}
for key,suffix in [('Diffuse','diff'),('nor_gl','nor_gl'),('Rough','rough')]:
 for size in ['1k','2k']:
  info=api[key][size]['jpg'];name='dark_wood_'+suffix+'_'+size
  source=root/'work'/(name+'.jpg')
  subprocess.run(['curl.exe','-L','--fail','--max-time','60',info['url'],'-o',str(source)],check=True)
  assert hashlib.md5(source.read_bytes()).hexdigest()==info['md5']
  Image.open(source).save(out/(name+'.webp'),quality=94 if key=='nor_gl' else 91,method=6)
  sources[name]=info
(out/'sources-v64.json').write_text(json.dumps(sources,indent=2),encoding='utf-8')
(out/'SOURCES.md').write_text('Dark Wood — Poly Haven, CC0 1.0. https://polyhaven.com/a/dark_wood\nPhotography: Dimitrios Savva. Baking: Dario Barresi. Tiling: Rico Cilliers.\nOfficial 1K/2K diffuse, OpenGL normal and roughness maps downloaded 2026-09-08; upstream MD5 verified. Local WebP encoding preserves the photographed surface. Exact upstream URLs/checksums: sources-v64.json.\n',encoding='utf-8')
print('Hotel wood verified and packed')
