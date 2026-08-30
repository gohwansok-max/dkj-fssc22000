/**
 * 동김제농협 기록 수집·내보내기.
 *
 * 서식마다 저장 구조(state)가 제각각이라 고정 컬럼표를 만들 수 없다. 그래서
 * "공통 메타(서식·일자·작성자·상태)는 정규화하고, 나머지 필드는 평탄화해서 뒤에 붙인다"는
 * 방식을 쓴다. 심사에서 요구하는 건 대개 '언제·누가·무엇을·결과가 어땠는가'이므로 앞쪽
 * 공통 컬럼만으로 대부분 확인되고, 세부 점검항목은 뒤쪽 열에서 확인한다.
 *
 * 엑셀 라이브러리(ExcelJS 862KB)는 실제로 내보낼 때만 내려받는다 — 조회만 하는 사람에게
 * 태블릿 데이터를 축내지 않기 위함.
 */
(function (global) {
  'use strict';

  var LIST_RE = /^dkj:records:(.+):list:v1$/;

  function base() {
    return location.pathname.indexOf('/records/') !== -1 ? '../' : '';
  }

  function excelJsSrc() {
    return base() + 'js/vendor/exceljs.bare.min.js';
  }

  // 서식마다 이름이 다른 '같은 뜻'의 필드들 — 앞의 것부터 찾아 쓴다
  var DATE_KEYS = ['checkDate', 'workDate', 'docDate', 'date', 'inspectDate', 'weekStart', 'ymd'];
  var WRITER_KEYS = ['writer', 'inspector', 'monitorName', 'author', 'createdBy'];
  var REVIEW_KEYS = ['reviewer', 'confirmer', 'checker'];
  var APPROVE_KEYS = ['approver', 'approval'];

  // 평탄화에서 빼는 내부 필드(사람이 볼 값이 아니다). 점검결과(checks)·날짜(days)·
  // 이탈내역(incidents)은 기록의 알맹이라 반드시 남긴다 — 매트릭스 서식은 배열이 그대로
  // 'O | O | X | …' 형태로 펴진다.
  var SKIP = ['id', 'formId', 'locked', '_savedAt'];

  /**
   * 서식 state 는 평평하지 않다 — ledger 계열은 점검일·점검자를 `info` 안에, 결재자를
   * `approvals` 안에 담는다. 최상위만 훑으면 기록일자가 저장시각으로 밀리고 작성자 칸이
   * 통째로 비어 심사 자료로 못 쓰므로, 최상위에서 못 찾으면 한 겹 아래 객체까지 본다.
   * (두 겹 아래는 보지 않는다 — `checks.item3` 같은 점검값이 작성자로 오인될 수 있다.)
   */
  function pick(rec, keys) {
    var i, v;
    for (i = 0; i < keys.length; i++) {
      v = rec[keys[i]];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
    var nests = Object.keys(rec || {}).filter(function (k) {
      var o = rec[k];
      return o && typeof o === 'object' && !Array.isArray(o);
    });
    for (i = 0; i < keys.length; i++) {
      for (var j = 0; j < nests.length; j++) {
        v = rec[nests[j]][keys[i]];
        if (v !== undefined && v !== null && v !== '' && typeof v !== 'object') return String(v);
      }
    }
    return '';
  }

  function catalogTitle(formId) {
    var cat = global.DKJ_RECORD_CATALOG;
    if (!cat || !cat.records) return '';
    var hit = cat.records.filter(function (r) { return r.code === formId || r.id === formId; })[0];
    return hit ? hit.title : '';
  }

  function storageKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k != null) keys.push(k);
      }
    } catch (e) {}
    return keys;
  }

  /** localStorage 안의 모든 기록을 서식 구분 없이 한 배열로 모은다. */
  function collect() {
    var out = [];
    var keys = storageKeys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var m = key && key.match(LIST_RE);
      if (!m) continue;
      var formId = m[1];
      var list;
      try { list = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { continue; }
      if (!Array.isArray(list)) continue;
      list.forEach(function (rec) {
        if (!rec || typeof rec !== 'object') return;
        out.push({
          formId: formId,
          formTitle: catalogTitle(formId),
          id: rec.id || '',
          date: pick(rec, DATE_KEYS) || (rec.createdAt || '').slice(0, 10),
          title: rec.title || '',
          writer: pick(rec, WRITER_KEYS),
          reviewer: pick(rec, REVIEW_KEYS),
          approver: pick(rec, APPROVE_KEYS),
          status: rec.locked ? '작성완료' : '임시저장',
          judge: rec.judge || '',
          createdAt: rec.createdAt || '',
          updatedAt: rec.updatedAt || '',
          createdBy: rec.createdBy || '',
          createdByEmpId: rec.createdByEmpId || '',
          raw: rec
        });
      });
    }
    out.sort(function (a, b) {
      return String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt));
    });
    return out;
  }

  /**
   * 필터 — 값이 비어 있는 조건은 무시한다.
   * @param {{from?:string,to?:string,formId?:string,writer?:string,status?:string,q?:string}} f
   */
  function filter(rows, f) {
    f = f || {};
    var q = (f.q || '').trim().toLowerCase();
    return rows.filter(function (r) {
      if (f.from && r.date && r.date < f.from) return false;
      if (f.to && r.date && r.date > f.to) return false;
      if (f.from && !r.date) return false;
      if (f.formId && r.formId !== f.formId) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.writer) {
        var who = (r.writer + ' ' + r.createdBy).toLowerCase();
        if (who.indexOf(f.writer.toLowerCase()) === -1) return false;
      }
      if (q) {
        var hay = [r.formId, r.formTitle, r.title, r.writer, r.createdBy, r.judge].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /** 중첩 객체를 'checks.item3' 같은 한 줄짜리 키로 편다. */
  function flatten(obj, prefix, out) {
    out = out || {};
    prefix = prefix || '';
    Object.keys(obj || {}).forEach(function (k) {
      if (!prefix && SKIP.indexOf(k) !== -1) return;
      var v = obj[k];
      var key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else if (Array.isArray(v)) out[key] = v.map(function (x) {
        // 이탈내역처럼 객체가 늘어선 배열은 JSON 대신 사람이 읽는 한 줄로 편다
        if (x && typeof x === 'object') {
          return Object.keys(x).map(function (kk) { return x[kk]; })
            .filter(function (val) { return val !== '' && val != null; }).join(' · ');
        }
        return String(x == null ? '' : x);
      }).filter(function (s) { return s !== ''; }).join(' | ');
      else out[key] = v == null ? '' : String(v);
    });
    return out;
  }

  /**
   * CSV/XLSX 수식 주입 방지 — 기록 필드에 `=1+1`, `=HYPERLINK(...)` 같은 값이 들어있으면
   * 엑셀이 문자열이 아니라 수식으로 해석해 열 때 실행할 수 있다(CSV Injection).
   * `= + - @` 나 탭·캐리지리턴으로 시작하는 값은 앞에 작은따옴표를 붙여 텍스트로 고정한다.
   */
  var FORMULA_RE = /^[=+\-@\t\r]/;
  function sanitizeCell(v) {
    var s = String(v == null ? '' : v);
    return FORMULA_RE.test(s) ? "'" + s : s;
  }

  var BASE_COLS = [
    ['formId', '서식코드'], ['formTitle', '서식명'], ['date', '기록일자'],
    ['title', '기록제목'], ['writer', '작성자'], ['reviewer', '확인자'],
    ['approver', '승인자'], ['status', '상태'], ['judge', '판정'],
    ['createdBy', '로그인 작성자'], ['createdByEmpId', '사번'],
    ['createdAt', '최초저장'], ['updatedAt', '최종수정']
  ];

  /**
   * 한 서식 묶음을 표(헤더 + 행들)로 만든다. 서식별 추가 컬럼은 등장 순서대로 뒤에 붙는다.
   *
   * commonOnly 를 주면 공통 13컬럼만 낸다. 서로 다른 서식을 한 표에 합치면 각 서식의
   * 고유 필드가 전부 옆으로 붙어 서식이 늘수록 컬럼이 수백 개로 불어나고, 대부분의 칸이
   * 빈 채로 남아 사람이 읽을 수 없게 된다 — 여러 서식이 섞인 표는 '언제·누가·무엇을·
   * 결과가 어땠는가'만 보이고, 세부 점검항목은 서식별 시트에서 본다.
   */
  function toTable(rows, commonOnly) {
    if (commonOnly) {
      return {
        header: BASE_COLS.map(function (c) { return c[1]; }),
        body: rows.map(function (r) {
          return BASE_COLS.map(function (c) { return sanitizeCell(r[c[0]]); });
        })
      };
    }
    var extraKeys = [];
    var flats = rows.map(function (r) {
      var f = flatten(r.raw);
      Object.keys(f).forEach(function (k) {
        if (extraKeys.indexOf(k) === -1) extraKeys.push(k);
      });
      return f;
    });
    var header = BASE_COLS.map(function (c) { return c[1]; }).concat(extraKeys);
    var body = rows.map(function (r, i) {
      var base = BASE_COLS.map(function (c) { return sanitizeCell(r[c[0]]); });
      return base.concat(extraKeys.map(function (k) { return sanitizeCell(flats[i][k]); }));
    });
    return { header: header, body: body };
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** 이 묶음에 서식이 몇 종 섞여 있는지 */
  function formCount(rows) {
    var seen = {};
    rows.forEach(function (r) { seen[r.formId] = 1; });
    return Object.keys(seen).length;
  }

  /**
   * CSV — 엑셀이 한글을 깨뜨리지 않도록 BOM 을 붙인다.
   * 시트를 나눌 수 없는 단일 표라, 한 서식만 뽑았을 때는 세부 항목까지 전부 내고
   * 여러 서식이 섞였을 때는 공통 컬럼만 낸다(안 그러면 컬럼이 수백 개가 된다).
   */
  function toCsv(rows, filename) {
    var t = toTable(rows, formCount(rows) > 1);
    function cell(v) {
      var s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var text = [t.header].concat(t.body).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }),
      filename || ('동김제_기록_' + stamp() + '.csv'));
    return rows.length;
  }

  function loadExcelJs() {
    if (global.ExcelJS) return Promise.resolve(global.ExcelJS);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = excelJsSrc();
      s.onload = function () {
        global.ExcelJS ? resolve(global.ExcelJS) : reject(new Error('EXCELJS_LOAD_FAILED'));
      };
      s.onerror = function () { reject(new Error('EXCELJS_LOAD_FAILED')); };
      document.head.appendChild(s);
    });
  }

  function safeSheetName(name) {
    // 엑셀 시트명 제한: 31자, : \ / ? * [ ] 금지
    return String(name || 'sheet').replace(/[:\\\/\?\*\[\]]/g, '-').slice(0, 31);
  }

  function styleHeader(sheet, cols) {
    var row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009A44' } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 22;
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } };
  }

  /**
   * XLSX — '전체' 시트 하나 + 서식별 시트. 심사에서 특정 서식만 뽑아 보는 일이 잦아서
   * 서식별로 나눠 둔다.
   *
   * '전체' 시트는 공통 13컬럼만 쓴다(색인 역할). 세부 점검항목까지 필요하면 그 아래
   * 서식별 시트를 본다 — 서식마다 필드가 달라 한 표에 다 넣으면 컬럼이 수백 개가 된다.
   */
  function toXlsx(rows, filename, meta) {
    return loadExcelJs().then(function (ExcelJS) {
      var wb = new ExcelJS.Workbook();
      wb.creator = '동김제농협 산지유통센터 스마트 HACCP';
      wb.created = new Date();

      function addSheet(name, list, commonOnly) {
        var t = toTable(list, commonOnly);
        var sheet = wb.addWorksheet(safeSheetName(name));
        sheet.addRow(t.header);
        t.body.forEach(function (r) { sheet.addRow(r); });
        styleHeader(sheet, t.header.length);
        sheet.columns.forEach(function (col, i) {
          col.width = i < 4 ? 18 : 14;
        });
        return sheet;
      }

      addSheet('전체', rows, true);

      var byForm = {};
      rows.forEach(function (r) {
        (byForm[r.formId] = byForm[r.formId] || []).push(r);
      });
      Object.keys(byForm).sort().forEach(function (formId) {
        addSheet(formId, byForm[formId]);
      });

      // 표지 — 어떤 조건으로 뽑은 자료인지 남긴다(심사 제출 시 근거가 된다)
      var info = wb.addWorksheet('내보내기 정보');
      info.columns = [{ width: 18 }, { width: 60 }];
      [
        ['사업장', '동김제농협 산지유통센터'],
        ['내보낸 시각', new Date().toLocaleString('ko-KR')],
        ['기간', ((meta && meta.from) || '전체') + ' ~ ' + ((meta && meta.to) || '전체')],
        ['서식', (meta && meta.formId) || '전체'],
        ['상태', (meta && meta.status) || '전체'],
        ['작성자', (meta && meta.writer) || '전체'],
        ['총 건수', rows.length + '건'],
        ['서식 수', Object.keys(byForm).length + '종']
      ].forEach(function (r) {
        var row = info.addRow(r);
        row.getCell(1).font = { bold: true };
      });

      return wb.xlsx.writeBuffer().then(function (buf) {
        download(new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }), filename || ('동김제_기록_' + stamp() + '.xlsx'));
        return rows.length;
      });
    });
  }

  /** 마지막 백업 시각 — js/dkj-backup-reminder.js 가 이 키를 읽어 주 1회 백업 배너를 띄운다. */
  var LAST_BACKUP_KEY = 'dkj:backup:lastBackupAt:v1';
  function markBackedUp() {
    try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); } catch (e) {}
  }

  /** 전체 기록 원본 백업 — 복원 가능한 형태(JSON). */
  function toJsonBackup(filename) {
    var dump = { site: '동김제농협 산지유통센터', exportedAt: new Date().toISOString(), records: {} };
    var keys = storageKeys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key && LIST_RE.test(key)) {
        try { dump.records[key] = JSON.parse(localStorage.getItem(key)); } catch (e) {}
      }
    }
    download(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }),
      filename || ('동김제_기록백업_' + stamp() + '.json'));
    markBackedUp();
    return Object.keys(dump.records).length;
  }

  /** 로그인 세션·토큰(dkj:auth:*)과 챗봇 대화(dkj:chatbot:*)는 백업에 담지 않는다 —
   * 계정 정보는 시스템 설정 화면에서 별도로 관리하고, 세션은 기기마다 달라야 한다.
   * dkj:backup:* 는 '언제 백업했는가' 메타 정보라 백업 내용물이 아니다 — 옛 백업을
   * 복원할 때 이 값까지 되돌아가면 방금 한 백업이 안 한 것처럼 보이므로 제외한다. */
  var SETTINGS_EXCLUDE_RE = /^dkj:(auth:|chatbot:|backup:)/;

  /** 작성 중 임시본(draft) — LIST_RE 에 안 걸려 '설정'으로 백업엔 담기지만, 복원 때
   * 그대로 덮어쓰면 지금 기기에서 더 진행된 임시본을 백업 시점의 옛 임시본으로 지울 수
   * 있다. 병합할 배열이 아니라 통짜 객체라 id 병합도 못 쓰므로, 아예 복원 대상에서 뺀다. */
  var DRAFT_RE = /^dkj:records:(.+):draft:v1$/;

  /** 기록 목록(id·updatedAt 기준 병합)을 실제 저장소에 반영한다 — 같은 id 는 최신본만 남긴다. */
  function restoreRecordsFrom(recordsObj) {
    var added = 0;
    Object.keys(recordsObj || {}).forEach(function (key) {
      if (!LIST_RE.test(key)) return;
      var incoming = recordsObj[key] || [];
      var current = [];
      try { current = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
      var byId = {};
      current.forEach(function (r) { if (r && r.id) byId[r.id] = r; });
      incoming.forEach(function (r) {
        if (!r || !r.id) return;
        var old = byId[r.id];
        if (!old || String(r.updatedAt || '') > String(old.updatedAt || '')) {
          if (!old) added++;
          byId[r.id] = r;
        }
      });
      localStorage.setItem(key, JSON.stringify(Object.keys(byId).map(function (k) { return byId[k]; })));
    });
    return added;
  }

  /** 백업 JSON 복원 — 같은 id 는 최신(updatedAt)만 남긴다. */
  function restoreJson(text) {
    var dump = JSON.parse(text);
    if (!dump || !dump.records) throw new Error('BAD_BACKUP');
    return restoreRecordsFrom(dump.records);
  }

  /** 전체 백업 — 기록 전체 + 시스템 설정(텔레그램 알림, 가동 캘린더, 생산 목표 등)을
   * 한 파일에 담는다. 로그인 세션·비밀번호 캐시(dkj:auth:*)는 담지 않는다. */
  function toFullBackup(filename) {
    var dump = { site: '동김제농협 산지유통센터', exportedAt: new Date().toISOString(), records: {}, settings: {} };
    var keys = storageKeys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!key) continue;
      if (LIST_RE.test(key)) {
        try { dump.records[key] = JSON.parse(localStorage.getItem(key)); } catch (e) {}
      } else if (key.indexOf('dkj:') === 0 && !SETTINGS_EXCLUDE_RE.test(key)) {
        try { dump.settings[key] = JSON.parse(localStorage.getItem(key)); } catch (e) { dump.settings[key] = localStorage.getItem(key); }
      }
    }
    download(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }),
      filename || ('동김제_전체백업_' + stamp() + '.json'));
    markBackedUp();
    return { records: Object.keys(dump.records).length, settings: Object.keys(dump.settings).length };
  }

  /** 전체 백업 복원 — 기록은 병합, 설정값은 백업 시점 값으로 덮어쓴다.
   * 작성 중 임시본(draft)은 복원하지 않는다 — 지금 기기에서 더 진행된 입력을
   * 백업 시점의 옛 임시본으로 덮어쓸 수 있어서다. */
  function restoreFullBackup(text) {
    var dump = JSON.parse(text);
    if (!dump || (!dump.records && !dump.settings)) throw new Error('BAD_BACKUP');
    var recordsAdded = restoreRecordsFrom(dump.records);
    var settingsRestored = 0;
    Object.keys(dump.settings || {}).forEach(function (key) {
      if (!key || key.indexOf('dkj:') !== 0 || LIST_RE.test(key) || SETTINGS_EXCLUDE_RE.test(key) || DRAFT_RE.test(key)) return;
      try {
        var v = dump.settings[key];
        localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v));
        settingsRestored++;
      } catch (e) {}
    });
    return { records: recordsAdded, settings: settingsRestored };
  }

  /** 마지막 백업 시각(ISO) — 없으면 null. js/dkj-backup-reminder.js 가 이걸로 배너를 띄운다. */
  function lastBackupAt() {
    try { return localStorage.getItem(LAST_BACKUP_KEY); } catch (e) { return null; }
  }

  global.DkjExport = {
    collect: collect,
    filter: filter,
    toTable: toTable,
    toCsv: toCsv,
    toXlsx: toXlsx,
    toJsonBackup: toJsonBackup,
    lastBackupAt: lastBackupAt,
    restoreJson: restoreJson,
    toFullBackup: toFullBackup,
    restoreFullBackup: restoreFullBackup
  };
})(window);
