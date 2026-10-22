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
