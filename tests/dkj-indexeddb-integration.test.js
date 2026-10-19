const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function env(){
 const old=new Map(),disk=new Map();let localWrites=0, fail=false;
 const localStorage={get length(){return old.size;},key:i=>[...old.keys()][i]??null,getItem:k=>old.get(k)??null,setItem(){localWrites++;throw new Error('운영 원본 쓰기 금지');},removeItem(){localWrites++;throw new Error('운영 원본 삭제 금지');}};
 const store={get:async k=>disk.get(k),set:async(k,v)=>{disk.set(k,v);},remove:async k=>disk.delete(k),keys:async()=>[...disk.keys()],batch:async changes=>{if(fail)throw new Error('commit 실패');for(const[k,v]of Object.entries(changes)){if(v===null)disk.delete(k);else disk.set(k,v);}}};
 const ctx={console,crypto:webcrypto,TextEncoder,Uint8Array,DkjStore:store,localStorage,navigator:{locks:{request:async(n,work)=>work()}},CustomEvent:function(type,init){this.type=type;this.detail=init.detail;},dispatchEvent(){},addEventListener(){},alert(){},document:{readyState:'loading',addEventListener(){}}};ctx.window=ctx;
 vm.createContext(ctx);
 for(const f of ['dkj-storage-migration','dkj-storage','dkj-record-store','dkj-approval'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+f+'.js'),'utf8'),ctx);
 return{ctx,old,disk,localWrites:()=>localWrites,fail:()=>{fail=true;}};
}
test('실제 연결 경로는 이전 후 localStorage를 보존하며 Promise 저장·재조회·삭제한다',async()=>{
 const e=env();const key='dkj:records:T:list:v1';const raw='[{"id":"old","title":"원본","audit":[]}]';e.old.set(key,raw);
 await e.ctx.DkjStorage.ready();assert.equal(e.disk.get(key),raw);
 const saving=e.ctx.DkjRecordStore.save('T',{title:'새 기록',rows:[{photo:'data:image/png;base64,AAA'}]});
 assert.equal(typeof saving.then,'function');const rec=await saving;
 assert.equal((await e.ctx.DkjRecordStore.get('T',rec.id)).title,'새 기록');
 assert.equal(e.ctx.DkjApproval.verify(rec.audit).ok,true);
 await e.ctx.DkjRecordStore.remove('T',rec.id);assert.equal(await e.ctx.DkjRecordStore.get('T',rec.id),null);
 assert.equal(JSON.parse(e.disk.get(key)).find(r=>r.id===rec.id).deleted,true);
 assert.equal(e.old.get(key),raw);assert.equal(e.localWrites(),0);
});
test('잠금 훅은 본문 변경·잠금 해제·삭제를 모두 차단하고 감사 해시를 보존한다',async()=>{
 const {ctx,disk}=env();let rec=await ctx.DkjRecordStore.save('T',{title:'잠금',rows:[],locked:true,audit:[]});
 const before=disk.get('dkj:records:T:list:v1');
 const changed=await ctx.DkjRecordStore.save('T',{...rec,title:'변조'});
 assert.equal(changed.title,'잠금');assert.equal(disk.get('dkj:records:T:list:v1'),before);
 await ctx.DkjRecordStore.save('T',{...rec,locked:false});
 assert.equal(await ctx.DkjRecordStore.remove('T',rec.id),false);
 assert.equal(disk.get('dkj:records:T:list:v1'),before);
 assert.equal(ctx.DkjApproval.verify(rec.audit).ok,true);
});
test('병렬 저장은 유실 없이 직렬화하고 commit 실패는 성공으로 보고하지 않는다',async()=>{
 const e=env();await Promise.all([e.ctx.DkjRecordStore.save('T',{title:'a'}),e.ctx.DkjRecordStore.save('T',{title:'b'})]);
 assert.equal((await e.ctx.DkjRecordStore.list('T')).length,2);const before=e.disk.get('dkj:records:T:list:v1');e.fail();
 await assert.rejects(e.ctx.DkjRecordStore.save('T',{title:'실패'}),/commit 실패/);
 assert.equal(e.disk.get('dkj:records:T:list:v1'),before);
});
test('정리는 기본 꺼짐이며 플래그 없이 원본을 삭제하지 않는다',async()=>{
 const e=env();e.old.set('dkj:records:T:list:v1','[]');await e.ctx.DkjStorage.ready();
 assert.equal((await e.ctx.DkjStorage.cleanup()).enabled,false);
 assert.equal((await e.ctx.DkjStorage.cleanup({enabled:true})).enabled,false);
 assert.equal(e.localWrites(),0);
});
test('저장 공간 80% 이상이면 경고하고 미만이면 조용하다',async()=>{
 for(const[usage,warn]of[[85,true],[50,false]]){
  const e=env();e.ctx.DkjStore.estimate=async()=>({usage,quota:100});
  const els=[];e.ctx.document={readyState:'loading',addEventListener(){},body:{appendChild:el=>els.push(el)},getElementById:()=>els[0]||null,createElement:()=>({style:{},setAttribute(){}})};
  assert.equal(await e.ctx.DkjStorage.checkQuota(),usage/100);
  assert.equal(els.length>0&&/85%/.test(els[0].textContent||''),warn);
 }
 const e=env();e.ctx.DkjStore.estimate=async()=>null;assert.equal(await e.ctx.DkjStorage.checkQuota(),null);
});
const photoRec=(extra={})=>({title:'소독',workDate:'2026-10-16',rows:[{time:'09:10',photo:'data:image/jpeg;base64,AAA'},{time:'09:40',photo:'data:image/jpeg;base64,BBB'}],...extra});
test('덮어쓰기 전 버전을 이력에 보관하고 같은 내용은 중복 보관하지 않으며 기록당 5개로 제한한다',async()=>{
 const e=env();const R=e.ctx.DkjRecordStore;const hk='dkj:history:T:v1';
 const first=await R.save('T',photoRec());
 assert.equal(e.disk.get(hk),undefined);
 // 사진·시간이 비워진 상태로 덮어써도(오래 열린 화면의 저장) 이전 버전이 남는다
 await R.save('T',{...first,rows:[{time:'',photo:null},{time:'',photo:null}]});
 let hist=JSON.parse(e.disk.get(hk));
 assert.equal(hist.length,1);assert.equal(hist[0].reason,'save');assert.equal(hist[0].rec.rows[0].photo,'data:image/jpeg;base64,AAA');assert.equal(hist[0].rec.rows[1].time,'09:40');
 // 비워진 버전도 또 하나의 버전이므로 보관된다. 같은 내용의 반복 저장은 이력을 늘리지 않는다
 let cur=await R.get('T',first.id);await R.save('T',{...cur});
 assert.equal(JSON.parse(e.disk.get(hk)).length,2);
 cur=await R.get('T',first.id);await R.save('T',{...cur});
 assert.equal(JSON.parse(e.disk.get(hk)).length,2);
 for(let i=0;i<8;i++){cur=await R.get('T',first.id);await R.save('T',{...cur,memo:'v'+i});}
 assert.equal(JSON.parse(e.disk.get(hk)).filter(x=>x.recordId===first.id).length,5);
 assert.equal(e.localWrites(),0);
});
test('삭제해도 본문(사진·시간)은 이력에 남고 화면 목록에서는 사라진다',async()=>{
 const e=env();const R=e.ctx.DkjRecordStore;const rec=await R.save('T',photoRec());
 await R.remove('T',rec.id);
 assert.equal(await R.get('T',rec.id),null);
 const tomb=JSON.parse(e.disk.get('dkj:records:T:list:v1')).find(r=>r.id===rec.id);
 assert.equal(tomb.deleted,true);assert.equal(tomb.rows,undefined);
 const hist=JSON.parse(e.disk.get('dkj:history:T:v1'));
 assert.equal(hist.at(-1).reason,'delete');assert.equal(hist.at(-1).rec.rows[0].photo,'data:image/jpeg;base64,AAA');
});
test('저장 실패는 닫기 전까지 남는 경고와 이탈 확인을 켜고 다음 저장 성공이 해제한다',async()=>{
 const e=env();const els={};
 e.ctx.document={readyState:'loading',addEventListener(){},body:{appendChild:el=>{els[el.id]=el;}},getElementById:id=>els[id]||null,createElement:()=>({style:{},setAttribute(){}})};
 let before;e.ctx.addEventListener=(n,f)=>{if(n==='beforeunload')before=f;};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/dkj-storage.js'),'utf8'),e.ctx);
 // 위 재로드가 만든 새 DkjStorage 로 기록 저장소를 다시 연결한다
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/dkj-record-store.js'),'utf8'),e.ctx);
 const R=e.ctx.DkjRecordStore;e.fail();
 await assert.rejects(R.save('T',photoRec()),/commit 실패/);
 assert.equal(e.ctx.DkjStorage.writeFailing(),true);
 assert.match(els['dkj-write-failure'].textContent,/저장에 실패/);
 let prevented=false;before({preventDefault(){prevented=true;},set returnValue(v){}});assert.equal(prevented,true);
});
test('클라우드 병합으로 바뀌는 이 기기의 기존 버전을 이력에 보관한다',async()=>{
 const e=env();e.ctx.DKJ_FIREBASE={apiKey:'t',databaseURL:'https://example.invalid',root:'root'};e.ctx.Storage=function(){};e.ctx.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/dkj-cloud-sync.js'),'utf8'),e.ctx);
 const local={id:'a',updatedAt:'2026-10-16T05:00:00Z',rows:[{time:'09:10',photo:'data:image/jpeg;base64,AAA'}]};
 const remote={id:'a',updatedAt:'2026-10-16T06:00:00Z',rows:[{time:'',photo:null}]};
 await e.ctx.DkjCloudSync.archiveReplaced('dkj:records:T:list:v1',JSON.stringify([local]),[remote]);
 const hist=JSON.parse(e.disk.get('dkj:history:T:v1'));
 assert.equal(hist.length,1);assert.equal(hist[0].reason,'sync');assert.equal(hist[0].rec.rows[0].photo,'data:image/jpeg;base64,AAA');
 // 바뀌지 않은 기록은 보관하지 않는다
 await e.ctx.DkjCloudSync.archiveReplaced('dkj:records:U:list:v1',JSON.stringify([local]),[local]);
 assert.equal(e.disk.get('dkj:history:U:v1'),undefined);
});
test('삭제 전 버전은 일반 이력이 밀려나도 30일간 보존되고 만료·건수 상한을 지킨다',async()=>{
 const e=env();const R=e.ctx.DkjRecordStore;const hk='dkj:history:T:v1';
 const doomed=await R.save('T',{title:'삭제될 월 기록',rows:[{v:1}]});
 await R.remove('T',doomed.id);
 // 다른 기록 저장이 70번 쌓여 일반 이력(서식당 60개)이 가득 차도
 const other=await R.save('T',{title:'다른 기록',n:0});
 for(let i=1;i<=70;i++){const cur=await R.get('T',other.id);await R.save('T',{...cur,n:i});}
 const hist=JSON.parse(e.disk.get(hk));
 assert.ok(hist.some(x=>x.recordId===doomed.id&&x.reason==='delete'),'삭제 전 버전이 밀려났다');
 assert.ok(hist.filter(x=>x.reason!=='delete').length<=60);
 // 같은 내용이 이미 일반 이력에 있던 기록을 삭제하면 그 항목이 삭제 전 버전으로 승격된다
 const H=e.ctx.DkjRecordStore.History;const rec={id:'x',title:'t',updatedAt:'2026-10-01T00:00:00Z'};
 let list=H.add([],[rec],'save','2026-10-01T00:00:00Z');
 list=H.add(list,[{...rec,updatedAt:'2026-10-02T00:00:00Z'}],'delete','2026-10-02T00:00:00Z');
 assert.equal(list.length,1);assert.equal(list[0].reason,'delete');assert.equal(list[0].savedAt,'2026-10-02T00:00:00Z');
 // 30일이 지나면 삭제 전 버전도 만료되고, 서식당 30건을 넘으면 오래된 것부터 버린다
 assert.equal(H.add(list,[{id:'y',title:'new'}],'save','2026-11-05T00:00:00Z').some(x=>x.recordId==='x'),false);
 let many=[];for(let i=0;i<40;i++)many=H.add(many,[{id:'d'+i,title:'t'+i}],'delete','2026-10-02T00:00:00Z');
 assert.equal(many.length,30);assert.equal(many[0].recordId,'d10');
});
