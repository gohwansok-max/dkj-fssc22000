/**
 * 동김제 테넌트 기록 localStorage (코엔에프 StorageService와 분리)
 */
(function (global) {
  'use strict';
  var backend = global.DkjStorage;
  var staged = null;
  var localStorage = backend ? {
    getItem: function (key) { return staged.values[key] === undefined ? null : staged.values[key]; },
    setItem: function (key, raw) { staged.values[key] = String(raw); staged.writes[key] = String(raw); },
    removeItem: function (key) { delete staged.values[key]; staged.writes[key] = null; }
  } : global.localStorage;


  function listKey(formId) {
    return 'dkj:records:' + formId + ':list:v1';
  }

  function draftKey(formId) {
    return 'dkj:records:' + formId + ':draft:v1';
  }

  /* ---------- 덮어쓰기 전 버전 이력 ----------
   * 기록은 통째로 덮어쓰는 방식(마지막 저장이 이김)이라, 오래 열려 있던 화면이나 다른 기기의
   * 저장이 사진·시간을 비운 채 덮어써도 되돌릴 수 없었다. 저장·삭제·동기화 병합으로 바뀌기
   * 직전 버전을 IndexedDB 에만(localStorage·클라우드·백업 제외) 서식별로 보관한다.
   * 기록 한 건당 5개, 서식당 60개까지 오래된 것부터 버린다. */
  var HISTORY_PER_RECORD = 5, HISTORY_PER_FORM = 60;
  // 삭제 전 버전은 일반 이력과 별도로 30일(서식당 30건)까지 보관한다 — 삭제 뒤에 다른 저장이
  // 쌓여 일반 이력이 밀려나도 삭제된 기록은 되살릴 수 있어야 한다.
  var HISTORY_DELETE_DAYS = 30, HISTORY_DELETE_MAX = 30;
  var VOLATILE = ['updatedAt', 'updatedBy', 'updatedByEmpId', 'updatedByUid', 'audit', '_savedAt'];
  function historyKey(formId) { return 'dkj:history:' + formId + ':v1'; }
  function materialJson(rec) {
    var o = {};
    Object.keys(rec).sort().forEach(function (k) { if (VOLATILE.indexOf(k) < 0) o[k] = rec[k]; });
    return JSON.stringify(o);
  }
  var History = {
    key: historyKey,
    parse: function (raw) {
      try { var v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    },
    /** list(이력 배열)에 recs 를 덧붙인 새 배열을 돌려준다. 내용이 같은 버전은 중복 보관하지 않는다. */
    add: function (list, recs, reason, now) {
      var stamp = now || new Date().toISOString();
      var out = list.slice();
      recs.forEach(function (rec) {
        if (!rec || !rec.id || rec.deleted) return;
        var json = materialJson(rec);
        var same = out.filter(function (e) { return e.recordId === rec.id && materialJson(e.rec) === json; })[0];
        if (same) {
          // 이미 보관한 내용이 삭제되는 경우에는 그 항목을 '삭제 전 버전'으로 바꿔 보호한다.
          if (reason === 'delete') { same.reason = 'delete'; same.savedAt = stamp; }
          return;
        }
        out.push({ recordId: rec.id, savedAt: stamp, reason: reason, rec: rec });
        var mine = out.filter(function (e) { return e.recordId === rec.id && e.reason !== 'delete'; });
        if (mine.length > HISTORY_PER_RECORD) out.splice(out.indexOf(mine[0]), 1);
      });
      var cutoff = Date.parse(stamp) - HISTORY_DELETE_DAYS * 86400000;
      out = out.filter(function (e) { return e.reason !== 'delete' || !(Date.parse(e.savedAt) < cutoff); });
      var normal = out.filter(function (e) { return e.reason !== 'delete'; });
      while (normal.length > HISTORY_PER_FORM) out.splice(out.indexOf(normal.shift()), 1);
      var removed = out.filter(function (e) { return e.reason === 'delete'; });
      while (removed.length > HISTORY_DELETE_MAX) out.splice(out.indexOf(removed.shift()), 1);
      return out;
    }
  };

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // 2단계: 기존 동기 API를 유지하며 IndexedDB 쓰기를 순서대로 대기열에 넣는다.
  var mirrorTail = Promise.resolve();
  var mirrorError = null;
  function mirror(key, raw) {
    if (backend || !global.DkjStore) return;
    mirrorTail = mirrorTail.then(function () {
      return raw === null ? global.DkjStore.remove(key) : global.DkjStore.set(key, raw);
    }).catch(function (error) {
      mirrorError = error;
      console.error('[DkjRecordStore] IndexedDB 이중 쓰기 실패', error);
    });
  }
  function writeJson(key, value) {
    var raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    mirror(key, raw);
    if (!backend) { try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { key: key, value: value } })); } catch (e) {} }
  }

  // 이력은 DkjStorage(IndexedDB) 경로에서만 쓴다 — localStorage 용량을 다시 압박하지 않기 위해서다.
  function archive(formId, recs, reason) {
    if (!backend || !recs.length) return;
    var key = historyKey(formId);
    var next = History.add(History.parse(localStorage.getItem(key)), recs, reason);
    localStorage.setItem(key, JSON.stringify(next));
  }

  function uid() {
    return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  global.DkjRecordStore = {
    flushMirror: function () {
      return mirrorTail.then(function () {
        if (mirrorError) { var error = mirrorError; mirrorError = null; throw error; }
      });
    },
    list: function (formId) {
      return readJson(listKey(formId), []).filter(function (r) { return !r || !r.deleted; });
    },

    get: function (formId, id) {
      return this.list(formId).find(function (r) { return r.id === id; }) || null;
    },

    save: function (formId, record) {
      var validator = global.DkjRecordValidators && global.DkjRecordValidators[formId];
      if (typeof validator === 'function') validator(record);

      // list()는 deleted 기록을 걸러낸다 — 여기서 그걸 그대로 작업 배열로 쓰면 이 서식에
      // 아무 기록이나 하나 저장할 때마다 deleted 표식이 통째로 사라져(never written back)
      // 삭제된 기록이 되살아난다. 반드시 원본(raw, 걸러내지 않은) 배열로 읽고 써야 한다.
      var list = readJson(listKey(formId), []);
      var now = new Date().toISOString();
      // 누가 썼는지가 남아야 HACCP 기록으로 쓸 수 있다(로그인 세션에서 가져온다)
      var who = (global.DkjAuth && global.DkjAuth.user()) || null;
      if (!record.id) {
        record.id = uid();
        record.createdAt = now;
        if (who) {
          record.createdBy = who.name;
          record.createdByEmpId = who.empId;
          record.createdByUid = who.uid || '';
        }
      } else {
        // 폼 엔진들은 화면 state 로 record 를 새로 조립해 넘긴다(Object.assign({}, state, …)).
        // 그 state 에는 최초작성 정보가 없으므로, 여기서 되살리지 않으면 두 번째 저장
        // (수정·작성완료) 때 '누가 언제 처음 썼는가'가 통째로 지워진다 — 기록 추적성의 근간이라
        // 반드시 이전 값을 물려받는다.
        var prev = this.get(formId, record.id);
        if (prev) {
          if (!record.createdAt) record.createdAt = prev.createdAt || now;
          if (!record.createdBy && prev.createdBy) record.createdBy = prev.createdBy;
          if (!record.createdByEmpId && prev.createdByEmpId) record.createdByEmpId = prev.createdByEmpId;
          if (!record.createdByUid && prev.createdByUid) record.createdByUid = prev.createdByUid;
        } else if (!record.createdAt) {
          record.createdAt = now;
        }
      }
      record.updatedAt = now;
      if (who) {
        record.updatedBy = who.name;
        record.updatedByEmpId = who.empId;
        record.updatedByUid = who.uid || '';
      }
      record.formId = formId;
      var idx = list.findIndex(function (r) { return r.id === record.id; });
      if (idx >= 0) {
        archive(formId, [list[idx]], 'save');
        list[idx] = record;
      } else list.unshift(record);
      writeJson(listKey(formId), list);
      this.clearDraft(formId);
      return record;
    },

    /**
     * 배열에서 통째로 빼는 물리 삭제는 하지 않는다 — dkj-cloud-sync.js 의 기존(V1) 동기화가
     * 두 기기의 배열을 '합집합'으로 병합하기 때문이다(mergeRecords). 이 기기에서 빼도 아직
     * 동기화 전인 다른 기기는 그 기록을 여전히 갖고 있고, 그 기기가 다음 30초 주기 동기화를
     * 돌리는 순간 "클라우드에 없는 내 기록"으로 오인해 되살려 다시 밀어올린다 — 삭제가
     * 영원히 확정되지 못하고 기기 간에 계속 되살아난다. 대신 deleted 표식을 남기고
     * updatedAt 을 갱신해서, 병합 로직이 이 표식 자체를 '더 최신 값'으로 정상 전파하게 한다.
     * list()/get() 은 deleted 를 걸러내므로 화면·내보내기에는 그대로 안 보인다.
     */
    remove: function (formId, id) {
      var list = readJson(listKey(formId), []);
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx < 0) return;
      archive(formId, [list[idx]], 'delete');
      var who = (global.DkjAuth && global.DkjAuth.user()) || null;
      var now = new Date().toISOString();
      // 삭제 표식(tombstone)에는 본문을 남기지 않는다 — 화면·내보내기에 안 보이는 기록이
      // 사진까지 그대로 localStorage 를 차지해, 지워도 저장 공간이 늘 가득 차 있었다
      // (2026-10-16: 소독헹굼 일지 시험지 사진). 병합에 필요한 식별·추적 정보만 남긴다.
      var KEEP = ['id', 'formId', 'title', 'workDate', 'docDate', 'checkDate', 'createdAt', 'createdBy',
                  'createdByEmpId', 'createdByUid', 'updatedBy', 'updatedByEmpId', 'updatedByUid', 'audit'];
      var slim = {};
      KEEP.forEach(function (k) { if (list[idx][k] !== undefined) slim[k] = list[idx][k]; });
      list[idx] = Object.assign(slim, {
        deleted: true,
        deletedAt: now,
        deletedBy: who ? who.name : '',
        deletedByEmpId: who ? who.empId : '',
        updatedAt: now
      });
      writeJson(listKey(formId), list);
    },

    saveDraft: function (formId, data) {
      data._savedAt = new Date().toISOString();
      writeJson(draftKey(formId), data);
    },

    loadDraft: function (formId) {
      return readJson(draftKey(formId), null);
    },

    clearDraft: function (formId) {
      localStorage.removeItem(draftKey(formId));
      mirror(draftKey(formId), null);
    }
  };

  // 저장·감사·잠금 검사를 동일한 최신 스냅샷과 탭 간 잠금 안에서 실행한다.
  var core = global.DkjRecordStore;
  if (backend) {
    var publicStore = {};
    async function mutate(formId, action) {
      await backend.ready();
      return backend.exclusive(async function () {
        var keys = [listKey(formId), draftKey(formId), historyKey(formId), 'dkj:migrations:v1'];
        var values = Object.create(null);
        for (var key of keys) {
          var raw = await global.DkjStore.get(key);
          if (raw !== undefined) values[key] = raw;
        }
        staged = {values: values, writes: Object.create(null)};
        var result, writes;
        try { result = action(core); writes = staged.writes; }
        finally { staged = null; }
        // 저장·임시저장·삭제는 결재 훅 등이 mutate 를 직접 부르기도 하므로, 실패 보고는 실제
        // 쓰기 지점 한 곳에서 한다. 기록 목록 쓰기(list)와 임시저장(draft)을 따로 추적해,
        // 임시저장이 성공했다고 실패한 저장의 경고가 사라지지 않게 한다.
        var kind = writes[listKey(formId)] !== undefined ? 'list' : 'draft';
        try { await global.DkjStore.batch(writes); }
        catch (error) {
          if (Object.keys(writes).length && typeof backend.reportWrite === 'function') backend.reportWrite(kind, false, error);
          throw error;
        }
        if (Object.keys(writes).length && typeof backend.reportWrite === 'function') backend.reportWrite(kind, true);
        if (Object.keys(writes).length) {
          Object.keys(writes).forEach(function (key) { backend.notify(key); });
          global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: {key: listKey(formId)} }));
        }
        return result;
      });
    }
    Object.keys(core).forEach(function (name) {
      var fn = core[name];
      publicStore[name] = function (formId) {
        var args = arguments;
        if (this === core) return fn.apply(core, args);
        return mutate(formId, function () { return fn.apply(core, args); });
      };
    });
    publicStore.mutate = mutate;
    publicStore.History = History;
    global.DkjRecordStore = publicStore;
  } else {
    core.History = History;
  }

  /* ---------- 1회성 데이터 정정 ----------
   * 서식을 고쳐도 이미 저장된 기록에는 옛 값이 남는다. 기록은 브라우저 localStorage 가
   * 정본이고 서버가 없어서, 중앙에서 한 번에 고칠 방법이 없다 — 그래서 각 기기가 앱을
   * 열 때 스스로 한 번 고친다. 고친 결과는 dkj-cloud-sync.js 의 updatedAt 비교 병합을
   * 타고 다른 기기·클라우드로 퍼진다(그래서 updatedAt 을 반드시 올린다. 안 올리면
   * 아직 옛 값을 가진 기기가 다음 동기화 때 되돌려 놓는다).
   *
   * 여기 넣어도 되는 것은 '뜻이 달라지지 않는 값 교정'뿐이다. 기록 내용을 바꾸는
   * 것은 절대 넣지 말 것 — 작성완료(잠금)된 기록의 수정을 막는 dkj-approval.js 의
   * 저장 훅을 이 코드가 우회하기 때문이다(그 훅은 DkjRecordStore.save 만 감싼다).
   */
  var MIGRATION_KEY = 'dkj:migrations:v1';

  var MIGRATIONS = [
    {
      // DKJ-S-02-12 점검구역 '작업장 전체' 의 저장값이 '점체' 로 오타나 있었다.
      // 화면에 보이던 라벨은 '작업장 전체' 로 맞았고 내부 값만 틀렸으므로, 작업자가
      // 무엇을 점검했는지(기록의 뜻)는 그대로다. 서식은 2026-09-08 에 고쳤고
      // 그 전에 저장된 기록을 여기서 맞춘다.
      id: 'DKJ-S-02-12-area-typo',
      formId: 'DKJ-S-02-12',
      field: 'area',
      from: '점체',
      to: '전체',
      detail: '점검구역 저장값 오타 정정 (점체 → 전체)'
    }
  ];

  function appliedIds() {
    var v = readJson(MIGRATION_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  function markApplied(id) {
    var done = appliedIds();
    if (done.indexOf(id) === -1) {
      done.push(id);
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(done));
    }
  }

  function applyMigration(m) {
    var now = new Date().toISOString();
    // list() 는 deleted 를 걸러낸다 — 삭제 표식이 지워지지 않도록 원본 배열로 읽고 쓴다.
    var list = readJson(listKey(m.formId), []);
    var fixed = 0;
    list.forEach(function (rec) {
      if (!rec || rec[m.field] !== m.from) return;
      rec[m.field] = m.to;
      // 감사이력에 정정 사실을 남긴다. 해시 체인이라 반드시 DkjApproval.append 로
      // 붙여야 무결성 검증이 깨지지 않는다.
      global.DkjApproval.append(rec, 'FIX', '시스템', m.detail);
      rec.updatedAt = now;
      fixed++;
    });
    if (fixed) writeJson(listKey(m.formId), list);

    // 작성 중이던 임시본에도 옛 값이 남아 있을 수 있다(감사이력 대상 아님).
    var draft = readJson(draftKey(m.formId), null);
    if (draft && draft[m.field] === m.from) {
      draft[m.field] = m.to;
      writeJson(draftKey(m.formId), draft);
    }
    return fixed;
  }

  function runMigrationsCore() {
    var done = appliedIds();
    MIGRATIONS.forEach(function (m) {
      if (done.indexOf(m.id) !== -1) return;
      // 감사이력을 남길 수 없는 화면(dkj-approval.js 를 안 싣는 페이지)에서는 건너뛴다.
      // 완료 표시를 하지 않으므로 서식 화면을 열면 그때 정정된다.
      if (!global.DkjApproval || typeof global.DkjApproval.append !== 'function') return;
      try {
        var n = applyMigration(m);
        markApplied(m.id);
        if (n) {
          try {
            console.info('[DkjRecordStore] 기록 정정 ' + m.id + ': ' + n + '건');
          } catch (e) {}
        }
      } catch (e) {
        // 정정 실패가 앱을 막지 않는다 — 다음 접속 때 다시 시도한다.
      }
    });
  }

  function runMigrations() {
    if (!backend) return runMigrationsCore();
    return global.DkjRecordStore.mutate('DKJ-S-02-12', runMigrationsCore).catch(function (error) {
      console.error('[DkjRecordStore] 기존 정정 대기', error);
    });
  }

  // 스크립트 순서상 dkj-approval.js 가 아직 안 실렸을 수 있어 로드 완료 후에 돈다.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runMigrations);
  } else {
    runMigrations();
  }
})(window);
