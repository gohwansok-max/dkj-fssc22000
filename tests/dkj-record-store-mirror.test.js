const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(fail = false) {
 const mem = new Map(), idb = new Map();
 const context = { console: { error() {} }, localStorage: {
 getItem: k => mem.get(k) ?? null, setItem: (k,v) => mem.set(k,String(v)), removeItem: k => mem.delete(k) },
 DkjStore: { set: async (k,v) => { if(fail) throw new Error('용량 부족'); idb.set(k,v); }, remove: async k => idb.delete(k) },
 CustomEvent: function(){}, dispatchEvent(){}, document: {readyState:'loading', addEventListener(){}} };
 context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/dkj-record-store.js'),'utf8'),context);
 return {store:context.DkjRecordStore,mem,idb};
}
test('이중 쓰기는 저장·초안 삭제 순서를 유지하고 localStorage 읽기를 유지한다', async()=>{
 const {store,mem,idb}=load();
 store.saveDraft('T',{rows:[{photo:'data:image/png;base64,AAA'}]});
 const rec=store.save('T',{title:'기록',audit:[{hash:'h'}]});
 store.remove('T',rec.id);
 await store.flushMirror();
 assert.deepEqual([...idb],[...mem]);
 assert.equal(store.list('T').length,0);
 assert.equal(idb.has('dkj:records:T:draft:v1'),false);
});
test('이중 쓰기 실패는 원본을 유지하고 flushMirror에서 보고한다',async()=>{
 const {store,mem}=load(true); const rec=store.save('T',{title:'원본'});
 await assert.rejects(store.flushMirror(),/용량 부족/);
 assert.ok(mem.get('dkj:records:T:list:v1').includes(rec.id));
});
