/** Render the game's own Mincho monogram at native launcher sizes. */
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const font=(await readFile(path.join(root,'public/fonts/yukyo-mincho-v62.woff2'))).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><radialGradient id="night" cx="45%" cy="30%" r="80%"><stop stop-color="#392320"/><stop offset=".55" stop-color="#191516"/><stop offset="1" stop-color="#100f10"/></radialGradient>
<linearGradient id="gold" x2=".6" y2="1"><stop stop-color="#ead4a8"/><stop offset=".5" stop-color="#c3a174"/><stop offset="1" stop-color="#8c6844"/></linearGradient>
<style>@font-face{font-family:Monogram;src:url(data:font/woff2;base64,${font})}text{font-family:Monogram;}</style></defs>
<path fill="url(#night)" d="M0 0h512v512H0z"/>
<circle cx="256" cy="256" r="174" fill="none" stroke="#c3a174" stroke-opacity=".20" stroke-width="2"/>
<path d="M256 76l7 7-7 7-7-7zm0 346 7 7-7 7-7-7z" fill="#b99360"/>
<text x="256" y="348" text-anchor="middle" font-size="250" font-weight="600" fill="url(#gold)">幽</text>
</svg>`;
const output=path.join(root,'public/icons');await mkdir(output,{recursive:true});
await mkdir(path.join(root,'assets/branding'),{recursive:true});await writeFile(path.join(root,'assets/branding/home-icon.svg'),svg);
const options=process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{};
const browser=await playwright.chromium.launch({headless:true,...options});
try{for(const [name,size] of [['apple',180],['192',192],['512',512],['maskable',512]]){
 const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
 await page.setContent(`<style>html,body{margin:0;background:#100f10}svg{display:block;width:100vw;height:100vh}</style>${svg}`);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(output,`yukyo-${name}-v62.png`),omitBackground:false});await page.close();
}}finally{await browser.close();}
console.log('Created opaque 180, 192, 512 and maskable home-screen icons.');
