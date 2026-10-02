'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const adjacent=path.join(__dirname,'dkj-cloud-sync.js');
const code=fs.readFileSync(fs.existsSync(adjacent)?adjacent:path.join(__dirname,'../js/dkj-cloud-sync.js'),'utf8');
const key='dkj:records:form:list:v1', encode=s=>Buffer.from(s).toString('base64url');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const rec=(id,n=1)=>({id,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-0'+n+'T00:00:00Z',value:n});
function env(mode=1,useAbort=true){
 class Storage{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
 const localStorage=new Storage(),sessionStorage=new Storage(),events={},docEvents={},timeouts=new Map(),intervals=new Map(),calls=[];
 let serial=0,hook=null,jsonHook=null,fail=false;
 const db={sync_meta:{schemaVersion:mode},records:{},records_v2:{}};
 const document={visibilityState:'visible',addEventListener:(n,f)=>docEvents[n]=f,getElementById:()=>({style:{}}),createElement:()=>({style:{}}),body:{appendChild(){}}};
 const ctx={console,Storage,localStorage,sessionStorage,document,DKJ_FIREBASE:{apiKey:'test-placeholder',databaseURL:'https://example.invalid',root:'root'},DkjAuth:{user:()=>({name:'test'}),token:()=> 'local-token-test'},navigator:{userAgent:'test'},location:{reload(){}},CustomEvent:function(n,o){this.type=n;this.detail=o?.detail;},dispatchEvent(){},addEventListener:(n,f)=>events[n]=f,setTimeout:(f,ms)=>{timeouts.set(++serial,{f,ms});return serial;},clearTimeout:id=>timeouts.delete(id),setInterval:f=>{intervals.set(++serial,f);return serial;},clearInterval:id=>intervals.delete(id),btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),fetch:async(url,opt)=>{
 const u=new URL(url),path=u.pathname.replace('/root/','').replace(/\.json$/,'');const call={path,method:opt.method,shallow:u.searchParams.get('shallow')==='true',signal:opt.signal};calls.push(call);if(hook)await hook(call);if(fail)throw new Error('offline');
 const parts=path.split('/');let parent=db;for(const p of parts.slice(0,-1)){if(!parent[p])parent[p]={};parent=parent[p];}const last=parts.at(-1);
 if(opt.method==='PUT')parent[last]=JSON.parse(opt.body);if(opt.method==='DELETE')delete parent[last];let data=parent[last]??null;
 if(call.shallow&&data)data=Object.fromEntries(Object.keys(data).map(k=>[k,true]));return {status:200,ok:true,json:async()=>{if(jsonHook)await jsonHook(call);return copy(data);}};
 }};if(useAbort)ctx.AbortController=AbortController;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,db,calls,document,events,docEvents,timeouts,intervals,putLocal:v=>localStorage.map.set(key,JSON.stringify(v)),putRemote:(v,stamp=1)=>db.records[encode(key)]={value:copy(v),updatedAt:stamp},hook:f=>hook=f,jsonHook:f=>jsonHook=f,offline:v=>fail=v,local:()=>JSON.parse(localStorage.getItem(key)),sync:()=>ctx.DkjCloudSync.sync(),flush:async()=>{for(let i=0;i<100;i++)await Promise.resolve();}};
}
const tests=[];function test(n,f){tests.push([n,f]);}
test('unchanged polls: shallow keys and timestamp only',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();e.calls.length=0;await e.sync();assert.deepEqual(e.calls.map(c=>[c.path,c.shallow]),[['records',true],['records/'+encode(key)+'/updatedAt',false]]);assert.equal(e.calls.some(c=>c.method!=='GET'),false);});
test('changed row merges local-only, deleted flag, audit, approvals',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();e.putRemote([{...rec('a',2),deleted:true,audit:[{id:'audit'}],signoff:{qa:{name:'ok'}}},rec('remote')],2);e.putLocal([rec('a'),rec('local')]);await e.sync();assert.equal(e.local().length,3);const r=e.local().find(r=>r.id==='a');assert.equal(r.deleted,true);assert.equal(r.audit[0].id,'audit');assert.equal(r.signoff.qa.name,'ok');assert.equal(e.db.records[encode(key)].value.length,3);});
test('missing local storage defeats cached revision',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();e.ctx.localStorage.map.delete(key);e.calls.length=0;await e.sync();assert.equal(e.local().length,1);assert(e.calls.some(c=>c.path==='records/'+encode(key)));});
test('concurrent save while payload is fetched is not overwritten',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();e.putRemote([rec('a',2)],2);e.hook(c=>{if(c.path==='records/'+encode(key)&&c.method==='GET')e.ctx.localStorage.setItem(key,JSON.stringify([rec('saved',3)]));});await e.sync();assert.equal(e.local()[0].id,'saved');});
test('concurrent deletion during metadata GET cannot resurrect remote records',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);e.hook(c=>{if(c.path.endsWith('/updatedAt'))e.ctx.localStorage.setItem(key,'[]');});await e.sync();assert.equal(e.local().length,0);assert.equal(e.calls.some(c=>c.path==='records/'+encode(key)&&c.method==='GET'),false);});
test('V2 local deletion during root GET cannot resurrect records',async()=>{const e=env(2);e.putLocal([rec('a')]);e.db.records_v2[encode('form')]={[encode('a')]:{data:rec('a'),workflow:{},audit:{},approvals:{}}};e.hook(c=>{if(c.path==='records_v2')e.ctx.localStorage.setItem(key,'[]');});await e.sync();assert.equal(e.local().length,0);});
test('offline preserves local, successful retry fetches changed row',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();e.putRemote([rec('a',2)],2);e.offline(true);await assert.rejects(e.sync(),/offline/);assert.equal(e.local()[0].value,1);e.offline(false);await e.sync();assert.equal(e.local()[0].value,2);});
test('legacy missing timestamp always full fetch fallback',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);delete e.db.records[encode(key)].updatedAt;await e.sync();e.calls.length=0;await e.sync();assert(e.calls.some(c=>c.path==='records/'+encode(key)&&!c.shallow));});
test('single flight shares promise',async()=>{const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);const a=e.sync(),b=e.sync();assert.equal(a,b);await Promise.all([a,b]);assert.equal(e.calls.filter(c=>c.path==='records').length,1);});
test('hidden startup/poll/focus/online skip, explicit sync allowed',async()=>{const e=env();e.document.visibilityState='hidden';e.ctx.DkjCloudSync.start();await e.flush();for(const f of e.intervals.values())f();e.events.focus();e.events.pageshow();e.events.online();await e.flush();assert.equal(e.calls.length,0);await e.sync();assert(e.calls.length>0);});
test('visible event burst coalesces startup',async()=>{const e=env();e.ctx.DkjCloudSync.start();e.events.focus();e.events.pageshow();e.events.online();await e.flush();assert.equal(e.calls.filter(c=>c.path==='records').length,1);});
test('V2 full fallback preserves timestamp-less audit/approval/lock updates',async()=>{const e=env(2);const base={data:rec('a'),workflow:{updatedAt:rec('a').updatedAt,locked:false},audit:{},approvals:{}};e.db.records_v2[encode('form')]={[encode('a')]:base};e.putLocal([rec('a')]);await e.sync();base.audit[encode('x')]={id:'x',at:'2026-01-01',action:'approve'};base.approvals[encode('qa')]={name:'reviewer'};base.workflow.locked=true;e.calls.length=0;await e.sync();assert.equal(e.local()[0].audit[0].id,'x');assert.equal(e.local()[0].signoff.qa.name,'reviewer');assert.equal(e.local()[0].locked,true);assert(e.calls.some(c=>c.path==='records_v2'&&!c.shallow));});
async function verifyHungRequest(useAbort,hangJson){
 const e=env(1,useAbort);e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();
 const stuck=c=>c.path==='records'?new Promise(()=>{}):undefined;
 if(hangJson)e.jsonHook(stuck);else e.hook(stuck);
 const flight=e.sync(),rejection=assert.rejects(flight,/timed out after 15000ms/);await e.flush();
 e.ctx.localStorage.setItem(key,JSON.stringify([rec('saved',3)]));
 const saveTimer=[...e.timeouts.entries()].find(([,t])=>t.ms===600);assert(saveTimer);e.timeouts.delete(saveTimer[0]);saveTimer[1].f();await e.flush();
 assert.equal(e.calls.some(c=>c.method==='PUT'),false);
 const timeout=[...e.timeouts.entries()].find(([,t])=>t.ms===15000);assert(timeout);timeout[1].f();await rejection;
 if(useAbort)assert.equal(e.calls.find(c=>c.path==='records'&&c.signal?.aborted)?.signal.aborted,true);
 e.hook(null);e.jsonHook(null);await e.flush();
 if(useAbort)assert.equal(e.db.records[encode(key)].value[0].id,'saved');
 else {assert.equal(e.calls.some(c=>c.method==='PUT'),false);assert.equal(e.local()[0].id,'saved');}
 assert.equal([...e.timeouts.values()].some(t=>t.ms===15000),false);
}
test('hung PUT is aborted before next queued save writes',async()=>{
 const e=env();e.putLocal([rec('a')]);e.putRemote([rec('a')]);await e.sync();let first=true,aborted=false;
 e.hook(c=>{if(c.method==='PUT'&&first){first=false;return new Promise((resolve,reject)=>c.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('AbortError'));}));}});
 function fireSave(){const item=[...e.timeouts.entries()].find(([,t])=>t.ms===600);assert(item);e.timeouts.delete(item[0]);item[1].f();}
 e.ctx.localStorage.setItem(key,JSON.stringify([rec('old-save',2)]));fireSave();await e.flush();
 e.ctx.localStorage.setItem(key,JSON.stringify([rec('new-save',3)]));fireSave();await e.flush();
 const timer=[...e.timeouts.entries()].find(([,t])=>t.ms===15000);assert(timer);timer[1].f();await e.flush();
 assert.equal(aborted,true);assert.equal(e.db.records[encode(key)].value[0].id,'new-save');assert.equal([...e.timeouts.values()].some(t=>t.ms===15000),false);
});
test('fetch hang with AbortController times out and queued save succeeds',()=>verifyHungRequest(true,false));
test('without AbortController GET race releases queue but unsafe writes fail closed',()=>verifyHungRequest(false,false));
test('JSON body hang is included in timeout and queued save succeeds',()=>verifyHungRequest(true,true));
(async()=>{for(const [n,f]of tests){await f();console.log('PASS '+n);}console.log('TOTAL '+tests.length+' PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
