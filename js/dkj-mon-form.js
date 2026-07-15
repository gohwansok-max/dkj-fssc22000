/**
 * DkjMonForm — 측정형 일보 공용 엔진 (온습도 / 조도 등)
 * spec.monMode: "th" (amT/amH/pmT/pmH) | "lux" (amLux/pmLux)
 */
(function (global) {
  'use strict';

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function inRange(v, min, max) {
    if (v === '' || v === null || v === undefined) return null;
    var n = parseFloat(v);
    if (isNaN(n)) return null;
    if (min === null || max === null) return true;
    return n >= min && n <= max;
  }

  function emptyZoneRow(z, mode) {
    var row = {
      id: z.id,
      name: z.name,
      judge: ''
    };
    if (mode === 'lux') {
      row.luxMin = z.luxMin;
      row.luxMax = z.luxMax;
      row.amLux = '';
      row.pmLux = '';
    } else {
      row.tMin = z.tMin;
      row.tMax = z.tMax;
      row.hMin = z.hMin != null ? z.hMin : null;
      row.hMax = z.hMax != null ? z.hMax : null;
      row.amT = '';
      row.amH = '';
      row.pmT = '';
      row.pmH = '';
    }
    return row;
  }

  function emptyState(spec) {
    var mode = spec.monMode || 'th';
    var st = {
      checkDate: today(),
      inspector: '',
      confirmer: '',
      corrective: '',
      remark: '',
      locked: false,
      hasDeviation: false,
      zones: (spec.zones || []).map(function (z) { return emptyZoneRow(z, mode); })
    };
    (spec.fields || []).forEach(function (f) {
      if (f.id === 'checkDate') return;
      if (f.default !== undefined) st[f.id] = f.default;
      else st[f.id] = '';
    });
    return st;
  }

  function mount(spec) {
    if (!spec || !spec.code) throw new Error('DkjMonForm: spec.code required');
    var FORM_ID = spec.code;
    var mode = spec.monMode || 'th';
    var ZONES = spec.zones || [];
    var state = emptyState(spec);
    var editingId = null;
    var draftTimer = null;
    var metaIds = ['checkDate', 'inspector', 'confirmer', 'corrective', 'remark']
      .concat((spec.fields || []).map(function (f) { return f.id; }))
      .filter(function (v, i, a) { return a.indexOf(v) === i; });

    function setStatus(msg, saved) {
      var el = $('saveStatus');
      if (!el) return;
      el.innerHTML = '<span class="dot"></span> ' + msg;
      el.className = 'dkj-status' + (saved ? ' saved' : '');
    }

    function evalZone(z) {
      var checks = [];
      if (mode === 'lux') {
        var am = inRange(z.amLux, z.luxMin, z.luxMax);
        var pm = inRange(z.pmLux, z.luxMin, z.luxMax);
        [am, pm].forEach(function (c) { if (c !== null) checks.push(c); });
      } else {
        var amT = inRange(z.amT, z.tMin, z.tMax);
        var pmT = inRange(z.pmT, z.tMin, z.tMax);
        var amH = z.hMin === null ? true : inRange(z.amH, z.hMin, z.hMax);
        var pmH = z.hMin === null ? true : inRange(z.pmH, z.hMin, z.hMax);
        [amT, pmT, amH, pmH].forEach(function (c) { if (c !== null) checks.push(c); });
      }
      if (!checks.length) { z.judge = ''; return; }
      z.judge = checks.every(Boolean) ? 'O' : (checks.indexOf(false) !== -1 ? 'X' : '');
    }

    function refreshDev() {
      state.hasDeviation = state.zones.some(function (z) { return z.judge === 'X'; });
      var b = $('deviationBanner');
      if (b) b.hidden = !state.hasDeviation;
    }

    function badClass(v, min, max) {
      return inRange(v, min, max) === false ? ' bad' : '';
    }

    function renderZones() {
      var body = $('monBody');
      if (!body) return;
      body.innerHTML = state.zones.map(function (z, i) {
        evalZone(z);
        if (mode === 'lux') {
          var crit = z.luxMin + '~' + z.luxMax;
          return '<tr data-i="' + i + '">' +
            '<td><strong>' + z.name + '</strong></td>' +
            '<td>' + crit + ' lx</td>' +
            '<td><input type="number" step="1" class="mon-in' + badClass(z.amLux, z.luxMin, z.luxMax) +
            '" data-f="amLux" value="' + (z.amLux || '') + '"></td>' +
            '<td><input type="number" step="1" class="mon-in' + badClass(z.pmLux, z.luxMin, z.luxMax) +
            '" data-f="pmLux" value="' + (z.pmLux || '') + '"></td>' +
            '<td class="mon-judge ' + (z.judge === 'X' ? 'ng' : z.judge === 'O' ? 'ok' : '') + '">' +
            (z.judge || '·') + '</td></tr>';
        }
        var tCrit = z.tMin + '~' + z.tMax;
        var hCrit = z.hMin === null ? '-' : (z.hMin + '~' + z.hMax);
        return '<tr data-i="' + i + '">' +
          '<td><strong>' + z.name + '</strong></td>' +
          '<td>' + tCrit + '</td><td>' + hCrit + '</td>' +
          '<td><input type="number" step="0.1" class="mon-in' + badClass(z.amT, z.tMin, z.tMax) +
          '" data-f="amT" value="' + (z.amT || '') + '"></td>' +
          '<td><input type="number" step="0.1" class="mon-in' +
          (z.hMin === null ? '' : badClass(z.amH, z.hMin, z.hMax)) +
          '" data-f="amH" value="' + (z.amH || '') + '"' +
          (z.hMin === null ? ' disabled placeholder="-"' : '') + '></td>' +
          '<td><input type="number" step="0.1" class="mon-in' + badClass(z.pmT, z.tMin, z.tMax) +
          '" data-f="pmT" value="' + (z.pmT || '') + '"></td>' +
          '<td><input type="number" step="0.1" class="mon-in' +
          (z.hMin === null ? '' : badClass(z.pmH, z.hMin, z.hMax)) +
          '" data-f="pmH" value="' + (z.pmH || '') + '"' +
          (z.hMin === null ? ' disabled placeholder="-"' : '') + '></td>' +
          '<td class="mon-judge ' + (z.judge === 'X' ? 'ng' : z.judge === 'O' ? 'ok' : '') + '">' +
          (z.judge || '·') + '</td></tr>';
      }).join('');
      body.querySelectorAll('.mon-in').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          if (state.locked) return;
          var i = Number(e.target.closest('tr').getAttribute('data-i'));
          state.zones[i][e.target.getAttribute('data-f')] = e.target.value;
          renderZones();
          scheduleDraft();
        });
      });
      refreshDev();
    }

    function readForm() {
      metaIds.forEach(function (id) {
        var el = $(id);
        if (el) state[id] = el.value;
      });
    }

    function writeForm() {
      metaIds.forEach(function (id) {
        var el = $(id);
        if (!el) return;
        el.value = state[id] != null ? state[id] : '';
      });
      if ($('checkDate') && !$('checkDate').value) $('checkDate').value = today();
      if (!state.zones || !state.zones.length) {
        state.zones = ZONES.map(function (z) { return emptyZoneRow(z, mode); });
      }
      renderZones();
    }

    function scheduleDraft() {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(function () {
        readForm();
        DkjRecordStore.saveDraft(FORM_ID, state);
        setStatus('임시저장 ' + new Date().toLocaleTimeString(), false);
      }, 400);
    }

    function hasAnyMeasure() {
      return state.zones.some(function (z) {
        if (mode === 'lux') return z.amLux || z.pmLux;
        return z.amT || z.pmT || z.amH || z.pmH;
      });
    }

    function validate() {
      readForm();
      state.zones.forEach(evalZone);
      refreshDev();
      if (!state.checkDate) return '점검일자를 입력하세요.';
      if (!state.inspector) return '점검자를 입력하세요.';
      if (!hasAnyMeasure()) return '측정값을 1건 이상 입력하세요.';
      if (state.hasDeviation && !(state.corrective || '').trim()) {
        return '이탈 시 즉시조치를 기록하세요.';
      }
      return '';
    }

    function save(lock) {
      var err = validate();
      if (err) { alert(err); return; }
      state.locked = !!lock;
      var rec = DkjRecordStore.save(FORM_ID, Object.assign({}, state, {
        id: editingId || undefined,
        title: spec.title || FORM_ID,
        judge: state.hasDeviation ? '이탈' : '적합'
      }));
      editingId = rec.id;
      setStatus(lock ? '작성완료 저장됨' : '저장됨', true);
      renderHistory();
    }

    function renderHistory() {
      var list = DkjRecordStore.list(FORM_ID).slice(0, 12);
      var el = $('historyList');
      if (!el) return;
      if (!list.length) {
        el.innerHTML = '<p style="color:#888;font-size:13px;">저장 기록 없음</p>';
        return;
      }
      el.innerHTML = list.map(function (r) {
        return '<div class="dkj-history-item"><div><strong>' + (r.checkDate || '') + '</strong>' +
          ' <span class="badge ' + (r.hasDeviation ? 'wip' : 'done') + '">' + (r.judge || '-') + '</span></div>' +
          '<div style="display:flex;gap:6px;">' +
          '<button type="button" class="pill-btn ghost" data-load="' + r.id + '">불러오기</button>' +
          '<button type="button" class="pill-btn ghost" data-del="' + r.id + '">삭제</button></div></div>';
      }).join('');
      el.querySelectorAll('[data-load]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = DkjRecordStore.get(FORM_ID, b.getAttribute('data-load'));
          if (!r) return;
          editingId = r.id;
          state = Object.assign(emptyState(spec), r);
          writeForm();
          setStatus('기록 불러옴', true);
        });
      });
      el.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('삭제할까요?')) return;
          DkjRecordStore.remove(FORM_ID, b.getAttribute('data-del'));
          if (editingId === b.getAttribute('data-del')) {
            editingId = null;
            state = emptyState(spec);
            writeForm();
          }
          renderHistory();
        });
      });
    }

    function bind() {
      metaIds.forEach(function (id) {
        var el = $(id);
        if (!el) return;
        el.addEventListener('input', scheduleDraft);
        el.addEventListener('change', scheduleDraft);
      });
      if ($('btnSave')) $('btnSave').addEventListener('click', function () { save(false); });
      if ($('btnLock')) $('btnLock').addEventListener('click', function () { save(true); });
      if ($('btnNew')) {
        $('btnNew').addEventListener('click', function () {
          editingId = null;
          state = emptyState(spec);
          writeForm();
          setStatus('새 일보', false);
        });
      }
      if ($('btnPrint')) {
        $('btnPrint').addEventListener('click', function () {
          readForm();
          if (window.DkjPrint) {
            var tmpl = DkjPrint.fromFormSpec(spec);
            DkjPrint.print(tmpl, state);
          } else {
            window.print();
          }
        });
      }
    }

    function init() {
      var draft = DkjRecordStore.loadDraft(FORM_ID);
      if (draft) state = Object.assign(emptyState(spec), draft);
      writeForm();
      bind();
      renderHistory();
      setStatus('준비', false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  global.DkjMonForm = { mount: mount };
})(window);
