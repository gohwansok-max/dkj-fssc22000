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
