/** 저장소 대조·이전 도구. 로드만으로 데이터를 변경하지 않는다. */
(function (global) {
  'use strict';
  var MARKER = 'dkj:indexeddb:migration:v1';
  function snapshot(storage) {
    var out = Object.create(null);
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key !== null) out[key] = storage.getItem(key);
    }
    return out;
  }
  async function hash(value) {
    var bytes = new TextEncoder().encode(value);
    var result = await global.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(result)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function compare(storage, store) {
    var source = snapshot(storage), keys = Object.keys(source).sort(), entries = [];
    for (var key of keys) {
      var raw = source[key], target = await store.get(key);
      var sourceHash = await hash(raw), targetHash = target === undefined ? null : await hash(target);
      entries.push({ key: key, sourceLength: raw.length, targetLength: target === undefined ? null : target.length,
        sourceHash: sourceHash, targetHash: targetHash, equal: raw === target && sourceHash === targetHash });
    }
    var targetKeys = await store.keys();
    var extraKeys = targetKeys.filter(function (key) { return key !== MARKER && !Object.prototype.hasOwnProperty.call(source, key); });
    var stable = JSON.stringify(snapshot(storage)) === JSON.stringify(source);
    return { sourceCount: keys.length, targetCount: targetKeys.filter(function (key) { return key !== MARKER; }).length,
      entries: entries, extraKeys: extraKeys, stable: stable,
      equal: stable && extraKeys.length === 0 && entries.every(function (entry) { return entry.equal; }) };
  }
  async function migrate(storage, store) {
    if (await store.get(MARKER) !== undefined) return { alreadyMigrated: true };
    var initial = snapshot(storage);
    for (var key of Object.keys(initial).sort()) await store.set(key, initial[key]);
    var report = await compare(storage, store);
    if (!report.equal || JSON.stringify(snapshot(storage)) !== JSON.stringify(initial)) {
      throw new Error('IndexedDB 이전 대조 실패: 원본을 보존했으며 다음 접속 때 재시도합니다.');
    }
    await store.set(MARKER, JSON.stringify({ completedAt: new Date().toISOString(), count: report.sourceCount,
      entries: report.entries.map(function (entry) { return { key: entry.key, length: entry.sourceLength, hash: entry.sourceHash }; }) }));
    return report;
  }
  global.DkjStorageMigration = { compare: compare, migrate: migrate, markerKey: MARKER, hash: hash };
})(window);
