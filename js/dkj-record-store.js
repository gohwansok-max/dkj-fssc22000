/**
 * 동김제 테넌트 기록 localStorage (코엔에프 StorageService와 분리)
 */
(function (global) {
  'use strict';

  function listKey(formId) {
    return 'dkj:records:' + formId + ':list:v1';
  }

  function draftKey(formId) {
    return 'dkj:records:' + formId + ':draft:v1';
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    try { global.dispatchEvent(new CustomEvent('dkj:records-changed', { detail: { key: key, value: value } })); } catch (e) {}
  }

  function uid() {
    return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  global.DkjRecordStore = {
    list: function (formId) {
      return readJson(listKey(formId), []).filter(function (r) { return !r || !r.deleted; });
    },

    get: function (formId, id) {
      return this.list(formId).find(function (r) { return r.id === id; }) || null;
    },

    save: function (formId, record) {
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
      if (idx >= 0) list[idx] = record;
      else list.unshift(record);
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
      var who = (global.DkjAuth && global.DkjAuth.user()) || null;
      var now = new Date().toISOString();
      list[idx] = Object.assign({}, list[idx], {
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
    }
  };

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

  function runMigrations() {
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

  // 스크립트 순서상 dkj-approval.js 가 아직 안 실렸을 수 있어 로드 완료 후에 돈다.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runMigrations);
  } else {
    runMigrations();
  }
})(window);
