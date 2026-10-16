// 실제 운영 프로필 대신 새 브라우저 컨텍스트와 localhost만 사용한다.
const {chromium}=require('playwright');
const fs=require('fs'), assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
 await context.route('**/*',async route=>{
  const url=route.request().url();if(url.includes('/js/dkj-firebase-config.js'))return route.fulfill({contentType:'application/javascript',body:'window.DKJ_FIREBASE = {};'});
  return url.startsWith('http://127.0.0.1:5500/')?route.continue():route.abort();
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const file of ['index.html','records-archive.html','audit-trail.html','executive-dashboard.html','quality-dashboard.html','capa-management.html','periodic-alerts.html','emergency-drills.html','management-culture.html','traceability.html','fssc-audit-readiness.html','haccp-team-settings.html','production-dashboard.html']){
  await page.goto('http://127.0.0.1:5500/'+file);await page.evaluate(()=>DkjStorage.ready());await page.waitForTimeout(150);
  console.log('PAGE',file,await page.locator('#dkj-storage-status').innerText());
 }
 await page.goto('http://127.0.0.1:5500/records/FR-001.html');await page.evaluate(()=>DkjStorage.ready());await page.waitForTimeout(100);
 const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
 // 화면 입력·저장 경로를 실제 클릭으로 확인한다.
 await page.evaluate(()=>{
  document.querySelectorAll('input:not([type=file]):not([type=hidden]),textarea,select').forEach(el=>{
   if(el.disabled||el.readOnly)return;
   if(el.tagName==='SELECT'){const option=Array.from(el.options).find(o=>o.value);if(option)el.value=option.value;}
   else if(el.type==='date')el.value='2026-10-16';else if(el.type==='month')el.value='2026-10';else if(el.type==='number')el.value='1';else if(!el.value)el.value='시험';
   el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  });
 });
 await page.locator('#btnSave').click();await page.waitForTimeout(300);
 console.log('UI_SAVE',await page.evaluate(async()=>({count:(await DkjRecordStore.list('FR-001')).length,status:document.getElementById('saveStatus')?.textContent})),dialogs);
 const created=await page.evaluate(async()=>{const r=await DkjRecordStore.save('FR-001',{title:'백업 검증',workDate:'2026-10-16',audit:[],checks:{},values:{}});return r.id;});
 await page.goto('http://127.0.0.1:5500/records-archive.html');await page.evaluate(()=>DkjStorage.ready());await page.waitForTimeout(150);
 const download=page.waitForEvent('download');await page.locator('#arcBackup').click();const file=await download;
 const dump=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
 assert.ok(dump.records['dkj:records:FR-001:list:v1'].some(r=>r.id===created));
 const restored=await page.evaluate(async dump=>{
  const added=await DkjExport.restoreJson(JSON.stringify(dump));const records=await DkjExport.collect();return {added,count:records.length};
 },dump);console.log('ARCHIVE_BACKUP_RESTORE',restored,'keys',Object.keys(dump.records).length);
 // 같은 origin의 두 탭이 동시에 저장해도 배열을 덮어쓰지 않는지 확인한다.
 const second=await context.newPage();await second.goto('http://127.0.0.1:5500/records/FR-001.html');await second.evaluate(()=>DkjStorage.ready());
 await Promise.all([page.evaluate(()=>DkjRecordStore.save('CONCURRENT',{title:'탭1'})),second.evaluate(()=>DkjRecordStore.save('CONCURRENT',{title:'탭2'}))]);
 assert.equal(await page.evaluate(async()=>(await DkjRecordStore.list('CONCURRENT')).length),2);
 console.log('TWO_TAB_SAVE_PASS');
 console.log('ERRORS',JSON.stringify(errors));assert.deepEqual(errors,[]);await context.close();await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
