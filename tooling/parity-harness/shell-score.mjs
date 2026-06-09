import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import * as fs from 'node:fs';
const OUT='/Users/cameronmcallister/Github/dr-parity/tooling/parity-harness/output/2026-06-05-appsweb-baseline';
// Shell regions @1440x900 (IconBar 0-64, Sidebar 64-320, TopBar full-width 0-56)
const W=1440,H=900;
function inShell(x,y){
  if (x<64) return true;                 // IconBar
  if (x<320) return true;                // Sidebar
  if (y<56) return true;                 // TopBar
  return false;
}
function read(p){return PNG.sync.read(fs.readFileSync(p));}
function pad(src){ if(src.width===W&&src.height===H)return src; const o=new PNG({width:W,height:H});o.data.fill(0);PNG.bitblt(src,o,0,0,Math.min(src.width,W),Math.min(src.height,H),0,0);return o;}
function maskContent(png){ const {data}=png; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(!inShell(x,y)){const i=(y*W+x)*4;data[i]=0;data[i+1]=0;data[i+2]=0;data[i+3]=255;}} return png;}
function score(a,b){ const pa=maskContent(pad(read(a))); const pb=maskContent(pad(read(b))); const diff=new PNG({width:W,height:H}); const dp=pixelmatch(pa.data,pb.data,diff.data,W,H,{threshold:0.1});
  // shell pixels count
  let shellPx=0; for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(inShell(x,y))shellPx++;
  fs.writeFileSync(a.replace('.png','-shellmask.png'),PNG.sync.write(pa));
  return {score:1-dp/shellPx, diffPixels:dp, shellPx};}
for(const r of ['home','list']){
  const s=score(`${OUT}/${r}-oracle.png`,`${OUT}/${r}-appsweb.png`);
  console.log(`${r} shell pixel-match: ${(s.score*100).toFixed(1)}%  (diff ${s.diffPixels}/${s.shellPx})`);
}
