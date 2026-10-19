// 전 서식 손서명 점검 — records/*.html 전부에 대해 결재 서명(작성·검토·승인)을 실제 UI로 하고,
// 정본 인쇄 DOM 에 서명 그림(.sig-img)이 결재 단계 수만큼 들어가는지 확인한다.
// 사용: python -m http.server 5500 (저장소 루트) 후  node tests/browser/signature-all-forms.cjs
//       특정 서식만: ONLY=DKJ-QC-001,DKJ-H-01-01 node tests/browser/signature-all-forms.cjs
// FIRST_ONLY=1 이면 첫 단계(작성)만 서명하고, 결재칸 중 서명한 칸만 채워지고 나머지는 비어 있는지 본다
//       (승인 전 칸에 이름이 미리 찍히지 않는지).
// 로그인 흉내(DkjAuth.user 대체)와 Firebase 설정 차단을 쓰므로 운영 데이터에 닿지 않는다.
const {chromium}=require('playwright');
const fs=require('fs');
const ONLY=process.env.ONLY?process.env.ONLY.split(','):null; const codes0=fs.readdirSync(require('path').join(__dirname,'..','..','records')).filter(f=>f.endsWith('.html')).map(f=>f.slice(0,-5)).sort();
const codes=ONLY?codes0.filter(c=>ONLY.includes(c)):codes0;
(async()=>{
 const b=await chromium.launch();
 const results=[];
 async function one(code){
  const r={code,stages:0,signed:0,sigImgs:-1,err:''};
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1200,height:900}});
  await ctx.route('**/dkj-firebase-config.js*',x=>x.fulfill({contentType:'application/javascript',body:'window.DKJ_FIREBASE={};'}));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,x=>x.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  pg.on('dialog',d=>d.accept());
  await pg.addInitScript(()=>{ window.print=function(){}; });
  try{
   await pg.goto('http://127.0.0.1:5500/records/'+code+'.html',{waitUntil:'load'}); await pg.waitForTimeout(2200);
   r.hasSigMod=await pg.evaluate(()=>!!window.DkjSignature);
   await pg.evaluate(()=>{ const u={name:'시험자',empId:'0001',uid:'u1',role:'system_admin'}; DkjAuth.user=()=>u; DkjAuth.can=()=>true; });
   r.stages=await pg.evaluate(()=>document.querySelectorAll('.apv-btn').length);
   for(let i=0;i<(process.env.FIRST_ONLY?1:4);i++){
     const btn=await pg.$('.apv-btn:not([disabled])'); if(!btn) break;
     await btn.scrollIntoViewIfNeeded().catch(()=>{}); await btn.click();
     const ov=await pg.waitForSelector('.dkj-sig-overlay',{timeout:3000}).catch(()=>null);
     if(!ov){ r.err+='noDialog '; break; }
     const c=await pg.$('.dkj-sig-canvas'); const bb=await c.boundingBox();
     await pg.mouse.move(bb.x+30,bb.y+90); await pg.mouse.down(); for(let k=0;k<20;k++) await pg.mouse.move(bb.x+30+k*9,bb.y+90+Math.sin(k/3)*30); await pg.mouse.up();
     const keep=await pg.$('[data-keep]'); if(keep) await pg.uncheck('[data-keep]').catch(()=>{});
     await pg.click('[data-act=done]'); await pg.waitForTimeout(700);
     r.signed++;
   }
   r.signoffOk=await pg.evaluate(()=>{ return document.querySelectorAll('.apv-stage.done').length; });
   r.apvThumbs=await pg.evaluate(()=>document.querySelectorAll('img.apv-sig').length);
   const pb=await pg.$('#btnPrint'); if(pb){ await pb.click().catch(()=>{}); await pg.waitForTimeout(900); }
   else r.err+='noPrintBtn ';
   r.sigImgs=await pg.evaluate(()=>document.querySelectorAll('.sig-img').length);
   r.cells=await pg.evaluate(()=>{ const c=[...document.querySelectorAll('.ps-sign,.off-sign,.mx-sign,.qc-sign')]; const ne=c.filter(e=>(e.textContent||'').trim()||e.querySelector('img')); return {total:c.length,nonEmpty:ne.length,textOnly:ne.filter(e=>!e.querySelector('img')).length}; });
  }catch(e){ r.err+=String(e).slice(0,100); }
  if(errs.length) r.err+=' js:'+errs[0];
  await ctx.close(); return r;
 }
 let idx=0; async function worker(){ while(idx<codes.length){ const c=codes[idx++]; results.push(await one(c)); } }
 await Promise.all([worker(),worker(),worker(),worker()]);
 results.sort((a,b)=>a.code<b.code?-1:1);
 
 const first=!!process.env.FIRST_ONLY;
 const bad=results.filter(r=>first ? !(r.hasSigMod&&r.signed===1&&r.sigImgs>=1&&r.cells&&r.cells.textOnly===0&&r.cells.nonEmpty===r.sigImgs&&!r.err) : !(r.hasSigMod&&r.signed>0&&r.sigImgs>=r.signed&&(!r.cells||r.cells.textOnly===0)&&!r.err));
 console.log('total',results.length,'ok',results.length-bad.length,'bad',bad.length);
 bad.forEach(r=>console.log(JSON.stringify(r)));
 await b.close();
})();
