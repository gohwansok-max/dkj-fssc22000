const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/DKJ-QC-001.js'), 'utf8');

async function load() {
  const elements = {};
  const context = { document: { readyState: 'loading', addEventListener() {}, getElementById(id) { return elements[id] || null; } }, console, setTimeout, clearTimeout };
  context.window = context;
  const instrumented = source.replace("  if (document.readyState === 'loading')", '  global.qcTest = { emptyState, inspectionResult, first20Judge, checkDeviations, validationMessage, items: CHECK_ITEMS, validate: global.DkjRecordValidators[FORM_ID], setState(s) { state = s; } };\n  if (document.readyState === \'loading\')');
  await vm.runInNewContext(instrumented, context);
  return { api: context.qcTest, elements, context };
}

test('fresh QC is uninspected and does not populate measurements or first-20 pass', async () => {
  const {api} = await load(); const state = api.emptyState(); api.setState(state);
  assert.equal(api.inspectionResult().judge, '미점검');
  for (const round of Object.values(state.checks)) assert.ok(Object.values(round).every(v => v === ''));
  assert.equal(api.first20Judge(state.finishedItems), '미점검');
  assert.equal(state.remarkPreset, '');
});

test('completed legacy values remain readable; deviation overrides missing and normal preset', async () => {
  const {api, elements} = await load(); const s = api.emptyState();
  for (const round of Object.values(s.checks)) for (const item of api.items) round[item.key] = item.defaultVal;
  s.finishedItems[0].first20 = 'O'; api.setState(s);
  assert.equal(api.inspectionResult().judge, '적합');
  const chlorine = api.items.find(i => i.type === 'num' && i.min === 200);
  s.checks.r1[chlorine.key] = '0'; s.checks.r2.c01 = '';
  const normal = {}; elements.remarkPreset = {querySelector() {return normal;}};
  elements.deviationBanner = {}; elements.qcJudgeStatus = {};
  const before = JSON.stringify(s.checks); api.checkDeviations();
  assert.equal(api.inspectionResult().judge, '이탈발생');
  assert.match(elements.deviationBanner.textContent, /1차.*0/);
  assert.equal(normal.disabled, true);
  assert.equal(JSON.stringify(s.checks), before);
  s.checks.r1[chlorine.key] = chlorine.defaultVal; api.checkDeviations();
  assert.equal(api.inspectionResult().judge, '미점검');
  assert.equal(normal.disabled, false);
});

test('first-20 summary prioritizes failure then missing, and accepts existing O/X records', async () => {
  const {api} = await load();
  assert.equal(api.first20Judge([]), '미점검');
  assert.equal(api.first20Judge([{first20:'O'},{first20:''}]), '미점검');
  assert.equal(api.first20Judge([{first20:''},{first20:'X'}]), '부적합(×)');
  assert.equal(api.first20Judge([{first20:'O'},{first20:'○'}]), '적합(○)');
});

test('incomplete saves remain possible but completion/signoff requires all inspections', async () => {
  const {api} = await load(); const s = api.emptyState();
  s.inspector='시험';
  assert.equal(api.validationMessage(s,false),'');
  assert.match(api.validationMessage(s,true),/미점검/);
  assert.doesNotThrow(()=>api.validate(s));
  s.locked=true;
  assert.throws(()=>api.validate(s),/미점검/);
  s.locked=false;s.signoff={writer:{at:'2026-10-19T01:00:00Z'}};
  assert.throws(()=>api.validate(s),/미점검/);
});

test('deviations require actual notes on save and first-20 failure is included', async () => {
  const {api} = await load(); const s = api.emptyState();s.inspector='시험';
  for(const round of Object.values(s.checks))for(const item of api.items)round[item.key]=item.defaultVal;
  s.finishedItems[0].first20='X';
  assert.match(api.validationMessage(s,false),/실제 조치/);
  s.deviationNotes='이상 없음';assert.match(api.validationMessage(s,true),/실제 조치/);
  s.deviationNotes='불량 포장 격리 후 재검사 실시';
  assert.equal(api.validationMessage(s,true),'');
  s.locked=true;assert.doesNotThrow(()=>api.validate(s));
  s.finishedItems[0].first20='';assert.match(api.validationMessage(s,true),/미점검/);
});

test('actual store rejects incomplete locks before writing and accepts completed QC', async () => {
  const {api,context}=await load();const values=new Map();
  context.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/dkj-record-store.js'),'utf8'),context);
  const s=api.emptyState();s.inspector='시험';
  const saved=context.DkjRecordStore.save('DKJ-QC-001',s);
  const before=values.get('dkj:records:DKJ-QC-001:list:v1');
  saved.locked=true;
  assert.throws(()=>context.DkjRecordStore.save('DKJ-QC-001',saved),/미점검/);
  assert.equal(values.get('dkj:records:DKJ-QC-001:list:v1'),before);
  for(const round of Object.values(s.checks))for(const item of api.items)round[item.key]=item.defaultVal;
  s.finishedItems[0].first20='O';
  const complete=context.DkjRecordStore.save('DKJ-QC-001',s);
  assert.equal(complete.locked,true);
  assert.equal(context.DkjRecordStore.list('DKJ-QC-001').length,1);
});
