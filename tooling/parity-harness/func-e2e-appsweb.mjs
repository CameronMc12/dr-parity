import { chromium } from 'playwright';
const BASE='http://127.0.0.1:5173', WS='90152566819';
const consoleErrors=[],pageErrors=[];
const FATAL=/getServerSnapshot|should be cached|Maximum update depth|infinite|Hydration failed|Cannot read prop/i;
const board=[];const row=(f,p,n)=>{board.push({f,p:p?'PASS':'FAIL',n});console.log(`[${p?'PASS':'FAIL'}] ${f} — ${n}`);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('pageerror',e=>pageErrors.push(e.message||String(e)));
try{
  // 1. Home renders
  await page.goto(`${BASE}/${WS}/home`,{waitUntil:'networkidle',timeout:45000});
  await sleep(3000);
  const homeTxt=await page.evaluate(()=>document.body.innerText);
  row('Home renders',/My Tasks|Good (morning|afternoon|evening)|begins with tasks/i.test(homeTxt),homeTxt.slice(0,60).replace(/\n/g,' '));
  // 2. Sidebar nav items present
  const navOk=/Home/.test(homeTxt)&&/Spaces/.test(homeTxt)&&/Docs/.test(homeTxt)&&/Dashboards/.test(homeTxt);
  row('Sidebar nav rail',navOk,'Home/Spaces/Docs/Dashboards present');
  // 3. Navigate to a List view
  await page.goto(`${BASE}/${WS}/v/l/2kyr6013-1115`,{waitUntil:'networkidle',timeout:45000});
  await sleep(3500);
  const listTxt=await page.evaluate(()=>document.body.innerText);
  row('List view renders',/List/.test(listTxt)&&/(TO DO|IN PROGRESS|COMPLETE|Add Task|Group)/i.test(listTxt),'view tabs + status groups');
  // 4. View tabs present (List/Board/Calendar/Gantt/Table)
  const tabsOk=/Board/.test(listTxt)&&/Calendar/.test(listTxt)&&/Gantt/.test(listTxt)&&/Table/.test(listTxt);
  row('View tabs bar',tabsOk,'List/Board/Calendar/Gantt/Table');
  // 5. Add Task control exists & clickable
  const addBtn=page.getByText('Add Task',{exact:false}).first();
  const hasAdd=await addBtn.count()>0;
  row('Add Task control',hasAdd,hasAdd?'present':'missing');
  // 6. Switch to Board view via tab click
  let boardOk=false;
  try{await page.getByText('Board',{exact:false}).first().click({timeout:5000});await sleep(2000);const bt=await page.evaluate(()=>document.body.innerText);boardOk=/Board|TO DO|IN PROGRESS/i.test(bt);}catch(e){}
  row('Board view tab switch',boardOk,boardOk?'switched':'failed');
  // 7. localStorage persistence store present
  const store=await page.evaluate(()=>{for(const k of Object.keys(localStorage))if(/parity|workspace|views/i.test(k))return k;return null;});
  row('Store persistence',!!store,store?`key=${store}`:'no store key');
  // 8. No fatal console errors
  const fatal=[...consoleErrors,...pageErrors].filter(e=>FATAL.test(e));
  row('No fatal console errors',fatal.length===0,fatal.length?fatal[0].slice(0,80):`${consoleErrors.length} non-fatal warns`);
}finally{await b.close();}
const pass=board.filter(r=>r.p==='PASS').length;
console.log(`\nFUNCTIONAL PASS RATE: ${pass}/${board.length} (${(pass/board.length*100).toFixed(0)}%)`);
import('node:fs').then(fs=>fs.writeFileSync('/Users/cameronmcallister/Github/dr-parity/tooling/parity-harness/output/2026-06-05-appsweb-baseline/functional.json',JSON.stringify({base:BASE,passRate:pass/board.length,rows:board,consoleErrorCount:consoleErrors.length,pageErrorCount:pageErrors.length},null,2)));
