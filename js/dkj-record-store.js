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
      if (!record.id) {
        record.id = uid();
        record.createdAt = now;
      }
      record.updatedAt = now;
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
