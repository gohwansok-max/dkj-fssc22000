// 실제 운영 프로필 대신 새 브라우저 컨텍스트와 localhost만 사용한다.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext({serviceWorkers:'block'});await c.route('**/*',r=>{const u=r.request().url();if(u.includes('/js/dkj-firebase-config.js'))return r.fulfill({contentType:'application/javascript',body:'window.DKJ_FIREBASE={};'});return u.startsWith('http://127.0.0.1:5500/')?r.continue():r.abort();});const p=await c.newPage();await p.goto('http://127.0.0.1:5500/records/FR-001.html');await p.evaluate(()=>DkjStorage.ready());
const result=await p.evaluate(async()=>{
 const photo='data:image/jpeg;base64,'+'A'.repeat(12*1024*1024);const rec=await DkjRecordStore.save('LARGE',{title:'12MiB 저장 시험',photo,audit:[]});
 const loaded=await DkjRecordStore.get('LARGE',rec.id);const key='dkj:records:LARGE:list:v1';const before=await DkjStore.get(key);
 const native=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=native.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
 let aborted=false;try{await DkjStore.batch({[key]:'새 값','dkj:records:LARGE:draft:v1':'초안'});}catch(e){aborted=true;}finally{IDBDatabase.prototype.transaction=native;}
 return{photoLength:loaded.photo.length,local:localStorage.getItem(key),aborted,unchanged:before===await DkjStore.get(key),draftAbsent:await DkjStore.get('dkj:records:LARGE:draft:v1')===undefined,audit:DkjApproval.verify(loaded.audit).ok};
});assert.equal(result.photoLength,12*1024*1024+23);assert.equal(result.local,null);assert.ok(result.aborted&&result.unchanged&&result.draftAbsent&&result.audit);console.log('LARGE_AND_ATOMIC',JSON.stringify(result));await c.close();await b.close();})().catch(e=>{console.error(e);process.exitCode=1;});
