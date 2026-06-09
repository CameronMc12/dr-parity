import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import * as fs from 'node:fs';
const OUT='/Users/cameronmcallister/Github/dr-parity/tooling/parity-harness/output/2026-06-05-appsweb-baseline';
function read(p){return PNG.sync.read(fs.readFileSync(p));}
function pad(src,W,H){if(src.width===W&&src.height===H)return src;const o=new PNG({width:W,height:H});o.data.fill(0);PNG.bitblt(src,o,0,0,Math.min(src.width,W),Math.min(src.height,H),0,0);return o;}
// Sobel edge map on luminance -> binary edges. Theme-independent (edges are where structure/borders/text are).
function edges(png){const {width:W,height:H,data}=png;const lum=new Float32Array(W*H);
  for(let i=0;i<W*H;i++){lum[i]=0.299*data[i*4]+0.587*data[i*4+1]+0.114*data[i*4+2];}
  const out=new PNG({width:W,height:H});
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    const gx=lum[(y-1)*W+x+1]+2*lum[y*W+x+1]+lum[(y+1)*W+x+1]-lum[(y-1)*W+x-1]-2*lum[y*W+x-1]-lum[(y+1)*W+x-1];
    const gy=lum[(y+1)*W+x-1]+2*lum[(y+1)*W+x]+lum[(y+1)*W+x+1]-lum[(y-1)*W+x-1]-2*lum[(y-1)*W+x]-lum[(y-1)*W+x+1];
    const mag=Math.sqrt(gx*gx+gy*gy);const v=mag>60?255:0;const i=(y*W+x)*4;out.data[i]=v;out.data[i+1]=v;out.data[i+2]=v;out.data[i+3]=255;}
  return out;}
function jaccardEdges(a,b){let inter=0,uni=0;for(let i=0;i<a.data.length;i+=4){const ea=a.data[i]>0,eb=b.data[i]>0;if(ea&&eb)inter++;if(ea||eb)uni++;}return uni?inter/uni:1;}
for(const r of ['home','list']){
  let o=read(`${OUT}/${r}-oracle.png`),a=read(`${OUT}/${r}-appsweb.png`);
  const W=Math.max(o.width,a.width),H=Math.max(o.height,a.height);
  o=pad(o,W,H);a=pad(a,W,H);
  const eo=edges(o),ea=edges(a);
  fs.writeFileSync(`${OUT}/${r}-oracle-edges.png`,PNG.sync.write(eo));
  fs.writeFileSync(`${OUT}/${r}-appsweb-edges.png`,PNG.sync.write(ea));
  const j=jaccardEdges(eo,ea);
  console.log(`${r} edge-structure IoU (theme-independent): ${(j*100).toFixed(1)}%`);
}
