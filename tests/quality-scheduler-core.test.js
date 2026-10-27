'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/quality-scheduler-core.js');

const TODAY = '2026-10-27';
const types = [{ id: 't1', name: '액상차', intervalMonths: 2 }, { id: 't2', name: '음료베이스', intervalMonths: 3 }];

test('addMonths: 말일이 없는 달은 그 달 말일로 맞춘다', () => {
  assert.equal(core.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(core.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(core.addMonths('2026-10-27', 2), '2026-12-27');
  assert.equal(core.addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(core.addMonths('', 2), '');
  assert.equal(core.addMonths('2026-02-31', 2), '');
});

test('dDay·formatDDay', () => {
  assert.equal(core.dDay('2026-10-30', TODAY), 3);
  assert.equal(core.dDay('2026-10-20', TODAY), -7);
  assert.equal(core.dDay('', TODAY), null);
  assert.equal(core.formatDDay(-7), '7일 초과');
  assert.equal(core.formatDDay(0), '오늘 마감');
  assert.equal(core.formatDDay(5), 'D-5');
});

test('todayKst: UTC 15:00 이후는 한국 기준 다음 날', () => {
  assert.equal(core.todayKst('2026-10-26T15:00:00Z'), '2026-10-27');
  assert.equal(core.todayKst('2026-10-26T14:59:00Z'), '2026-10-26');
});

test('productComputed: 상태 우선순위(중단 > 알림중지 > 기한)', () => {
  const base = { id: 'p', typeId: 't1', name: 'A', lastManufactureDate: '2026-08-01' }; // 마감 2026-10-01 → 26일 초과
  assert.equal(core.productComputed(base, types, {}, TODAY).status, 'overdue');
  assert.equal(core.productComputed(Object.assign({}, base, { alertStatus: 'paused' }), types, {}, TODAY).status, 'paused');
  assert.equal(core.productComputed(Object.assign({}, base, { productionStatus: 'stopped', alertStatus: 'paused' }), types, {}, TODAY).status, 'stopped');
  const soon = Object.assign({}, base, { lastManufactureDate: '2026-08-30' }); // 마감 10-30 → D-3
  assert.equal(core.productComputed(soon, types, {}, TODAY).status, 'urgent');
  assert.equal(core.productComputed(soon, types, { warningDays: 2 }, TODAY).status, 'safe');
});

test('productComputed: 제품 주기가 없으면 식품유형 주기를 쓴다', () => {
  const c = core.productComputed({ typeId: 't2', lastManufactureDate: '2026-10-01' }, types, {}, TODAY);
  assert.equal(c.intervalMonths, 3);
  assert.equal(c.nextDeadline, '2027-01-01');
});

test('healthComputed: 가장 큰 알림 기준일 안이면 임박', () => {
  assert.equal(core.healthComputed({ expiresAt: '2026-11-20' }, {}, TODAY).status, 'urgent'); // D-24 ≤ 30
  assert.equal(core.healthComputed({ expiresAt: '2026-12-31' }, {}, TODAY).status, 'safe');
  assert.equal(core.healthComputed({ expiresAt: '2026-10-01' }, {}, TODAY).status, 'overdue');
  assert.equal(core.healthComputed({ expiresAt: '2026-10-01', employmentStatus: 'inactive' }, {}, TODAY).status, 'inactive');
});

test('representativeProducts: 유형별 최신 제조일 제품, 고정한 메인 제품이 우선', () => {
  const ps = [
    { id: 'a', typeId: 't1', lastManufactureDate: '2026-08-01' },
    { id: 'b', typeId: 't1', lastManufactureDate: '2026-09-01' },
    { id: 'c', typeId: 't2', lastManufactureDate: '2026-07-01' },
    { id: 'd', typeId: '', lastManufactureDate: '2026-01-01' }
  ];
  assert.deepEqual(core.representativeProducts(ps, {}).map((p) => p.id).sort(), ['b', 'c', 'd']);
  assert.deepEqual(core.representativeProducts(ps, { mainProductByType: { t1: 'a' } }).map((p) => p.id).sort(), ['a', 'c', 'd']);
  // 다른 유형의 제품을 메인으로 잘못 가리키면 무시한다
  assert.deepEqual(core.representativeProducts(ps, { mainProductByType: { t1: 'c' } }).map((p) => p.id).sort(), ['b', 'c', 'd']);
});

test('missingCertificate: 최신 성적서가 최근 제조일 이후여야 등록된 것', () => {
  const p = { typeId: 't1', lastManufactureDate: '2026-09-01' };
  assert.ok(core.missingCertificate(p, []));
  assert.ok(core.missingCertificate(p, [{ typeId: 't1', inspectionDate: '2026-08-31' }]));
  assert.equal(core.missingCertificate(p, [{ typeId: 't1', inspectionDate: '2026-09-01' }]), null);
  assert.ok(core.missingCertificate(p, [{ typeId: 't2', inspectionDate: '2026-09-10' }]));
  assert.equal(core.missingCertificate(Object.assign({}, p, { productionStatus: 'stopped' }), []), null);
});

test('buildAlerts: 보건증은 초과 또는 정확히 기준일(D-30·7·1)에만 알린다', () => {
  const health = [
    { id: 'h1', employeeName: '가', expiresAt: '2026-11-26' }, // D-30
    { id: 'h2', employeeName: '나', expiresAt: '2026-11-10' }, // D-14 → 기준일 아님
    { id: 'h3', employeeName: '다', expiresAt: '2026-10-20' }, // 초과
    { id: 'h4', employeeName: '라', expiresAt: '2026-10-28' }, // D-1
    { id: 'h5', employeeName: '마', expiresAt: '2026-10-20', employmentStatus: 'inactive' },
    { id: 'h6', employeeName: '바', expiresAt: '2026-10-20', alertStatus: 'paused' }
  ];
  const a = core.buildAlerts({ types, products: [], health, certs: [], settings: {} }, TODAY);
  assert.deepEqual(a.health.map((h) => h.id), ['h3', 'h4', 'h1']);
});

test('buildAlerts + telegramMessage', () => {
  const data = {
    types,
    products: [
      { id: 'p1', typeId: 't1', name: '유자차 <30g>', lastManufactureDate: '2026-08-01' },
      { id: 'p2', typeId: 't2', name: '베이스', lastManufactureDate: '2026-08-05' }
    ],
    health: [], certs: [{ typeId: 't2', inspectionDate: '2026-09-01' }], settings: {}
  };
  const a = core.buildAlerts(data, TODAY);
  assert.equal(a.overdue.length, 1);
  assert.equal(a.missingCert.length, 1);
  const msg = core.telegramMessage(a, TODAY);
  assert.match(msg, /검사 기한 초과 · 1건/);
  assert.match(msg, /유자차 &lt;30g&gt;/);
  assert.match(msg, /최신 성적서 미등록 · 1건/);
  assert.match(core.telegramMessage(core.buildAlerts({ types, products: [], health: [], certs: [], settings: {} }, TODAY), TODAY), /확인이 필요한 품목이 없습니다/);
});
