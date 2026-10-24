'use strict';
// 입고 업체·품목은 data/incoming-catalog.json 한 곳이 정본이다 — 대장 사양과 번들이 어긋나면 실패한다.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.join(__dirname,'..');
const j=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const cat=j('data/incoming-catalog.json'),C=cat.categories;
test('DKJ-S-02-14 업체·품목이 정본의 원료 목록과 같다',()=>{
 const cols=Object.fromEntries(j('data/ledger-form-specs/DKJ-S-02-14.json').columns.map(c=>[c.key,c]));
 assert.deepEqual(cols.vendor.choices,C['원료'].vendors);assert.deepEqual(cols.item.choices,C['원료'].items);
});
test('DKJ-S-02-15 구분별 업체·품목이 정본과 같다',()=>{
 const cols=Object.fromEntries(j('data/ledger-form-specs/DKJ-S-02-15.json').columns.map(c=>[c.key,c]));
 for(const [kind,cn] of Object.entries(cat.ledgerKinds['DKJ-S-02-15'])){
  assert.deepEqual(cols.vendor.choicesBy.map[kind],C[cn].vendors);assert.deepEqual(cols.item.choicesBy.map[kind],C[cn].items);
 }
});
test('FR-014 번들이 정본과 같다',()=>{
 const raw=fs.readFileSync(path.join(root,'js/incoming-catalog.bundle.js'),'utf8').replace(/^window\.DKJ_INCOMING_CATALOG=/,'').replace(/;\s*$/,'');
 assert.deepEqual(JSON.parse(raw),cat);
});
test('장소·보관위치 번들이 정본과 같고 모든 라벨이 존재하는 목록을 가리킨다',()=>{
 const loc=j('data/locations.json');
 const raw=fs.readFileSync(path.join(root,'js/locations.bundle.js'),'utf8').replace(/^window\.DKJ_LOCATIONS=/,'').replace(/;\s*$/,'');
 assert.deepEqual(JSON.parse(raw),loc);
 for(const k of Object.values(loc.labels)) assert.ok(k==='places'?loc.placesExtra.length&&loc.workAreas.length:Array.isArray(loc[k])&&loc[k].length,k);
});

// 대장 서식의 구역명이 정본(workAreas)과 어긋나면 실패 — 서식마다 다르게 적어 온 이름(입.출고전실/입·출고전실 등)을 막는다.
const zoneKey=s=>String(s).replace(/\s+/g,'').replace(/\([^)]*\)/g,'').replace(/^(남자|여자)/,'').replace(/[0-9]+$/,'').replace(/앞$/,'').replace(/입\.출고|입출고/g,'입·출고');
test('대장 서식의 구역명이 locations.json workAreas 에 모두 있다',()=>{
 const known=new Set(j('data/locations.json').workAreas.map(zoneKey)),bad=[];
 const rows={'DKJ-S-02-02':['place'],'DKJ-S-02-04':['zone'],'DKJ-S-02-07':['place']};
 for(const [code,keys] of Object.entries(rows)){
  for(const r of j('data/ledger-form-specs/'+code+'.json').defaultRows||[]) for(const k of keys){const v=r[k];if(v&&!['발생장소','구분'].includes(v)&&!known.has(zoneKey(v)))bad.push(code+':'+v);}
 }
 const s05=j('data/ledger-form-specs/DKJ-S-02-05.json');
 for(const g of new Set(s05.columns.map(c=>c.group).filter(Boolean))) if(/실|창고|작업장/.test(g)&&!known.has(zoneKey(g.replace(/\s*\(.*$/,''))))bad.push('DKJ-S-02-05:'+g);
 assert.deepEqual([...new Set(bad)],[],'workAreas 에 없는 구역명 — data/locations.json 에 추가하세요');
});
