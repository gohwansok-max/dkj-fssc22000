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
  }

  function uid() {
    return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  global.DkjRecordStore = {
    list: function (formId) {
      return readJson(listKey(formId), []);
    },

    get: function (formId, id) {
      return this.list(formId).find(function (r) { return r.id === id; }) || null;
    },

    save: function (formId, record) {
      var list = this.list(formId);
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

    remove: function (formId, id) {
      var list = this.list(formId).filter(function (r) { return r.id !== id; });
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
