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
  const instrumented = source.replace("  if (document.readyState === 'loading')", '  global.qcTest = { emptyState, inspectionResult, first20Judge, checkDeviations, items: CHECK_ITEMS, setState(s) { state = s; } };\n  if (document.readyState === \'loading\')');
  await vm.runInNewContext(instrumented, context);
  return { api: context.qcTest, elements };
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
