'use strict';
// 월 시트(행 고정 대장)를 두 기기가 나눠 입력해도 서로의 칸이 사라지지 않는지 검증한다.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const ctx={console,document:{visibilityState:'visible',addEventListener(){}},DKJ_FIREBASE:{},navigator:{userAgent:'t'},sessionStorage:{getItem(){return null;},setItem(){}},
 Storage:function(){},CustomEvent:function(){},dispatchEvent(){},addEventListener(){},setTimeout,clearTimeout,setInterval(){},clearInterval(){},
 btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/dkj-cloud-sync.js'),'utf8'),ctx);
const {sheet:Sheet,mergeRecords}=ctx.DkjCloudSync;
const blank=()=>Array.from({length:5},(_, i)=>({day:String(i+1),t:''}));
const rec=(rows,stamps,at,extra)=>Object.assign({id:'a',createdAt:'2026-10-01T00:00:00Z',updatedAt:at,info:{month:'2026-10'},rows,cellStamps:stamps},extra);
const copy=x=>JSON.parse(JSON.stringify(x));

test('두 기기가 서로 다른 날 칸을 입력하면 동기화 병합이 양쪽을 모두 남긴다',()=>{
 const tablet=rec(blank(),{}, '2026-10-05T01:00:00Z');tablet.rows[0].t='3.1';tablet.cellStamps['0|t']=1000;
 const pc=rec(blank(),{}, '2026-10-05T02:00:00Z');pc.rows[1].t='2.8';pc.cellStamps['1|t']=2000;
 const m=mergeRecords([tablet],[pc]);
 assert.equal(m.length,1);assert.equal(m[0].rows[0].t,'3.1');assert.equal(m[0].rows[1].t,'2.8');
 assert.deepEqual(mergeRecords([pc],[tablet])[0].rows.map(r=>r.t),m[0].rows.map(r=>r.t),'병합 순서와 무관해야 한다');
});
test('같은 칸을 둘 다 고치면 칸 시각이 늦은 쪽이 이긴다(기록 단위 시각과 무관)',()=>{
 const a=rec(blank(),{}, '2026-10-05T09:00:00Z');a.rows[0].t='A';a.cellStamps['0|t']=1000;   // 기록은 늦게 저장됐지만 칸은 먼저
 const b=rec(blank(),{}, '2026-10-05T08:00:00Z');b.rows[0].t='B';b.cellStamps['0|t']=2000;
 assert.equal(mergeRecords([a],[b])[0].rows[0].t,'B');
});
test('지운 칸도 더 늦게 지웠으면 되살아나지 않는다',()=>{
 const old=rec(blank(),{}, '2026-10-05T01:00:00Z');old.rows[0].t='3.1';old.cellStamps['0|t']=1000;
 const cleared=rec(blank(),{}, '2026-10-05T02:00:00Z');cleared.cellStamps['0|t']=2000;
 assert.equal(mergeRecords([old],[cleared])[0].rows[0].t,'');
});
test('잠금·점검 월 다름·행 수 다름·옛 기록(시각 없음)은 종전처럼 기록 단위로 고른다',()=>{
 const a=rec(blank(),{}, '2026-10-05T01:00:00Z');a.rows[0].t='x';
 const b=rec(blank(),{}, '2026-10-05T02:00:00Z');b.rows[1].t='y';
 assert.equal(Sheet.merge(Object.assign(copy(a),{locked:true}),b),null);
 assert.equal(Sheet.merge(a,Object.assign(copy(b),{info:{month:'2026-11'}})),null);
 assert.equal(Sheet.merge(a,Object.assign(copy(b),{rows:b.rows.slice(1)})),null);
 const legacy=copy(b);delete legacy.cellStamps;
 assert.equal(Sheet.merge(a,legacy),null);
 assert.deepEqual(mergeRecords([a],[legacy])[0].rows.map(r=>r.t),['','y','','','']);
});
test('오래 열린 화면이 저장해도 그동안 다른 기기가 저장한 칸을 비우지 않는다(rebase)',()=>{
 const stored=rec(blank(),{}, '2026-10-05T01:00:00Z');stored.rows[0].t='3.1';stored.cellStamps['0|t']=1000;   // 태블릿이 먼저 저장
 const base=blank();                                          // PC 는 빈 시트로 열었다
 const local=rec(blank(),{}, '2026-10-05T00:00:00Z');local.rows[1].t='2.8';  // PC 가 2일 칸만 입력
 Sheet.rebase(base,local,stored,3000);
 assert.deepEqual(local.rows.map(r=>r.t),['3.1','2.8','','','']);
 assert.equal(local.cellStamps['1|t'],3000);assert.equal(local.cellStamps['0|t'],1000);
});
test('같은 칸을 둘 다 고치면 저장하는 화면의 입력이 이기고, 지운 칸은 지운 채 저장된다',()=>{
 const stored=rec(blank(),{}, '2026-10-05T01:00:00Z');stored.rows[0].t='old';stored.rows[1].t='keep';
 const base=copy(stored.rows);
 const local=copy(stored);local.rows[0].t='mine';local.rows[1].t='';
 Sheet.rebase(base,local,stored,5000);
 assert.equal(local.rows[0].t,'mine');assert.equal(local.rows[1].t,'');
});
test('화면 갱신(absorb)은 이 화면에서 바꾼 칸을 건드리지 않고 나머지만 받는다',()=>{
 const base=blank();
 const local=rec(blank(),{}, '2026-10-05T00:00:00Z');local.rows[0].t='typing';   // 입력 중
 const stored=rec(blank(),{}, '2026-10-05T01:00:00Z');stored.rows[0].t='other';stored.rows[2].t='4.0';stored.cellStamps['2|t']=900;
 const hits=Sheet.absorb(base,local,stored);
 assert.deepEqual(copy(hits),[[2,'t']]);assert.equal(local.rows[0].t,'typing');assert.equal(local.rows[2].t,'4.0');assert.equal(base[2].t,'4.0');
});
