const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
test('공개 기록 저장소 호출부는 모두 await하며 동기 소비를 남기지 않는다',()=>{
 let count=0;
 for(const file of fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js')&&!f.endsWith('.bundle.js')&&!['dkj-record-store.js','dkj-approval.js'].includes(f))){
  const source=fs.readFileSync(path.join(root,'js',file),'utf8');
  const pattern=/(?:(?:global|window)\.)?DkjRecordStore\.(?:list|get|save|remove|saveDraft|loadDraft|clearDraft)\s*\(/g;
  for(const match of source.matchAll(pattern)){
   const prefix=source.slice(Math.max(0,match.index-25),match.index);
   assert.match(prefix,/\bawait\s*$/,file+': '+match[0]);count++;
  }
 }
 assert.ok(count>100,'기록 호출부 검색 범위가 충분해야 한다');
});
test('기록 화면은 어댑터·이전 장벽을 기록 저장소보다 먼저 로드한다',()=>{
 const files=fs.readdirSync(root).filter(f=>f.endsWith('.html')).map(f=>path.join(root,f)).concat(fs.readdirSync(path.join(root,'records')).filter(f=>f.endsWith('.html')).map(f=>path.join(root,'records',f)));
 for(const file of files){const source=fs.readFileSync(file,'utf8');const store=source.indexOf('js/dkj-record-store.js');if(store<0)continue;
  for(const name of ['dkj-async','dkj-store','dkj-storage-migration','dkj-storage']){
   const index=source.indexOf('js/'+name+'.js');assert.ok(index>=0&&index<store,path.basename(file)+' '+name);
  }
 }
});
