'use strict';
// 화면을 새로 열어도(메모리 캐시가 비워져도) 클라우드가 그대로이고 이 기기 기록도 그대로면
// 서식 기록 전체를 다시 내려받지 않는지 검증한다.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),test=require('node:test');
const {webcrypto}=require('node:crypto');
const key='dkj:records:form:list:v1',encode=s=>Buffer.from(s).toString('base64url');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const rec=(id,n=1)=>({id,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-0'+n+'T00:00:00Z',value:n,photo:'data:image/jpeg;base64,'+'A'.repeat(200)});
const read=f=>fs.readFileSync(path.join(__dirname,'../js/'+f+'.js'),'utf8');
// 기기 저장소(IndexedDB 맵·서버 DB)는 화면을 여러 번 열어도 유지되고, JS 컨텍스트만 새로 만든다.
function device(){
 const idb=new Map(),db={sync_meta:{schemaVersion:1},records:{},records_v2:{}};
 function page(){
  const calls=[],local=new Map();
  const DkjStorage={ready:async()=>true,getItem:async k=>idb.has(k)?idb.get(k):null,setItem:async(k,v)=>{idb.set(k,String(v));},removeItem:async k=>{idb.delete(k);},keys:async()=>[...idb.keys()],exclusive:w=>w()};
  const DkjStore={get:async k=>idb.get(k),set:async(k,v)=>{idb.set(k,String(v));},remove:async k=>{idb.delete(k);},keys:async()=>[...idb.keys()]};
  class Storage{constructor(){this.map=new Map();}get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
  const ctx={console,Storage,localStorage:new Storage(),sessionStorage:new Storage(),crypto:webcrypto,TextEncoder,DkjStorage,DkjStore,
   document:{visibilityState:'visible',addEventListener(){},getElementById:()=>({style:{}}),createElement:()=>({style:{}}),body:{appendChild(){}}},
   DKJ_FIREBASE:{apiKey:'t',databaseURL:'https://example.invalid',root:'root'},DkjAuth:{user:()=>({name:'test'}),token:()=> 'local-token-test'},navigator:{userAgent:'test'},location:{reload(){}},
   CustomEvent:function(n,o){this.type=n;this.detail=o?.detail;},dispatchEvent(){},addEventListener(){},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},AbortController,
   btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
   fetch:async(url,opt)=>{
    const u=new URL(url),p=u.pathname.replace('/root/','').replace(/\.json$/,''),shallow=u.searchParams.get('shallow')==='true';calls.push({path:p,method:opt.method,shallow});
    const parts=p.split('/');let parent=db;for(const x of parts.slice(0,-1)){if(!parent[x])parent[x]={};parent=parent[x];}const last=parts.at(-1);
    if(opt.method==='PUT')parent[last]=JSON.parse(opt.body);let data=parent[last]??null;
    if(shallow&&data)data=Object.fromEntries(Object.keys(data).map(k=>[k,true]));
    return {status:200,ok:true,json:async()=>copy(data)};
   }};
  ctx.window=ctx;vm.createContext(ctx);
  for(const f of ['dkj-async','dkj-storage-migration'])vm.runInContext(read(f),ctx);
  vm.runInContext(read('dkj-cloud-sync'),ctx);
  const full=()=>calls.filter(c=>c.path==='records/'+encode(key)&&c.method==='GET'&&!c.shallow).length;
  return {ctx,calls,full,sync:()=>ctx.DkjCloudSync.sync()};
 }
 return {idb,db,page,putLocal:v=>idb.set(key,JSON.stringify(v)),putRemote:(v,stamp)=>{db.records[encode(key)]={value:copy(v),updatedAt:stamp};}};
}
test('첫 화면은 기록을 받고, 새로 연 화면은 클라우드·기기 기록이 그대로면 다시 받지 않는다',async()=>{
 const d=device();d.putLocal([rec('a')]);d.putRemote([rec('a')],1);
 const p1=d.page();await p1.sync();assert.equal(p1.full(),1);
 const p2=d.page();await p2.sync();assert.equal(p2.full(),0,'새로 열었는데 전체를 다시 받았다');
 const p3=d.page();await p3.sync();assert.equal(p3.full(),0);
});
test('다른 기기가 클라우드를 바꾸면 새로 연 화면은 다시 받아 병합한다',async()=>{
 const d=device();d.putLocal([rec('a')]);d.putRemote([rec('a')],1);
 await d.page().sync();
 d.putRemote([rec('a',2),rec('b',2)],2);
 const p=d.page();await p.sync();assert.equal(p.full(),1);
 assert.deepEqual(JSON.parse(d.idb.get(key)).map(r=>r.id).sort(),['a','b']);
});
test('이 기기 기록이 바뀌었거나 없어졌으면 캐시를 믿지 않는다',async()=>{
 const d=device();d.putLocal([rec('a')]);d.putRemote([rec('a')],1);
 await d.page().sync();
 d.putLocal([rec('a'),rec('c',3)]); // 이 기기에서만 바뀜(해시 불일치)
 let p=d.page();await p.sync();assert.equal(p.full(),1);
 d.idb.delete(key); // 기록이 사라진 기기
 p=d.page();await p.sync();assert.equal(p.full(),1);
 assert.ok(JSON.parse(d.idb.get(key)).some(r=>r.id==='a'),'클라우드에서 복구되어야 한다');
});
test('이 기기 변경을 올린 직후에는 같은 화면·새 화면 모두 그 목록을 다시 내려받지 않는다',async()=>{
 const d=device();d.putLocal([rec('a')]);d.putRemote([rec('a')],1);
 const p=d.page();await p.sync();assert.equal(p.full(),1);
 d.putLocal([rec('a'),rec('new',3)]); // 이 기기에서 저장
 await p.sync();assert.equal(p.full(),2,'변경 확인을 위해 한 번은 받는다');
 assert.deepEqual(d.db.records[encode(key)].value.map(r=>r.id).sort(),['a','new'],'변경이 클라우드에 올라가야 한다');
 await p.sync();assert.equal(p.full(),2,'방금 올린 목록을 다시 받았다');
 const p2=d.page();await p2.sync();assert.equal(p2.full(),0,'새로 연 화면이 방금 올린 목록을 다시 받았다');
});
