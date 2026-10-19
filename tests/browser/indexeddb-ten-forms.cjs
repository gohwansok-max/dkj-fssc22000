// 실제 운영 프로필 대신 새 브라우저 컨텍스트와 localhost만 사용한다.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({serviceWorkers:'block'});
await context.route('**/*',route=>{const u=route.request().url();if(u.includes('/js/dkj-firebase-config.js'))return route.fulfill({contentType:'application/javascript',body:'window.DKJ_FIREBASE = {};'});return u.startsWith('http://127.0.0.1:5500/')?route.continue():route.abort();});
const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept(d.type()==='prompt'?'삭제':undefined);});
for(const form of ['DKJ-H-01-01','DKJ-H-01-02','DKJ-F-053','DKJ-QC-001','DKJ-S-02-01','DKJ-S-02-02','DKJ-S-02-09','DKJ-S-02-12','DKJ-S-02-32','FR-014']){
 dialogs.length=0;await page.goto('http://127.0.0.1:5500/records/'+form+'.html');await page.evaluate(()=>DkjStorage.ready());await page.waitForTimeout(160);
 await page.evaluate(()=>{document.querySelectorAll('input:not([type=file]):not([type=hidden]),textarea,select').forEach(el=>{
 if(el.disabled||el.readOnly)return;
 if(el.tagName==='SELECT'){const opt=Array.from(el.options).find(o=>o.value);if(opt)el.value=opt.value;}
 else if(el.type==='date')el.value='2026-10-16';else if(el.type==='month')el.value='2026-10';else if(el.type==='time')el.value='09:00';else if(el.type==='datetime-local')el.value='2026-10-16T09:00';else if(el.type==='number')el.value='1';else if(el.type==='checkbox'||el.type==='radio')el.checked=true;else if(!el.value)el.value='시험';
 el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});});
 if(form==='DKJ-H-01-02')await page.locator('[data-cycle=fe]').first().click();
 if(await page.locator('#btnAllPass').count())await page.locator('#btnAllPass').click();
 await page.locator('#btnSave').evaluate(b=>{b.click();b.click();});await page.waitForTimeout(450);
 const n=await page.evaluate(async form=>(await DkjRecordStore.list(form)).length,form);
 assert.equal(n,1,form+' 중복 클릭 저장 건수');
 console.log(form,JSON.stringify({n,dialogs}));
 if(n>0){await page.reload();await page.evaluate(()=>DkjStorage.ready());await page.waitForTimeout(120);const load=page.locator('#historyList [data-load],#historyList [data-edit],#historyRows [data-edit]');if(await load.count())await load.first().click(); const del=page.locator('#historyList [data-del],#historyList [data-del2],#historyRows [data-del]');if(await del.count())await del.first().click();await page.waitForTimeout(150);const remaining=await page.evaluate(async form=>(await DkjRecordStore.list(form)).length,form);assert.equal(remaining,0,form+' 화면 삭제');console.log('AFTER_UI_DELETE',form,remaining);}
}
assert.deepEqual(errors,[]);console.log('ERRORS',errors);await context.close();await browser.close();})().catch(e=>{console.error(e);process.exitCode=1;});
