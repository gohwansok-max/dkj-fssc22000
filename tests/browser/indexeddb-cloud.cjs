// 실제 운영 프로필 대신 새 브라우저 컨텍스트와 localhost만 사용한다.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 const calls=[],db={sync_meta:{schemaVersion:1},records:{}};let offline=false;
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/__storage_test__.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>격리 시험</body></html>'});
  if(url.hostname==='test.invalid'){
   if(offline)return route.abort();
   const key=url.pathname.replace('/test/','').replace(/\.json$/,''),method=route.request().method();calls.push({key,method});
   const parts=key.split('/');let parent=db;for(const p of parts.slice(0,-1))parent=parent[p]||(parent[p]={});const name=parts.at(-1);
   if(method==='PUT')parent[name]=route.request().postDataJSON();let out=parent[name]??null;
   if(url.searchParams.get('shallow')==='true'&&out)out=Object.fromEntries(Object.keys(out).map(k=>[k,true]));
   return route.fulfill({contentType:'application/json',body:JSON.stringify(out)});
  }
  if(url.hostname==='127.0.0.1')return route.continue();return route.abort();
 });
 await page.goto('http://127.0.0.1:5500/__storage_test__.html');
 await page.evaluate(()=>{
  localStorage.setItem('dkj:records:T:list:v1',' [{"id":"old","title":"원문","updatedAt":"2026-10-16T01:00:00Z","audit":[]}] ');
  window.DKJ_FIREBASE={apiKey:'isolated',databaseURL:'https://test.invalid',root:'test'};
  window.DkjAuth={user:()=>({name:'시험',empId:'4343',role:'system_admin'}),token:()=> 'local-token-test',staff:()=>[],isSystemAdmin:()=>true};
 });
 for(const f of ['dkj-async','dkj-store','dkj-storage-migration'])await page.addScriptTag({url:'http://127.0.0.1:5500/js/'+f+'.js'});
 await page.evaluate(()=>{
  const original=DkjStore.set;
  window.migrationBlocked=false;
  DkjStore.set=async function(k,v){if(k==='dkj:records:T:list:v1'&&!window.migrationReleased){window.migrationBlocked=true;await new Promise(r=>window.releaseMigration=r);}return original(k,v);};
 });
 await page.addScriptTag({url:'http://127.0.0.1:5500/js/dkj-storage.js'});
 await page.addScriptTag({url:'http://127.0.0.1:5500/js/dkj-cloud-sync.js'});
 await page.evaluate(()=>{window.syncFlight=DkjCloudSync.sync();});
 await page.waitForFunction(()=>window.migrationBlocked);
 assert.equal(calls.length,0);
 await page.evaluate(()=>{window.migrationReleased=true;window.releaseMigration();});
 await page.evaluate(()=>window.syncFlight);
 assert.ok(calls.some(c=>c.method==='PUT'));
 assert.equal(db.sync_meta.schemaVersion,1);
 console.log('MIGRATION_UPLOAD_BARRIER_PASS',calls.length);
 for(const f of ['dkj-record-store','dkj-approval'])await page.addScriptTag({url:'http://127.0.0.1:5500/js/'+f+'.js'});
 const saved=await page.evaluate(async()=>{const r=await DkjRecordStore.save('T',{title:'오프라인',rows:[],audit:[]});return r.id;});
 offline=true;await page.evaluate(()=>DkjCloudSync.sync().catch(()=>null));
 assert.equal(await page.evaluate(async id=>(await DkjRecordStore.get('T',id)).title,saved),'오프라인');
 offline=false;await page.evaluate(()=>DkjCloudSync.sync());
 const remote=db.records[Buffer.from('dkj:records:T:list:v1').toString('base64url')].value;
 assert.ok(remote.some(r=>r.id===saved));
 const original=await page.evaluate(()=>localStorage.getItem('dkj:records:T:list:v1'));
 assert.ok(!original.includes('오프라인'));
 console.log('OFFLINE_RECONNECT_SYNC_PASS');
 const legacy=await context.newPage();await legacy.goto('http://127.0.0.1:5500/__storage_test__.html');
 await legacy.evaluate(()=>localStorage.setItem('dkj:records:T:list:v1',JSON.stringify([{id:'legacy-new',title:'구버전 탭 저장',updatedAt:'2026-10-16T09:00:00Z'}])));
 await page.waitForFunction(async()=>!!await DkjRecordStore.get('T','legacy-new'));
 assert.ok(await page.evaluate(async id=>!!await DkjRecordStore.get('T',id),saved));
 console.log('LEGACY_TAB_MERGE_PASS');
 await context.close();await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
