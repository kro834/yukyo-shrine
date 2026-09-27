import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

const base=process.env.NEXT_PUBLIC_BASE_PATH;
if(!base||!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(base))throw new Error('Set NEXT_PUBLIC_BASE_PATH to the GitHub Pages repository path before building.');
const output=resolve('dist/client');
const html=readFileSync(join(output,'index.html'),'utf8');
if(!html.includes(base+'/_next/static/'))throw new Error('Build output does not use the requested Pages base path. Rebuild with NEXT_PUBLIC_BASE_PATH set.');
const manifest=JSON.parse(readFileSync(join(output,'manifest.webmanifest'),'utf8'));
manifest.id=manifest.start_url=manifest.scope=base+'/';
for(const icon of manifest.icons??[]){
  if(icon.src.startsWith('/')&&!icon.src.startsWith(base+'/'))icon.src=base+icon.src;
  const local=icon.src.slice(base.length+1);
  if(!existsSync(join(output,local)))throw new Error('Missing app icon: '+local);
}
writeFileSync(join(output,'manifest.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(output,'.nojekyll'),'');
const commit=process.env.GITHUB_SHA??'local';
if(commit!=='local'&&!/^[a-f0-9]{40}$/.test(commit))throw new Error('Invalid source commit');
writeFileSync(join(output,'version.json'),JSON.stringify({commit,basePath:base})+'\n');
console.log('GitHub Pages assets prepared for '+base+'/');
