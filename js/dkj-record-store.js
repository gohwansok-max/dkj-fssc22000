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
})(window);
